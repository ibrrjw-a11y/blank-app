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
    pass


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
    shots = resp.parsed_output
    if resp.stop_reason == "refusal" or shots is None or len(shots.prompts) != len(lines):
        return [_template_prompt(ln, deal) for ln in lines], "template"
    return shots.prompts, "claude"


# ------------------------------------------------------------------ 생성기

def _gemini(prompt: str) -> bytes:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise ImageError("GEMINI_API_KEY 가 .env 에 없습니다")
    model = config.get("images.gemini_model", "gemini-2.5-flash-image")
    r = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        headers={"x-goog-api-key": key, "Content-Type": "application/json"},
        json={"contents": [{"parts": [{"text": prompt}]}],
              "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "4:3"}}},
        timeout=120,
    )
    if r.status_code != 200:
        raise ImageError(f"Gemini {r.status_code}: {r.text[:300]}")
    for cand in r.json().get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            data = (part.get("inlineData") or part.get("inline_data") or {}).get("data")
            if data:
                return base64.b64decode(data)
    raise ImageError(f"Gemini 응답에 이미지가 없음 (안전 필터일 수 있음): {r.text[:300]}")


def _openai(prompt: str) -> bytes:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise ImageError("OPENAI_API_KEY 가 .env 에 없습니다")
    r = requests.post(
        "https://api.openai.com/v1/images/generations",
        headers={"Authorization": f"Bearer {key}"},
        json={"model": config.get("images.openai_model", "gpt-image-1"), "prompt": prompt,
              "size": "1536x1024", "n": 1},
        timeout=180,
    )
    if r.status_code != 200:
        raise ImageError(f"OpenAI {r.status_code}: {r.text[:300]}")
    return base64.b64decode(r.json()["data"][0]["b64_json"])


PROVIDERS = {"gemini": _gemini, "openai": _openai}


def generate(job: Job, scenes: list[Scene], provider: str | None = None, force: bool = False,
             mode: str | None = None) -> dict:
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
    made, failed = 0, []
    for (i, text), prompt in zip(todo, prompts):
        data = None
        for attempt in range(3):  # 일시 오류·안전 필터 대비 최대 3번
            try:
                data = fn(prompt)
                break
            except (ImageError, requests.RequestException) as e:
                err = str(e)
                job.log(f"이미지 {i}줄 실패({attempt + 1}/3): {err}")
                if "API_KEY" in err:  # 키 문제는 재시도해도 소용없음
                    raise
        if data is None:
            failed.append(i)
            continue
        (out_dir / f"line_{i:03d}.png").write_bytes(data)
        log[f"{i:03d}"] = {"text": text, "prompt": prompt, "provider": provider, "prompt_by": by}
        made += 1
    log_path.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"provider": provider, "made": made, "failed": failed, "prompt_by": by}
