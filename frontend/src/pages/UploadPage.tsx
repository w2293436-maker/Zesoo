import { useState } from "react";
import FileDropZone from "../components/FileDropZone";
import Footer from "../components/Footer";
import LegalPage from "./LegalPage";

interface UploadPageProps {
  onStart: (file: File) => Promise<void>;
  onGoAdmin?: () => void;
}

export default function UploadPage({ onStart, onGoAdmin }: UploadPageProps) {
  const setFileSafe = (f: File | null) => { setFile(f); if (f === null) setAgreed(false); };
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showLegal, setShowLegal] = useState(false);

  const [uploadError, setUploadError] = useState("");

  const handleStart = async () => {
    if (!file) return;
    setLoading(true);
    setUploadError("");
    try {
      await new Promise((r) => setTimeout(r, 300));
      await onStart(file);
    } catch (e: any) {
      setUploadError(e?.message || "上传失败，请检查网络后重试");
    } finally {
      setLoading(false);
    }
  };

  if (showLegal) {
    return <LegalPage onBack={() => setShowLegal(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-4 py-8">
      {/* Logo 区域 */}
      <div className="mb-6 sm:mb-8 flex flex-col items-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800 tracking-tight mb-3 sm:mb-4">
          择书<span className="text-blue-500">Zesoo</span>
        </h1>
        <div className="flex justify-center w-full">
          <div className="translate-x-2">
            <svg className="w-14 h-14 sm:w-16 sm:h-16 mb-2 sm:mb-3" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 8L7 5C5.89543 5 5 5.89543 5 7V35C5 36.1046 5.89543 37 7 37L24 40V8Z" fill="url(#logoGradL)" />
              <path d="M24 8L41 5C42.1046 5 43 5.89543 43 7V35C43 36.1046 42.1046 37 41 37L24 40V8Z" fill="url(#logoGradR)" />
              <line x1="24" y1="8" x2="24" y2="40" stroke="white" strokeWidth="1.5" />
              <rect x="9" y="13" width="10" height="1.5" rx="0.75" fill="white" opacity="0.8" />
              <rect x="9" y="18" width="10" height="1.5" rx="0.75" fill="white" opacity="0.6" />
              <rect x="9" y="23" width="7" height="1.5" rx="0.75" fill="white" opacity="0.5" />
              <rect x="9" y="28" width="8" height="1.5" rx="0.75" fill="white" opacity="0.4" />
              <rect x="29" y="13" width="10" height="1.5" rx="0.75" fill="white" opacity="0.8" />
              <rect x="29" y="18" width="10" height="1.5" rx="0.75" fill="white" opacity="0.6" />
              <rect x="29" y="23" width="7" height="1.5" rx="0.75" fill="white" opacity="0.5" />
              <rect x="29" y="28" width="9" height="1.5" rx="0.75" fill="white" opacity="0.4" />
              <circle cx="37" cy="10" r="2.5" fill="#FBBF24" />
              <path d="M37 5.5V6.5M37 13.5V14.5M33 9.5H34M40 9.5H41M34.2 6.7L34.9 7.4M39.1 11.6L39.8 12.3M39.8 6.7L39.1 7.4M34.9 11.6L34.2 12.3" stroke="#FBBF24" strokeWidth="0.8" strokeLinecap="round" />
              <defs>
                <linearGradient id="logoGradL" x1="5" y1="5" x2="24" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3B82F6" /><stop offset="1" stopColor="#2563EB" />
                </linearGradient>
                <linearGradient id="logoGradR" x1="43" y1="5" x2="24" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#60A5FA" /><stop offset="1" stopColor="#3B82F6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-gray-400 text-center">
          上传书籍文件，AI 自动提炼重点，生成精读报告
        </p>
      </div>

      {/* 上传区域卡片 */}
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-8">
        <FileDropZone file={file} onFileSelect={setFileSafe} />

        {/* 同意条款勾选框 */}
        {file && (
          <label className="flex items-start gap-2 mt-4 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-500 focus:ring-blue-400 flex-shrink-0"
            />
            <span className="text-xs text-gray-500 group-hover:text-gray-600 leading-relaxed">
              我已阅读并同意
              <button
                type="button"
                onClick={() => setShowLegal(true)}
                className="text-blue-500 hover:text-blue-600 underline mx-0.5"
              >
                免责声明
              </button>
              和
              <button
                type="button"
                onClick={() => setShowLegal(true)}
                className="text-blue-500 hover:text-blue-600 underline mx-0.5"
              >
                用户协议
              </button>
              ，AI 生成内容仅供参考，不构成专业建议
            </span>
          </label>
        )}

        <button
          onClick={handleStart}
          disabled={!file || !agreed || loading}
          className={`
            w-full mt-4 sm:mt-6 py-3 rounded-xl text-sm font-semibold
            transition-all duration-200 flex items-center justify-center gap-2
            ${
              file && agreed && !loading
                ? "bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.98] shadow-sm shadow-blue-200"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }
          `}
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              准备中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              开始生成报告
            </>
          )}
        </button>

        {uploadError && (
          <p className="text-xs text-red-500 text-center mt-3">{uploadError}</p>
        )}
      </div>

      <p className="mt-4 sm:mt-6 text-xs text-gray-300">
        支持 PDF · TXT · DOCX 格式，最大 50MB
      </p>

      <Footer onLegalClick={() => setShowLegal(true)} onAdminClick={onGoAdmin} compact />
    </div>
  );
}
