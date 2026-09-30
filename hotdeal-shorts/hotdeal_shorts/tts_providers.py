"""유료·클라우드 TTS: 타입캐스트, 일레븐랩스, OpenAI, 구글.

- whole(text, out) -> words : 대본 전체를 한 번에 합성하고 단어별 시각을 돌려준다
  (문장 사이 억양이 자연스럽고, 자막 싱크는 단어 시각으로 맞춘다). 타입캐스트·일레븐랩스 지원.
- line(text, out)           : 한 줄씩 합성. 모든 프로바이더 지원.
API 형식 출처: 각 사 공식 SDK/문서 (타입캐스트는 typecast-python SDK 코드로 확인).
"""
from __future__ import annotations

import base64
import os
from pathlib import Path

import requests

from . import config


class CloudTTSError(RuntimeError):
    pass


def _key(name: str) -> str:
    k = os.environ.get(name)
    if not k:
        raise CloudTTSError(f"{name} 가 .env 에 없습니다")
    return k


def _check(r: requests.Response, who: str) -> None:
    if r.status_code != 200:
        hint = {401: "API 키 확인", 402: "크레딧 부족", 429: "요청 한도 초과, 잠시 뒤 다시"}.get(r.status_code, "")
        raise CloudTTSError(f"{who} {r.status_code} {hint}: {r.text[:300]}")


# ------------------------------------------------------------------ 타입캐스트

TYPECAST = "https://api.typecast.ai"


def _typecast_body(text: str) -> dict:
    c = config.get("voice.typecast") or {}
    voice_id = c.get("voice_id")
    if not voice_id:
        raise CloudTTSError("config.yaml 의 voice.typecast.voice_id 가 비어 있음 (`hd voice list typecast` 로 찾기)")
    body = {"voice_id": voice_id, "text": text, "model": c.get("model", "ssfm-v30"), "language": "kor",
            "output": {"audio_format": "mp3", "audio_tempo": c.get("tempo", 1.1), "volume": c.get("volume", 100)}}
    if c.get("emotion"):
        body["prompt"] = {"emotion_preset": c["emotion"]}
    return body


def typecast_line(text: str, out: Path) -> None:
    r = requests.post(f"{TYPECAST}/v1/text-to-speech", json=_typecast_body(text), timeout=120,
                      headers={"X-API-KEY": _key("TYPECAST_API_KEY")})
    _check(r, "타입캐스트")
    out.write_bytes(r.content)


def typecast_whole(text: str, out: Path) -> list[dict]:
    r = requests.post(f"{TYPECAST}/v1/text-to-speech/with-timestamps", params={"granularity": "word"},
                      json=_typecast_body(text), timeout=300, headers={"X-API-KEY": _key("TYPECAST_API_KEY")})
    _check(r, "타입캐스트")
    data = r.json()
    out.write_bytes(base64.b64decode(data["audio"]))
    return [{"text": w["text"], "start": w["start"], "end": w["end"]} for w in data.get("words") or []]


def typecast_voices() -> list[dict]:
    model = (config.get("voice.typecast") or {}).get("model", "ssfm-v30")
    r = requests.get(f"{TYPECAST}/v2/voices", params={"model": model}, timeout=30,
                     headers={"X-API-KEY": _key("TYPECAST_API_KEY")})
    _check(r, "타입캐스트")
    out = []
    for v in r.json():
        name = v.get("voice_name")
        if isinstance(name, dict):
            name = name.get("kor") or name.get("eng")
        out.append({"id": v["voice_id"], "name": name, "gender": v.get("gender"), "age": v.get("age"),
                    "use_cases": ", ".join(v.get("use_cases") or [])})
    return out


# ------------------------------------------------------------------ 일레븐랩스

ELEVEN = "https://api.elevenlabs.io/v1"


