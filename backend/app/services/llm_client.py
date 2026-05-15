from anthropic import Anthropic

from app.config import Settings


def build_system_blocks(style_guide: str, reference_speeches: list[dict]) -> list[dict]:
    """Build cacheable system blocks: style guide + reference speeches.

    The whole system context is the same across many transformations for one user,
    so we mark the final block as ephemeral-cacheable. Anthropic caches the prefix,
    cutting cost on repeated runs.
    """
    parts: list[str] = []
    if style_guide.strip():
        parts.append("## Style guide\n\n" + style_guide.strip())
    for ref in reference_speeches:
        title = ref.get("title", "Untitled")
        content = ref.get("content", "")
        if content.strip():
            parts.append(f"## Reference speech: {title}\n\n{content.strip()}")
    if not parts:
        parts.append("You are a careful editor. Follow the user's instructions exactly.")
    text = "\n\n---\n\n".join(parts)
    return [{"type": "text", "text": text, "cache_control": {"type": "ephemeral"}}]


def transform(
    *,
    settings: Settings,
    model: str,
    style_guide: str,
    reference_speeches: list[dict],
    user_prompt: str,
    transcript: str,
) -> str:
    client = Anthropic(api_key=settings.anthropic_api_key)
    system = build_system_blocks(style_guide, reference_speeches)
    message = client.messages.create(
        model=model,
        max_tokens=4096,
        system=system,
        messages=[
            {
                "role": "user",
                "content": (
                    f"{user_prompt.strip()}\n\n"
                    f"### Transcript\n\n{transcript.strip()}"
                ),
            }
        ],
    )
    chunks = [block.text for block in message.content if getattr(block, "type", None) == "text"]
    return "".join(chunks).strip()
