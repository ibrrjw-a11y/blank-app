"""줄마다 AI 이미지 생성 (게시글형 장면 전용).

- 어떤 줄에 그릴지: config images.select (every | marked | first)
    every  : 게시글형 줄 전부. 단, 가격을 말하는 줄은 실제 상품 사진을 쓰므로 제외
    marked : 대본에서 줄 앞에 [img] 를 붙인 줄만
    first  : 게시글 장면마다 첫 줄만
- 무엇을 그릴지: 상황·사람·장소·감정. 상품 자체는 그리지 않는다
  (AI가 만든 상품 모습은 실제와 달라 소비자를 오인시킬 수 있음 → 상품은 실제 사진으로).
- 결과: images/line_NNN.png (이미 있으면 건너뜀, --force 로 다시), 사용한 프롬프트는 images/prompts.json
"""
from __future__ import annotations

import base64
import json
import os
import re

import requests
from pydantic import BaseModel, Field

from . import config
from .job import Job
from .scenes import Scene

STYLE = ("Photorealistic smartphone photo, natural light, everyday life in South Korea, candid composition, "
         "4:3 landscape. No text, no captions, no watermarks, no logos, no brand names. "
         "Do not show any specific commercial product packaging.")


class ImageError(RuntimeError):
    def __init__(self, msg: str, retry_after: float | None = None, fatal: bool = False):
        super().__init__(msg)
        self.retry_after = retry_after  # 몇 초 뒤 다시 하면 되는 오류 (분당 한도 등)
        self.fatal = fatal              # 다시 해도 소용없는 오류 (키·결제·모델 이름)


def _sleep(sec: float) -> None:  # 테스트에서 바꿔 끼움
    import time
    time.sleep(sec)


def _gemini_retry_delay(text: str) -> float:
    m = re.search(r'"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"', text)
    return float(m.group(1)) + 1 if m else 30.0


# ------------------------------------------------------------------ 어떤 줄에 그릴지

PRICE_RE = re.compile(r"\d.*원|[만천백].*원|원래|정가|할인|특가|링크")


def is_price_line(text: str) -> bool:
    return bool(PRICE_RE.search(text))


def select_lines(scenes: list[Scene], mode: str | None = None) -> list[tuple[int, str]]:
    """(나레이션 전체 기준 줄 번호, 줄 텍스트) 목록."""
    mode = mode or config.get("images.select", "every")
    out, idx = [], 0
    for sc in scenes:
        for k, it in enumerate(sc.items):
            if sc.kind == "post":
                if mode == "marked" and it.marked:
                    out.append((idx, it.text))
                elif mode == "first" and k == 0:
                    out.append((idx, it.text))
                elif mode == "every" and not is_price_line(it.text):
                    out.append((idx, it.text))
            idx += 1
    return out


# ------------------------------------------------------------------ 프롬프트

class ShotList(BaseModel):
    prompts: list[str] = Field(description="줄마다 하나씩, 입력 순서대로. 영어 이미지 프롬프트")


def _template_prompt(line: str, deal: dict) -> str:
    return f"{STYLE} Scene that illustrates this Korean narration line: \"{line}\". Topic: {deal.get('category') or deal['name']}."


