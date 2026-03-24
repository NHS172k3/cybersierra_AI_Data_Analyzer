from fastapi import APIRouter, HTTPException, Query

from models.schemas import PreviewResponse
from services import file_service

router = APIRouter()


@router.get("/preview", response_model=PreviewResponse)
def get_preview(
    file_id: str,
    sheet: str,
    n: int = Query(default=10, ge=1, le=1000, description="Number of rows to return (1–1000)"),
) -> PreviewResponse:
    """
    Return the top N rows of a sheet.
    n is bounded at the router layer (ge=1, le=1000) AND capped again in the service
    layer for defence-in-depth.
    """
    try:
        data = file_service.get_preview(file_id, sheet, n)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return PreviewResponse(**data)
