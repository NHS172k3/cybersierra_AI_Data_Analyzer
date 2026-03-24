/**
 * Central API service.
 *
 * All network calls go through this module — no component should call fetch() directly.
 * This ensures a single place to handle auth headers, error normalisation, and base URLs.
 */

// --- Types ---

export interface UploadedFile {
  file_id: string
  original_filename: string
  sheets: string[]
}

export interface UploadResponse {
  files: UploadedFile[]
}

export interface FileListResponse {
  files: UploadedFile[]
}

export interface PreviewResponse {
  columns: string[]
  rows: Record<string, unknown>[]
}

export interface QueryRequest {
  file_id: string
  sheet: string
  prompt: string
}

export interface ChartPayload {
  plotly_json: Record<string, unknown>
}

export interface QueryResponse {
  prompt_id: string
  type: 'viz' | 'text' | 'both'
  text: string
  chart: ChartPayload | null
  feedback: 'thumbs_up' | 'thumbs_down' | null
}

export interface PatchPromptFeedbackRequest {
  feedback: 'thumbs_up' | 'thumbs_down'
}

export interface FeedbackResponse {
  ok: boolean
}

// --- Error class ---

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// --- Helpers ---

async function checkResponse(response: Response): Promise<void> {
  if (!response.ok) {
    let message: string
    try {
      const json = await response.json()
      message = json.detail || json.message || response.statusText
    } catch {
      message = await response.text().catch(() => response.statusText)
    }
    throw new ApiError(response.status, message)
  }
}

// --- API functions ---

export async function uploadFiles(files: File[]): Promise<UploadResponse> {
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }
  const response = await fetch('/api/upload', { method: 'POST', body: formData })
  await checkResponse(response)
  return response.json() as Promise<UploadResponse>
}

export async function listFiles(): Promise<FileListResponse> {
  const response = await fetch('/api/files')
  await checkResponse(response)
  return response.json() as Promise<FileListResponse>
}

export async function getPreview(
  fileId: string,
  sheet: string,
  n: number,
  signal?: AbortSignal,
): Promise<PreviewResponse> {
  const params = new URLSearchParams({ file_id: fileId, sheet, n: String(n) })
  const response = await fetch(`/api/preview?${params.toString()}`, { signal })
  await checkResponse(response)
  return response.json() as Promise<PreviewResponse>
}

export async function runQuery(payload: QueryRequest, signal?: AbortSignal): Promise<QueryResponse> {
  const response = await fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
  await checkResponse(response)
  return response.json() as Promise<QueryResponse>
}

export async function deleteFile(fileId: string): Promise<void> {
  const response = await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
  await checkResponse(response)
}

export async function patchPromptFeedback(
  promptId: string,
  payload: PatchPromptFeedbackRequest,
): Promise<FeedbackResponse> {
  const response = await fetch(`/api/prompts/${promptId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  await checkResponse(response)
  return response.json() as Promise<FeedbackResponse>
}
