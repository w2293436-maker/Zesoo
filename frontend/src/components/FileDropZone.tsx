import { useState, useRef, useCallback } from "react";

interface FileDropZoneProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
}

const ACCEPTED_TYPES = ".pdf,.txt,.docx";
const ACCEPTED_LABELS: Record<string, string> = {
  pdf: "PDF",
  txt: "TXT",
  docx: "DOCX",
};

export default function FileDropZone({ file, onFileSelect }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getExtension = (filename: string) =>
    filename.split(".").pop()?.toLowerCase() || "";

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDrag = useCallback((e: React.DragEvent, active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(active);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        const ext = getExtension(droppedFile.name);
        if (["pdf", "txt", "docx"].includes(ext)) {
          onFileSelect(droppedFile);
        } else {
          alert(`不支持的文件格式: .${ext}，请上传 PDF / TXT / DOCX 文件`);
        }
      }
    },
    [onFileSelect]
  );

  const handleClick = () => inputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) onFileSelect(selected);
    // 清空 input 以便重复选择同一文件
    e.target.value = "";
  };

  if (file) {
    const ext = getExtension(file.name);
    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-4 shadow-sm">
          {/* 文件图标 */}
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          {/* 文件信息 */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatSize(file.size)}</p>
          </div>
          {/* 格式标签 */}
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500 uppercase">
            {ACCEPTED_LABELS[ext] || ext}
          </span>
          {/* 删除按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFileSelect(null);
            }}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div
        className={`
          relative border-2 border-dashed rounded-2xl p-6 sm:p-12 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
            ? "border-blue-400 bg-blue-50 scale-[1.02]"
            : "border-gray-300 bg-white hover:border-blue-300 hover:bg-gray-50"
          }
        `}
        onDragEnter={(e) => handleDrag(e, true)}
        onDragOver={(e) => handleDrag(e, true)}
        onDragLeave={(e) => handleDrag(e, false)}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* 上传图标 */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>

        <p className="text-base font-medium text-gray-700 mb-1">
          拖拽文件到此处，或<span className="text-blue-500">点击上传</span>
        </p>
        <p className="text-sm text-gray-400">支持 PDF / TXT / DOCX 格式，最大 50MB</p>
      </div>
    </div>
  );
}
