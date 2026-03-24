"""AI service for intent routing, Q&A, and chart generation."""

import json
import os
import re
from typing import Any

import pandas as pd


_DATAFRAME_PREVIEW_ROWS = 20
_DATAFRAME_PREVIEW_COLUMNS = 20


def _classify_intent_type(prompt: str, api_key: str) -> str:
    """
    Ask GPT-4o-mini to classify prompt intent.
    Returns one of: "viz", "text", "both".
    """
    try:
        import openai

        client = openai.OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You classify data prompts. Return JSON only and no markdown.\n"
                        'Allowed output schema: {"type":"viz"|"text"|"both"}.\n'
                        "Rules:\n"
                        "- viz: chart/plot requested with little or no prose\n"
                        "- text: explanation, stats, or Q&A only\n"
                        "- both: user asks for explanation and visualization together"
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0,
            max_tokens=30,
        )
        content = (response.choices[0].message.content or "").strip().strip("`").strip()
        if content.startswith("json"):
            content = content[4:].strip()
        parsed = json.loads(content)
        if parsed.get("type") in {"viz", "text", "both"}:
            return parsed["type"]
        return "text"
    except Exception:
        return "text"


def _build_dataframe_context(df: pd.DataFrame) -> str:
    preview = df.iloc[:_DATAFRAME_PREVIEW_ROWS, :_DATAFRAME_PREVIEW_COLUMNS]
    columns_text = ", ".join(f"{col} ({dtype})" for col, dtype in zip(df.columns, df.dtypes))
    preview_csv = preview.to_csv(index=False)
    return (
        f"Rows: {len(df)}\n"
        f"Columns: {len(df.columns)}\n"
        f"Schema: {columns_text}\n"
        f"Preview (first {len(preview)} rows, up to {_DATAFRAME_PREVIEW_COLUMNS} cols):\n"
        f"{preview_csv}"
    )


def _patch_pandasai() -> None:
    """Apply compatibility patches for PandasAI + pydantic v2 + newer OpenAI models."""
    try:
        import pydantic

        if int(pydantic.VERSION.split(".")[0]) >= 2:
            from typing import Optional
            from pandasai.schemas.df_config import Config, LogServerConfig

            field = Config.model_fields.get("log_server")
            if field is not None and field.annotation is LogServerConfig:
                field.annotation = Optional[LogServerConfig]
                field.metadata = []
                Config.model_rebuild(force=True)
    except Exception:
        pass

    try:
        from pandasai.llm.openai import OpenAI as PandasAIOpenAI

        for model in ("gpt-4o", "gpt-4o-mini", "gpt-4-turbo"):
            if model not in PandasAIOpenAI._supported_chat_models:
                PandasAIOpenAI._supported_chat_models.append(model)
    except Exception:
        pass


def _run_pandasai_text(df: pd.DataFrame, prompt: str, api_key: str) -> str:
    _patch_pandasai()

    from pandasai import SmartDataframe
    from pandasai.llm.openai import OpenAI as PandasAIOpenAI

    llm = PandasAIOpenAI(api_token=api_key, model="gpt-4o")
    smart_df = SmartDataframe(
        df,
        config={
            "llm": llm,
            "verbose": False,
            "enable_cache": False,
            "save_charts": False,
            "custom_whitelisted_dependencies": [],
        },
    )

    result = smart_df.chat(prompt)
    if isinstance(result, str) and os.path.isfile(result):
        return "The AI produced a file output."
    if result is None:
        return "The AI returned an empty response."
    return str(result)


def _chart_from_figure(chart: Any) -> dict | None:
    figure = getattr(chart, "figure", None)
    if figure is None or not hasattr(figure, "to_dict"):
        return None
    fig_dict = figure.to_dict()
    if isinstance(fig_dict, dict) and "data" in fig_dict:
        return {"plotly_json": fig_dict}
    return None


def _chart_from_spec(chart: Any) -> dict | None:
    spec = getattr(chart, "spec", None)
    if isinstance(spec, dict) and "data" in spec:
        return {"plotly_json": spec}
    return None


def _chart_from_code(chart: Any, df: pd.DataFrame) -> dict | None:
    code = getattr(chart, "code", None)
    if not (isinstance(code, str) and code.strip()):
        return None

    import plotly.express as px
    import plotly.graph_objects as go

    scope: dict[str, Any] = {"df": df, "pd": pd, "px": px, "go": go}
    exec(code, scope)
    for value in scope.values():
        if hasattr(value, "to_dict"):
            fig_dict = value.to_dict()
            if isinstance(fig_dict, dict) and "data" in fig_dict:
                return {"plotly_json": fig_dict}
    return None


def _extract_lida_chart(chart: Any, df: pd.DataFrame) -> dict | None:
    for extractor in (_chart_from_figure, _chart_from_spec):
        parsed = extractor(chart)
        if parsed is not None:
            return parsed
    return _chart_from_code(chart, df)


