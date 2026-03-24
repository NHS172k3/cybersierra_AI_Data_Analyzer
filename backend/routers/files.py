from fastapi import APIRouter, File, HTTPException, UploadFile

from models.schemas import FileListResponse, UploadedFile, UploadResponse
from services import file_service

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_files(files: list[UploadFile] = File(...)) -> UploadResponse:
    """
    Upload one or more CSV or Excel files.
    Files are validated server-side (extension whitelist, 50 MB size cap) and stored
    as UUID-named files in the temp directory. Original filenames are sanitised and
    stored only in the in-memory registry for display purposes.
    """
    uploaded: list[UploadedFile] = []

    for file in files:
        try:
            file_bytes = await file.read()
            file_id = file_service.save_upload(file_bytes, file.filename or "upload")
            sheets = file_service.get_sheet_names(file_id)
            uploaded.append(
                UploadedFile(
                    file_id=file_id,
                    original_filename=file_service._file_registry[file_id]["original_filename"],
                    sheets=sheets,
                )
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        finally:
            await file.close()

    return UploadResponse(files=uploaded)


@router.get("/files", response_model=FileListResponse)
def list_files() -> FileListResponse:
    """List all files uploaded in the current server session."""
    entries = file_service.list_files()
    return FileListResponse(
        files=[UploadedFile(**entry) for entry in entries]
    )


@router.delete("/files/{file_id}")
def delete_file(file_id: str) -> dict:
    """Delete an uploaded file from the registry and disk."""
    try:
        file_service.delete_file(file_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"ok": True}
