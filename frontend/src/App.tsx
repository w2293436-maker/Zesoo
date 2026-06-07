import { useState } from "react";
import { uploadFile } from "./services/api";
import UploadPage from "./pages/UploadPage";
import ProgressPage from "./pages/ProgressPage";
import ReportPage from "./pages/ReportPage";
import AdminPage from "./pages/AdminPage";

type Page = "upload" | "progress" | "report" | "admin";

interface TaskInfo {
  taskId: string;
  filename: string;
}

export default function App() {
  const [page, setPage] = useState<Page>("upload");
  const [taskInfo, setTaskInfo] = useState<TaskInfo | null>(null);
  const [error, setError] = useState("");

  const handleStart = async (file: File) => {
    setError("");
    try {
      const result = await uploadFile(file);
      setTaskInfo({ taskId: result.task_id, filename: result.filename });
      setPage("progress");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "上传失败，请重试";
      setError(message);
      throw err; // 让 UploadPage 感知失败以重置 loading
    }
  };

  const handleComplete = (_taskId: string) => {
    setPage("report");
  };

  const handleError = (errorMsg: string) => {
    setError(errorMsg);
  };

  const handleRestart = () => {
    setTaskInfo(null);
    setError("");
    setPage("upload");
  };

  const handleGoAdmin = () => setPage("admin");
  const handleBackFromAdmin = () => setPage("upload");

  if (page === "admin") {
    return <AdminPage onBack={handleBackFromAdmin} />;
  }

  if (page === "upload") {
    return (
      <>
        <UploadPage onStart={handleStart} onGoAdmin={handleGoAdmin} />
        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-5 py-3 shadow-lg">
            {error}
            <button
              onClick={() => setError("")}
              className="ml-3 text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        )}
      </>
    );
  }

  if (page === "progress" && taskInfo) {
    return (
      <ProgressPage
        taskId={taskInfo.taskId}
        filename={taskInfo.filename}
        onComplete={handleComplete}
        onError={handleError}
      />
    );
  }

  if (page === "report" && taskInfo) {
    return (
      <ReportPage
        taskId={taskInfo.taskId}
        onRestart={handleRestart}
        onGoAdmin={handleGoAdmin}
      />
    );
  }

  return <UploadPage onStart={handleStart} onGoAdmin={handleGoAdmin} />;
}