def _run_lida_viz(df: pd.DataFrame, prompt: str, api_key: str) -> dict | None:
    import openai
    from lida import Manager, TextGenerationConfig
    from lida.datamodel import Goal

    openai.api_key = api_key

    manager = Manager()
    config = TextGenerationConfig(n=1, temperature=0.2, use_cache=False)
    summary = manager.summarize(df, summary_method="default", textgen_config=config)
    goal = Goal(question=prompt, visualization=prompt, rationale="User requested visualization")
    charts = manager.visualize(
        summary=summary,
        goal=goal,
        textgen_config=config,
        library="plotly",
    )

    if not charts:
        return None

    chart = charts[0]
    return _extract_lida_chart(chart, df)


def _synthesize_final_text(
    prompt: str,
    query_type: str,
    df: pd.DataFrame,
    pandasai_text: str | None,
    chart: dict | None,
    api_key: str,
) -> str:
    import openai

    client = openai.OpenAI(api_key=api_key)
    dataset_context = _build_dataframe_context(df)

    tool_summary = {
        "query_type": query_type,
        "pandasai_text": pandasai_text,
        "chart_generated": chart is not None,
        "chart_keys": list((chart or {}).keys()),
    }

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a data assistant. Compose a concise final answer for the user. "
                    "Do not mention whether chart generation succeeded or failed. "
                    "Focus on the data insights only."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"User prompt: {prompt}\n\n"
                    f"Dataset context:\n{dataset_context}\n\n"
                    f"Tool outputs:\n{json.dumps(tool_summary, ensure_ascii=True)}"
                ),
            },
        ],
        temperature=0.2,
        max_tokens=500,
    )
    content = (response.choices[0].message.content or "").strip()
    if content:
        return content

    if pandasai_text:
        return pandasai_text

    if query_type in {"viz", "both"} and chart is None:
        return "I could not generate a chart for this request."

    return "I could not produce a response for that question."


def _normalize_chart_status_text(text: str, chart: dict | None) -> str:
    """Remove chart generation status statements from user-visible text."""
    del chart

    # Remove explicit chart-generation status statements while preserving insights.
    cleaned = text
    patterns = (
        r"(?is)\bthe\s+request\s+for\s+visualization-oriented\s+data\s+cannot\s+be\s+fulfilled[^.?!]*[.?!]?",
        r"(?is)\bchart\s+generation\s+(?:has\s+)?(?:failed|succeeded)[^.?!]*[.?!]?",
        r"(?is)\bfailed\s+to\s+generate\s+(?:a\s+)?chart[^.?!]*[.?!]?",
        r"(?is)\bcould\s+not\s+generate\s+(?:a\s+)?chart[^.?!]*[.?!]?",
        r"(?is)\bunable\s+to\s+generate\s+(?:a\s+)?chart[^.?!]*[.?!]?",
        r"(?is)\bchart\s+was\s+not\s+generated[^.?!]*[.?!]?",
        r"(?is)\bno\s+chart\s+was\s+generated[^.?!]*[.?!]?",
        r"(?is)\bchart\s+was\s+generated[^.?!]*[.?!]?",
    )
    for pattern in patterns:
        cleaned = re.sub(pattern, "", cleaned)

    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

    if cleaned:
        return cleaned
    return "Here are the key insights from your data question."


def run_query(df: pd.DataFrame, prompt: str, dataset_description: str = "") -> dict:
    """
    Run a natural language query against a DataFrame.

    Returns a unified response payload for API schema mapping.
    """
    del dataset_description

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Add it to your .env file and restart the server."
        )

    query_type = _classify_intent_type(prompt, api_key)
    needs_text = query_type in {"text", "both"}
    needs_chart = query_type in {"viz", "both"}

    pandasai_text: str | None = None
    chart: dict | None = None

    if needs_text:
        try:
            pandasai_text = _run_pandasai_text(df, prompt, api_key)
        except Exception as exc:
            pandasai_text = f"PandasAI could not complete this request ({type(exc).__name__})."

    if needs_chart:
        try:
            chart = _run_lida_viz(df, prompt, api_key)
        except Exception:
            chart = None

    final_text = _synthesize_final_text(
        prompt=prompt,
        query_type=query_type,
        df=df,
        pandasai_text=pandasai_text,
        chart=chart,
        api_key=api_key,
    )
    final_text = _normalize_chart_status_text(final_text, chart)

    response_type = query_type
    if query_type in {"viz", "both"} and chart is None:
        response_type = "text"

    return {"type": response_type, "text": final_text, "chart": chart}


def build_dataset_description(df: pd.DataFrame) -> str:
    rows, cols = df.shape
    col_info = ", ".join(f"{col} ({dtype})" for col, dtype in zip(df.columns, df.dtypes))
    return f"The dataset has {rows} rows and {cols} columns: {col_info}."