def write_prompts(lines: list[str], deal: dict) -> tuple[list[str], str]:
    """Claude 키가 있으면 줄 흐름을 이해한 장면 목록을, 없으면 템플릿 프롬프트를 만든다."""
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        return [_template_prompt(ln, deal) for ln in lines], "template"
    import anthropic

    numbered = "\n".join(f"{i + 1}. {ln}" for i, ln in enumerate(lines))
    system = ("You write image-generation prompts for a Korean vertical shopping short. For each narration line, "
              "describe one photorealistic scene (people, place, action, emotion) that makes the line vivid. "
              "Keep the same characters and setting consistent across lines. Never depict the product itself or "
              "any packaging, never include text, logos or brand names, and never invent product claims. "
              f"Every prompt must end with: {STYLE}")
    try:
        resp = anthropic.Anthropic().beta.messages.parse(
            model=config.get("script.model", "claude-opus-5-5"),
            max_tokens=16000,
            system=system,
            output_config={"effort": "low"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            messages=[{"role": "user", "content": f"상품 분야: {deal.get('category') or deal['name']}\n\n{numbered}"}],
            output_format=ShotList,
        )
    except Exception:  # noqa: BLE001 - 프롬프트는 템플릿으로라도
        return [_template_prompt(ln, deal) for ln in lines], "template"
    shots = resp.parsed_output
    if resp.stop_reason == "refusal" or shots is None or len(shots.prompts) != len(lines):
        return [_template_prompt(ln, deal) for ln in lines], "template"
    return shots.prompts, "claude"


# ------------------------------------------------------------------ 생성기

def _gemini(prompt: str) -> bytes:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise ImageError("GEMINI_API_KEY 가 .env 에 없습니다", fatal=True)
    model = config.get("images.gemini_model", "gemini-2.5-flash-image")
    r = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        headers={"x-goog-api-key": key, "Content-Type": "application/json"},
        json={"contents": [{"parts": [{"text": prompt}]}],
              "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "4:3"}}},
        timeout=120,
    )
    if r.status_code == 429 or (r.status_code != 200 and "RESOURCE_EXHAUSTED" in r.text):
        if re.search(r"limit:\s*0\b", r.text) or "billing" in r.text.lower():
            raise ImageError("Gemini 429 → 이 키는 이미지 생성 한도가 0이에요 (무료 등급). Google AI Studio 에서 결제를 "
                             "등록하거나, 작업 화면 'AI 이미지'에서 '무료(pollinations)'를 고르세요: " + r.text[:200],
                             fatal=True)
        raise ImageError(f"Gemini 429 (분당 한도, 잠깐 쉬고 다시): {r.text[:150]}",
                         retry_after=_gemini_retry_delay(r.text))
    if r.status_code != 200:
        hint, fatal = "", True
        if r.status_code in (400, 403) and ("API key" in r.text or "PERMISSION" in r.text):
            hint = " → GEMINI_API_KEY 가 틀렸거나 이 키로 Gemini API 를 쓸 수 없어요"
        elif r.status_code == 404:
            hint = " → config.yaml 의 images.gemini_model 이름이 바뀌었을 수 있어요"
        elif "location" in r.text.lower() and "not supported" in r.text.lower():
            hint = " → 이 지역에서는 이 모델을 못 써요"
        else:
            fatal = False
        raise ImageError(f"Gemini {r.status_code}{hint}: {r.text[:300]}", fatal=fatal,
                         retry_after=10 if r.status_code >= 500 else None)
    for cand in r.json().get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            data = (part.get("inlineData") or part.get("inline_data") or {}).get("data")
            if data:
                return base64.b64decode(data)
    raise ImageError(f"Gemini 응답에 이미지가 없음 (안전 필터일 수 있음): {r.text[:300]}")


def _openai(prompt: str) -> bytes:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise ImageError("OPENAI_API_KEY 가 .env 에 없습니다", fatal=True)
    r = requests.post(
        "https://api.openai.com/v1/images/generations",
        headers={"Authorization": f"Bearer {key}"},
        json={"model": config.get("images.openai_model", "gpt-image-1"), "prompt": prompt,
              "size": "1536x1024", "n": 1},
        timeout=180,
    )
    if r.status_code == 429:
        raise ImageError(f"OpenAI 429: {r.text[:200]}", retry_after=float(r.headers.get("retry-after", 20)))
    if r.status_code != 200:
        raise ImageError(f"OpenAI {r.status_code}: {r.text[:300]}", fatal=r.status_code in (401, 403))
    return base64.b64decode(r.json()["data"][0]["b64_json"])


def _pollinations(prompt: str) -> bytes:
    """키 없이 쓰는 무료 이미지 (pollinations.ai). 품질·속도는 들쭉날쭉할 수 있음."""
    import random
    from urllib.parse import quote
    r = requests.get(f"https://image.pollinations.ai/prompt/{quote(prompt[:900])}",
                     params={"width": 1024, "height": 768, "nologo": "true", "seed": random.randint(1, 10**6),
                             "model": config.get("images.pollinations_model", "flux")},
                     timeout=180)
    if r.status_code == 429:
        raise ImageError("pollinations 429 (잠깐 쉬고 다시)", retry_after=15)
    if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image"):
        raise ImageError(f"pollinations {r.status_code}: {r.text[:200]}", retry_after=5)
    return r.content


PROVIDERS = {"gemini": _gemini, "openai": _openai, "pollinations": _pollinations}


def generate(job: Job, scenes: list[Scene], provider: str | None = None, force: bool = False,
             mode: str | None = None, log=None) -> dict:
    say = log or (lambda m: None)
    provider = provider or config.get("images.provider", "gemini")
    if provider == "none":
        return {"provider": "none", "made": 0}
    fn = PROVIDERS.get(provider)
    if fn is None:
        raise ImageError(f"알 수 없는 images.provider: {provider} (gemini | openai | none)")
    targets = select_lines(scenes, mode)
    out_dir = job.p("images")
    out_dir.mkdir(exist_ok=True)
    todo = [(i, t) for i, t in targets
            if force or not any(out_dir.glob(f"line_{i:03d}.*"))]
    if not todo:
        return {"provider": provider, "made": 0, "skipped": len(targets)}
    prompts, by = write_prompts([t for _, t in todo], job.deal)
    log_path = out_dir / "prompts.json"
    log = json.loads(log_path.read_text(encoding="utf-8")) if log_path.exists() else {}
    made, failed, last_err = 0, [], ""
    stop = False
    for n, ((i, text), prompt) in enumerate(zip(todo, prompts), 1):
        say(f"  {n}/{len(todo)} · {i + 1}번째 줄: {text[:24]}")
        if stop:
            failed.append(i)
            continue
        data = None
        for attempt in range(6):  # 분당 한도(429)는 기다렸다 다시, 일시 오류도 다시
            try:
                data = fn(prompt)
                break
            except requests.RequestException as e:
                last_err = f"네트워크: {e}"
                job.log(f"이미지 {i}줄 실패({attempt + 1}/6): {last_err}")
                _sleep(3)
            except ImageError as e:
                last_err = str(e)
                job.log(f"이미지 {i}줄 실패({attempt + 1}/6): {last_err}")
                if e.fatal:
                    if made == 0:
                        raise
                    stop = True  # 이미 만든 건 살리고 나머지는 앞 사진으로
                    break
                wait = min(e.retry_after or 3, 90)
                if e.retry_after and e.retry_after >= 5:
                    say(f"    분당 한도 → {int(wait)}초 기다렸다 다시")
                _sleep(wait)
        if data is None:
            failed.append(i)
            continue
        (out_dir / f"line_{i:03d}.png").write_bytes(data)
        log[f"{i:03d}"] = {"text": text, "prompt": prompt, "provider": provider, "prompt_by": by}
        made += 1
    log_path.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"provider": provider, "made": made, "failed": failed, "prompt_by": by, "error": last_err}


