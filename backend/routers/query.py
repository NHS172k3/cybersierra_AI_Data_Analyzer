from fastapi import APIRouter, HTTPException

from models.schemas import FeedbackResponse, PatchPromptRequest, QueryRequest, QueryResponse
from services import ai_service, file_service, prompt_store

router = APIRouter()
prompt_store.initialize()


@router.post("/query", response_model=QueryResponse)
def run_query(request: QueryRequest) -> QueryResponse:
    """
    Run a natural language query against an uploaded dataset and persist
    the resulting prompt record for replay and feedback updates.
    """
    try:
        df = file_service.load_dataframe(request.file_id, request.sheet)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        result = ai_service.run_query(df, request.prompt)
    except RuntimeError as exc:
        # RuntimeError means a configuration problem (missing API key) — 500
        raise HTTPException(status_code=500, detail=str(exc))

    prompt_id = prompt_store.create_prompt_record(
        prompt=request.prompt,
        query_type=result["type"],
        text=result["text"],
        chart_plotly_json=(result.get("chart") or {}).get("plotly_json") if result.get("chart") else None,
        file_id=request.file_id,
        sheet=request.sheet,
    )

    return QueryResponse(
        prompt_id=prompt_id,
        type=result["type"],
        text=result["text"],
        chart=result.get("chart"),
        feedback=None,
    )


@router.patch("/prompts/{prompt_id}", response_model=FeedbackResponse)
def patch_prompt_feedback(prompt_id: str, request: PatchPromptRequest) -> FeedbackResponse:
    """
    Update thumbs-up / thumbs-down feedback on a stored prompt record.
    """
    updated = prompt_store.update_feedback(prompt_id, request.feedback)
    if not updated:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return FeedbackResponse(ok=True)