def _eleven_body(text: str) -> tuple[str, dict]:
    c = config.get("voice.elevenlabs") or {}
    if not c.get("voice_id"):
        raise CloudTTSError("config.yaml 의 voice.elevenlabs.voice_id 가 비어 있음 (`hd voice list elevenlabs`)")
    return c["voice_id"], {"text": text, "model_id": c.get("model", "eleven_multilingual_v2"),
                           "language_code": "ko"}


def eleven_line(text: str, out: Path) -> None:
    vid, body = _eleven_body(text)
    r = requests.post(f"{ELEVEN}/text-to-speech/{vid}", params={"output_format": "mp3_44100_128"}, json=body,
                      timeout=120, headers={"xi-api-key": _key("ELEVENLABS_API_KEY")})
    _check(r, "일레븐랩스")
    out.write_bytes(r.content)


def chars_to_words(chars: list[str], starts: list[float], ends: list[float]) -> list[dict]:
    """글자 단위 시각 → 띄어쓰기 기준 단어 시각."""
    words, cur, s, last = [], "", None, 0.0
    for ch, a, b in zip(chars, starts, ends):
        if ch.isspace():
            if cur:
                words.append({"text": cur, "start": s, "end": last})
            cur, s = "", None
            continue
        if s is None:
            s = a
        cur, last = cur + ch, b
    if cur:
        words.append({"text": cur, "start": s, "end": last})
    return words


def eleven_whole(text: str, out: Path) -> list[dict]:
    vid, body = _eleven_body(text)
    r = requests.post(f"{ELEVEN}/text-to-speech/{vid}/with-timestamps", params={"output_format": "mp3_44100_128"},
                      json=body, timeout=300, headers={"xi-api-key": _key("ELEVENLABS_API_KEY")})
    _check(r, "일레븐랩스")
    data = r.json()
    out.write_bytes(base64.b64decode(data["audio_base64"]))
    al = data.get("alignment") or {}
    return chars_to_words(al.get("characters", []), al.get("character_start_times_seconds", []),
                          al.get("character_end_times_seconds", []))


def eleven_voices() -> list[dict]:
    r = requests.get(f"{ELEVEN}/voices", timeout=30, headers={"xi-api-key": _key("ELEVENLABS_API_KEY")})
    _check(r, "일레븐랩스")
    return [{"id": v["voice_id"], "name": v.get("name"), "gender": (v.get("labels") or {}).get("gender"),
             "age": (v.get("labels") or {}).get("age"), "use_cases": v.get("category", "")}
            for v in r.json().get("voices", [])]


# ------------------------------------------------------------------ OpenAI

def openai_line(text: str, out: Path) -> None:
    c = config.get("voice.openai") or {}
    body = {"model": c.get("model", "gpt-4o-mini-tts"), "voice": c.get("voice", "alloy"), "input": text,
            "response_format": "mp3"}
    if c.get("instructions"):
        body["instructions"] = c["instructions"]
    r = requests.post("https://api.openai.com/v1/audio/speech", json=body, timeout=120,
                      headers={"Authorization": f"Bearer {_key('OPENAI_API_KEY')}"})
    _check(r, "OpenAI")
    out.write_bytes(r.content)


# ------------------------------------------------------------------ 구글 클라우드

def google_line(text: str, out: Path) -> None:
    c = config.get("voice.google") or {}
    body = {"input": {"text": text},
            "voice": {"languageCode": "ko-KR", "name": c.get("voice", "ko-KR-Neural2-A")},
            "audioConfig": {"audioEncoding": "MP3", "speakingRate": c.get("rate", 1.1)}}
    r = requests.post("https://texttospeech.googleapis.com/v1/text:synthesize", json=body, timeout=120,
                      headers={"x-goog-api-key": _key("GOOGLE_TTS_API_KEY")})
    _check(r, "구글 TTS")
    out.write_bytes(base64.b64decode(r.json()["audioContent"]))


LINE = {"typecast": typecast_line, "elevenlabs": eleven_line, "openai": openai_line, "google": google_line}
WHOLE = {"typecast": typecast_whole, "elevenlabs": eleven_whole}
VOICES = {"typecast": typecast_voices, "elevenlabs": eleven_voices}
