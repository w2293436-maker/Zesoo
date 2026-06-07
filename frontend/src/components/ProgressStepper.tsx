interface ProgressStepperProps {
  progress: number;
  step: string;
  detail: string;
}

const STEPS = [
  { key: "upload", label: "上传文件", icon: "📤" },
  { key: "parse", label: "解析文件", icon: "📄" },
  { key: "chunk", label: "分段处理", icon: "✂️" },
  { key: "analyze", label: "AI 分析中", icon: "🧠" },
  { key: "summarize", label: "生成报告", icon: "📝" },
  { key: "done", label: "完成", icon: "✅" },
];

export default function ProgressStepper({ progress, step, detail }: ProgressStepperProps) {
  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* 进度条 */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-gray-600">处理进度</span>
          <span className="text-sm font-bold text-blue-500">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 步骤列表 */}
      <div className="space-y-2">
        {STEPS.map((s, i) => {
          const isDone = i < currentStepIndex;
          const isCurrent = i === currentStepIndex;
          const isPending = i > currentStepIndex;

          return (
            <div
              key={s.key}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isCurrent ? "bg-blue-50" : ""
              }`}
            >
              {/* 状态图标 */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                  isDone
                    ? "bg-green-100 text-green-600"
                    : isCurrent
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {isDone ? "✅" : s.icon}
              </div>

              {/* 步骤文字 */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    isDone ? "text-green-600" : isCurrent ? "text-blue-600" : "text-gray-400"
                  }`}
                >
                  {s.label}
                </p>
                {isCurrent && detail && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{detail}</p>
                )}
              </div>

              {/* 进行中动画 */}
              {isCurrent && step !== "done" && (
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 loading-dot" style={{ animationDelay: "0s" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 loading-dot" style={{ animationDelay: "0.2s" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 loading-dot" style={{ animationDelay: "0.4s" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
