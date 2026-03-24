"""
File service — all file I/O and parsing logic.

This module is intentionally decoupled from FastAPI. Routers call these functions;
nothing here should know about HTTP request/response objects.

Storage strategy: uploaded files are stored as <uuid4>.<ext> in UPLOAD_DIR so that:
  - Original filenames never touch the filesystem (prevents path traversal).
  - File IDs are unguessable (UUID4 ≈ 2^122 possibilities).
  - No naming conflicts are possible.

Registry: _file_registry is an in-memory dict that maps file_id → metadata.
This is intentionally ephemeral for this challenge — a production system would use
a database (PostgreSQL, SQLite, etc.) so that file metadata survives restarts.
"""

import os
import tempfile
import uuid
from pathlib import Path

import pandas as pd

# Use OS-appropriate temp directory — /tmp/uploads doesn't exist on Windows.
# tempfile.gettempdir() returns C:\Users\<user>\AppData\Local\Temp on Windows.
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", os.path.join(tempfile.gettempdir(), "cybersierra_uploads")))
ALLOWED_EXTENSIONS: set[str] = {".csv", ".xls", ".xlsx"}
MAX_FILE_BYTES: int = 50 * 1024 * 1024  # 50 MB

# In-memory registry: { file_id: { file_id, original_filename, sheets, path } }
# NOTE: This is process-local state — intentional for a single-tenant interview app.
_file_registry: dict[str, dict] = {}


def save_upload(file_bytes: bytes, original_filename: str) -> str:
    """Validate, sanitise, and persist an uploaded file. Returns the file_id (UUID)."""

    # 1. Size check — before touching the filesystem
    if len(file_bytes) > MAX_FILE_BYTES:
        raise ValueError(
            f"File '{original_filename}' exceeds the 50 MB limit "
            f"({len(file_bytes) / 1024 / 1024:.1f} MB uploaded)."
        )

    # 2. Extension whitelist — we inspect the sanitised name, NOT Content-Type
    #    (Content-Type is trivially spoofed by the client).
    safe_name = Path(original_filename).name  # strips any directory component
    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"File type '{ext}' is not allowed. "
            f"Accepted types: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
        )

    # 3. UUID-based storage — the original filename is NEVER used as the disk path
    file_id = str(uuid.uuid4())
    stored_path = UPLOAD_DIR / f"{file_id}{ext}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_path.write_bytes(file_bytes)

    # 4. Discover sheet names and update the registry
    sheets = _get_sheet_names_from_path(stored_path, ext)
    _file_registry[file_id] = {
        "file_id": file_id,
        "original_filename": safe_name,
        "sheets": sheets,
        "path": str(stored_path),
        "ext": ext,
    }

    return file_id


def get_sheet_names(file_id: str) -> list[str]:
    entry = _registry_entry(file_id)
    return entry["sheets"]


def load_dataframe(file_id: str, sheet: str) -> pd.DataFrame:
    entry = _registry_entry(file_id)
    path = Path(entry["path"])
    ext = entry["ext"]

    if ext == ".csv":
        return pd.read_csv(path)
    return pd.read_excel(path, sheet_name=sheet)


def get_preview(file_id: str, sheet: str, n: int = 10) -> dict:
    df = load_dataframe(file_id, sheet)
    n = min(n, 1000)  # defence-in-depth cap alongside the Query(le=1000) in the router
    preview = df.head(n)
    return {
        "columns": list(preview.columns),
        "rows": preview.to_dict(orient="records"),
    }


def list_files() -> list[dict]:
    return [
        {"file_id": e["file_id"], "original_filename": e["original_filename"], "sheets": e["sheets"]}
        for e in _file_registry.values()
    ]


def delete_file(file_id: str) -> None:
    """Remove a file from the registry and disk."""
    entry = _registry_entry(file_id)
    path = Path(entry["path"])
    if path.exists():
        path.unlink()
    del _file_registry[file_id]


# --- helpers ---

def _registry_entry(file_id: str) -> dict:
    entry = _file_registry.get(file_id)
    if entry is None:
        raise KeyError(f"File '{file_id}' not found. It may have been lost on server restart.")
    return entry


def _get_sheet_names_from_path(path: Path, ext: str) -> list[str]:
    if ext == ".csv":
        # CSVs have no native sheet concept — expose a single synthetic sheet name
        # so the frontend can treat CSV and Excel files uniformly.
        return ["Sheet1"]
    return pd.ExcelFile(path).sheet_names
