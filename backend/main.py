import os
import tempfile
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env before any other module reads os.environ
load_dotenv()

from routers import files as files_router
from routers import preview as preview_router
from routers import query as query_router

UPLOAD_DIR = os.getenv(
    "UPLOAD_DIR",
    os.path.join(tempfile.gettempdir(), "cybersierra_uploads")
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create the temp upload directory on startup.
    # In production this would be replaced with a proper storage backend (S3, etc.).
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    yield
    # Intentionally not cleaning up uploads on shutdown — files persist across restarts
    # for the duration of a session. A production system would use TTL-based cleanup.


app = FastAPI(
    title="Cyber Sierra API",
    version="1.0.0",
    description="AI-powered data exploration — upload CSV/Excel, ask natural language questions.",
    lifespan=lifespan,
)

# CORS: configurable via CORS_ORIGINS env var (comma-separated).
# Defaults to the Vite dev server. Never use "*" — that allows any site.
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files_router.router, prefix="/api")
app.include_router(preview_router.router, prefix="/api")
app.include_router(query_router.router, prefix="/api")


@app.get("/")
def health_check() -> dict:
    return {"status": "ok"}
