import os
from openai import OpenAI

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    return _client

def transcribe(audio_bytes: bytes, suffix: str = ".mp3") -> str:
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        with open(tmp_path, "rb") as f:
            result = _get_client().audio.transcriptions.create(
                model="whisper-1",
                file=(f"audio{suffix}", f, "audio/mpeg"),
            )
        return result.text
    finally:
        os.unlink(tmp_path)
