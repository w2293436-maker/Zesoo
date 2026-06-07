/**
 * 后端 API 调用封装
 */

// 开发环境用 Vite proxy，生产环境用环境变量或同域
const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface UploadResult {
  task_id: string;
  filename: string;
  size_mb: number;
  status: string;
}

export interface ProgressData {
  progress: number;
  step: string;
  detail: string;
  status: string;
  error?: string;
}

export interface ChapterData {
  chapter_name: string;
  summary: string;
  core_ideas: { idea: string; elaboration: string }[];
  quotes: { text: string; context: string }[];
  methodology: { name: string; description: string; steps: string[] }[];
  actionable_insights: { insight: string; action: string }[];
}

export interface ReportData {
  task_id: string;
  filename: string;
  text_stats: {
    chars: number;
    estimated_tokens: number;
    lines: number;
    needs_chunking: boolean;
  };
  report: {
    book_title: string;
    chapters: ChapterData[];
  };
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const resp = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.detail || "上传失败");
  }

  return resp.json();
}

export function subscribeProgress(
  taskId: string,
  onProgress: (data: ProgressData) => void,
  onDone: (data: ProgressData) => void,
  onError: (error: string) => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/progress/${taskId}`);

  eventSource.addEventListener("progress", (event) => {
    const data = JSON.parse(event.data) as ProgressData;
    onProgress(data);
  });

  eventSource.addEventListener("completed", (event) => {
    const data = JSON.parse(event.data) as ProgressData;
    onDone(data);
    eventSource.close();
  });

  eventSource.addEventListener("failed", (event) => {
    const data = JSON.parse(event.data) as ProgressData;
    onError(data.error || "处理失败");
    eventSource.close();
  });

  eventSource.onerror = () => {
    onError("连接中断，请刷新重试");
    eventSource.close();
  };

  return () => eventSource.close();
}

export async function getReport(taskId: string): Promise<ReportData> {
  const resp = await fetch(`${API_BASE}/report/${taskId}`);

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.detail || "获取报告失败");
  }

  return resp.json();
}

export function getExportUrl(taskId: string): string {
  return `${API_BASE}/export/${taskId}`;
}
