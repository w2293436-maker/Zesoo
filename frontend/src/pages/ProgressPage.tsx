import { useEffect, useState, useRef } from "react";
import { subscribeProgress } from "../services/api";
import type { ProgressData } from "../services/api";
import ProgressStepper from "../components/ProgressStepper";

interface ProgressPageProps {
  taskId: string;
  filename: string;
  onComplete: (taskId: string) => void;
  onError: (error: string) => void;
}

export default function ProgressPage({
  taskId,
  filename,
  onComplete,
  onError,
}: ProgressPageProps) {
  const [progressData, setProgressData] = useState<ProgressData>({
    progress: 0,
    step: "upload",
    detail: "正在准备...",
    status: "uploaded",
  });
  const closeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const close = subscribeProgress(
      taskId,
      // 进度更新
      (data) => setProgressData(data),
      // 完成
      (data) => {
        setProgressData(data);
        // 短暂延迟后跳转
        setTimeout(() => onComplete(taskId), 800);
      },
      // 出错
      (error) => onError(error)
    );

    closeRef.current = close;

    return () => {
      if (closeRef.current) closeRef.current();
    };
  }, [taskId, onComplete, onError]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-4 py-8">
      {/* 状态图标 */}
      <div className="mb-8 flex flex-col items-center">
        {progressData.status === "failed" ? (
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
        ) : progressData.status === "completed" ? (
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-500 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        <h1 className="text-xl font-bold text-gray-800">
          {progressData.status === "failed"
            ? "处理失败"
            : progressData.status === "completed"
            ? "报告生成完成！"
            : "正在生成精读报告..."}
        </h1>
        <p className="text-sm text-gray-400 mt-1 truncate max-w-sm">{filename}</p>
      </div>

      {/* 进度组件 */}
      <div className="w-full max-w-lg">
        <ProgressStepper
          progress={progressData.progress}
          step={progressData.step}
          detail={progressData.detail}
        />
      </div>

      {/* 错误时显示重试按钮 */}
      {progressData.status === "failed" && progressData.error && (
        <div className="mt-8 text-center">
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4 max-w-lg">
            <p className="text-sm text-red-600">{progressData.error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            重新上传
          </button>
        </div>
      )}
    </div>
  );
}
