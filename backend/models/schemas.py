from typing import Any, Literal
from pydantic import BaseModel


# --- Upload ---

class UploadedFile(BaseModel):
    file_id: str
    original_filename: str
    sheets: list[str]


class UploadResponse(BaseModel):
    files: list[UploadedFile]


class FileListResponse(BaseModel):
    files: list[UploadedFile]


# --- Preview ---

class PreviewResponse(BaseModel):
    columns: list[str]
    rows: list[dict]


# --- Query ---

class QueryRequest(BaseModel):
    file_id: str
    sheet: str
    prompt: str


class ChartPayload(BaseModel):
    plotly_json: dict[str, Any]


class QueryResponse(BaseModel):
    prompt_id: str
    type: Literal["viz", "text", "both"]
    text: str
    chart: ChartPayload | None = None
    feedback: Literal["thumbs_up", "thumbs_down"] | None = None


# --- Feedback ---

class PatchPromptRequest(BaseModel):
    feedback: Literal["thumbs_up", "thumbs_down"]


class FeedbackResponse(BaseModel):
    ok: bool
