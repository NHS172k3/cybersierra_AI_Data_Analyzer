import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

_DB_LOCK = threading.Lock()
_DB_PATH = os.getenv("CYBERSIERRA_DB_PATH", os.path.join(os.getcwd(), "cybersierra.db"))


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def initialize() -> None:
    with _DB_LOCK:
        with _conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS prompts (
                    prompt_id TEXT PRIMARY KEY,
                    prompt TEXT NOT NULL,
                    query_type TEXT NOT NULL,
                    text TEXT NOT NULL,
                    chart_json TEXT,
                    feedback TEXT,
                    file_id TEXT NOT NULL,
                    sheet TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.commit()


def create_prompt_record(*, prompt: str, query_type: str, text: str, chart_plotly_json: dict[str, Any] | None,
                         file_id: str, sheet: str) -> str:
    prompt_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    chart_json = json.dumps(chart_plotly_json) if chart_plotly_json is not None else None

    with _DB_LOCK:
        with _conn() as conn:
            conn.execute(
                """
                INSERT INTO prompts (
                    prompt_id, prompt, query_type, text, chart_json, feedback,
                    file_id, sheet, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    prompt_id,
                    prompt,
                    query_type,
                    text,
                    chart_json,
                    None,
                    file_id,
                    sheet,
                    now,
                    now,
                ),
            )
            conn.commit()

    return prompt_id


def update_feedback(prompt_id: str, feedback: str) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    with _DB_LOCK:
        with _conn() as conn:
            cursor = conn.execute(
                "UPDATE prompts SET feedback = ?, updated_at = ? WHERE prompt_id = ?",
                (feedback, now, prompt_id),
            )
            conn.commit()
            return cursor.rowcount > 0


def get_feedback(prompt_id: str) -> str | None:
    with _DB_LOCK:
        with _conn() as conn:
            row = conn.execute("SELECT feedback FROM prompts WHERE prompt_id = ?", (prompt_id,)).fetchone()
            if row is None:
                return None
            return row["feedback"]
