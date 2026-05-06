import tempfile
import os

_model = None

def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel("small", device="cpu", compute_type="int8")
    return _model

def transcribe(audio_bytes: bytes, suffix: str = ".mp3") -> str:
    model = _get_model()
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        segments, _ = model.transcribe(tmp_path)
        return " ".join(seg.text.strip() for seg in segments)
    finally:
        os.unlink(tmp_path)
