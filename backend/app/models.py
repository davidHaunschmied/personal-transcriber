from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RecordingStatus = Literal["uploaded", "transcribing", "transcribed", "failed"]
TransformationStatus = Literal["pending", "running", "done", "failed"]


class StyleGuide(BaseModel):
    content: str = ""
    updated_at: datetime | None = None


class StyleGuideUpdate(BaseModel):
    content: str


class ReferenceSpeech(BaseModel):
    id: str
    title: str
    content: str
    created_at: datetime


class ReferenceSpeechCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)


class PromptTemplate(BaseModel):
    id: str
    name: str
    prompt: str
    model: str
    is_default: bool
    created_at: datetime


class PromptTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    prompt: str = Field(min_length=1)
    model: str | None = None
    is_default: bool = False


class PromptTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    prompt: str | None = Field(default=None, min_length=1)
    model: str | None = None
    is_default: bool | None = None


class Recording(BaseModel):
    id: str
    original_filename: str
    storage_path: str
    duration_seconds: float | None = None
    status: RecordingStatus
    transcript: str | None = None
    error: str | None = None
    created_at: datetime


class RecordingRegister(BaseModel):
    original_filename: str = Field(min_length=1, max_length=255)


class RecordingRegistered(BaseModel):
    recording: Recording
    upload_url: str
    upload_token: str
    storage_path: str


class Transformation(BaseModel):
    id: str
    recording_id: str
    template_id: str | None
    prompt_used: str
    model: str
    output: str | None
    status: TransformationStatus
    error: str | None
    created_at: datetime


class TransformationCreate(BaseModel):
    recording_id: str
    template_id: str | None = None
    prompt: str | None = Field(default=None, min_length=1)
    model: str | None = None
