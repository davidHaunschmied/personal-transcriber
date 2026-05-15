from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import recordings, style, templates, transformations

settings = get_settings()

app = FastAPI(title="personal-transcriber", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(style.router, prefix="/api/style", tags=["style"])
app.include_router(templates.router, prefix="/api/templates", tags=["templates"])
app.include_router(recordings.router, prefix="/api/recordings", tags=["recordings"])
app.include_router(transformations.router, prefix="/api/transformations", tags=["transformations"])
