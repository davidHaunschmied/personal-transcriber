from groq import Groq

from app.config import Settings


def build_system_prompt(style_guide: str, reference_speeches: list[dict]) -> str:
    parts: list[str] = []
    if style_guide.strip():
        parts.append("## Style guide\n\n" + style_guide.strip())
    for ref in reference_speeches:
        title = ref.get("title", "Untitled")
        content = ref.get("content", "")
        if content.strip():
            parts.append(f"## Reference speech: {title}\n\n{content.strip()}")
    if not parts:
        return "You are a careful editor. Follow the user's instructions exactly."
    return "\n\n---\n\n".join(parts)


def transform(
    *,
    settings: Settings,
    model: str,
    style_guide: str,
    reference_speeches: list[dict],
    user_prompt: str,
    transcript: str,
) -> str:
    client = Groq(api_key=settings.groq_api_key)
    system = build_system_prompt(style_guide, reference_speeches)
    completion = client.chat.completions.create(
        model=model,
        max_tokens=4096,
        messages=[
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": f"{user_prompt.strip()}\n\n### Transcript\n\n{transcript.strip()}",
            },
        ],
    )
    return completion.choices[0].message.content.strip()
