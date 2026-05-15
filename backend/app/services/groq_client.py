from groq import Groq

from app.config import Settings


def transcribe(audio_bytes: bytes, filename: str, settings: Settings) -> str:
    client = Groq(api_key=settings.groq_api_key)
    result = client.audio.transcriptions.create(
        model=settings.whisper_model,
        file=(filename, audio_bytes),
        response_format="text",
    )
    if isinstance(result, str):
        return result
    return getattr(result, "text", str(result))
