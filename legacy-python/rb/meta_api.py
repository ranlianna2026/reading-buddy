"""Minimal Meta Model API client (Muse Spark chat completions with JSON schema + vision).

Adapted from mechanical-reviewer/mechreview/meta_api.py. Reads MODEL_API_KEY from the env or .env.
"""
import base64, json, os, random, time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]


def _load_dotenv():
    p = ROOT / ".env"
    if p.exists():
        for line in p.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()
BASE_URL = os.environ.get("META_BASE_URL", "https://api.meta.ai/v1")
SPARK = os.environ.get("RB_SPARK_MODEL", "muse-spark-1.3")
RETRY = {429, 500, 502, 503, 504}


class APIError(RuntimeError):
    pass


def data_url(data: bytes, mime="image/jpeg"):
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def chat_json(system, text, schema, name, images=(), effort="low", timeout=90):
    """One Muse Spark call; `images` are data URLs. Returns the parsed JSON object."""
    if not os.environ.get("MODEL_API_KEY"):
        raise APIError("set MODEL_API_KEY in .env")
    content = [{"type": "text", "text": text}] + [{"type": "image_url", "image_url": {"url": u}} for u in images]
    payload = {"model": SPARK, "reasoning_effort": effort,
               "messages": [{"role": "system", "content": system}, {"role": "user", "content": content}],
               "response_format": {"type": "json_schema", "json_schema": {"name": name, "schema": schema}}}
    headers = {"Authorization": f"Bearer {os.environ['MODEL_API_KEY']}"}
    delay = 0.5
    for _ in range(5):
        try:
            r = httpx.post(BASE_URL + "/chat/completions", json=payload, headers=headers, timeout=timeout)
        except httpx.TransportError:
            r = None
        if r is not None and r.status_code not in RETRY:
            if r.status_code >= 400:
                raise APIError(f"{r.status_code}: {r.text[:300]}")
            msg = (r.json().get("choices") or [{}])[0].get("message") or {}
            c = msg.get("content")
            if isinstance(c, list):
                c = "".join(p.get("text", "") for p in c if isinstance(p, dict))
            try:
                return json.loads(c)
            except (TypeError, json.JSONDecodeError):
                start = c.find("{") if isinstance(c, str) else -1
                if start >= 0:
                    return json.JSONDecoder().raw_decode(c[start:])[0]
                raise APIError(f"{name}: no JSON in response")
        time.sleep(delay * (1 + random.random()))
        delay *= 2
    raise APIError(f"{name}: gave up after retries")