# ------------------------------------------------------------------ 내가 준 사진을 대본에 맞게 자동 배치

class Placement(BaseModel):
    product_image: int = Field(description="상품 자체(제품·패키지)가 가장 잘 보이는 사진 번호(1부터). 없으면 0")
    lines: list[int] = Field(description="대본 줄마다 가장 어울리는 사진 번호(1부터), 어울리는 게 없으면 0. "
                                         "입력한 줄 수와 정확히 같은 길이")


def _thumb_b64(path, side: int = 768) -> str:
    import io
    from PIL import Image
    img = Image.open(path).convert("RGB")
    img.thumbnail((side, side))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


def _spread(n_photos: int, lines: list[str]) -> Placement:
    """Claude 없이: 가격 줄은 비워 두고, 나머지 줄에 올린 순서대로 고르게 나눠 배치."""
    slots = [i for i, t in enumerate(lines) if not is_price_line(t)] or list(range(len(lines)))
    out = [0] * len(lines)
    for k, i in enumerate(slots):
        out[i] = min(n_photos, k * n_photos // len(slots) + 1)
    return Placement(product_image=0, lines=out)


def place_photos(lines: list[str], photos: list, deal: dict) -> tuple[Placement, str]:
    """사진들을 보고 줄마다 어울리는 사진을 고른다 (Claude 키가 있으면 사진 내용을 보고, 없으면 순서대로)."""
    if not photos:
        return Placement(product_image=0, lines=[0] * len(lines)), "none"
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        return _spread(len(photos), lines), "order"
    import anthropic
    content: list[dict] = []
    for k, p in enumerate(photos, 1):
        content += [{"type": "text", "text": f"사진 {k}"},
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                                 "data": _thumb_b64(p)}}]
    numbered = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(lines))
    content.append({"type": "text", "text": f"상품: {deal.get('name')}\n\n대본 줄:\n{numbered}"})
    system = ("한국어 쇼핑 쇼츠의 편집자다. 사용자가 준 사진들을 보고, 대본 각 줄이 나올 때 화면에 띄울 사진을 고른다. "
              "줄의 내용(상황·장면·효과·가격)과 가장 잘 맞는 사진을 고르고, 가격·할인·링크를 말하는 줄에는 상품이 잘 보이는 "
              "사진을 쓴다. 가능한 한 모든 사진을 한 번 이상 쓰고, 같은 사진이 너무 오래 이어지지 않게 한다. "
              "정말 어울리는 사진이 없는 줄만 0.")
    try:
        resp = anthropic.Anthropic().beta.messages.parse(
            model=config.get("script.model", "claude-opus-5-5"),
            max_tokens=4000,
            system=system,
            output_config={"effort": "low"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            messages=[{"role": "user", "content": content}],
            output_format=Placement,
        )
        pl = resp.parsed_output
    except Exception:  # noqa: BLE001 - 배치는 순서대로라도 해 준다
        pl = None
    if pl is None or len(pl.lines) != len(lines):
        return _spread(len(photos), lines), "order"
    n = len(photos)
    pl.lines = [x if 0 <= x <= n else 0 for x in pl.lines]
    pl.product_image = pl.product_image if 0 <= pl.product_image <= n else 0
    return pl, "claude"


def apply_photos(job: Job, scenes: list[Scene], photos: list) -> dict:
    """사진 여러 장 → images/line_NNN.jpg 로 줄마다 배치 (+ 상품 사진이 없으면 상품 컷을 상품 사진으로)."""
    from PIL import Image
    flat = [(sc.kind, it.text) for sc in scenes for it in sc.items]
    post = [(i, t) for i, (kind, t) in enumerate(flat) if kind == "post"]
    pl, by = place_photos([t for _, t in post], photos, job.deal)
    out_dir = job.p("images")
    out_dir.mkdir(exist_ok=True)
    placed = {}
    for (i, text), k in zip(post, pl.lines):
        if not k:
            continue
        for old in out_dir.glob(f"line_{i:03d}.*"):
            old.unlink()
        Image.open(photos[k - 1]).convert("RGB").save(out_dir / f"line_{i:03d}.jpg", quality=92)
        placed[i] = k
    product_set = False
    has_product = any(job.p(f"product.{e}").exists() for e in ("png", "jpg", "jpeg", "webp"))
    if pl.product_image and not has_product:
        Image.open(photos[pl.product_image - 1]).convert("RGB").save(job.p("product.jpg"), quality=92)
        product_set = True
    (out_dir / "placement.json").write_text(json.dumps(
        {"by": by, "photos": [str(p) for p in photos], "lines": {str(i): k for i, k in placed.items()},
         "product_image": pl.product_image}, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"by": by, "placed": placed, "unused": sorted(set(range(1, len(photos) + 1)) - set(placed.values())),
            "product_set": product_set, "empty_lines": [i for i, _ in post if i not in placed]}
