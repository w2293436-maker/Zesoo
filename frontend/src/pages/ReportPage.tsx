import { useEffect, useState } from "react";
import { getReport, getExportUrl } from "../services/api";
import type { ReportData } from "../services/api";
import ReportSidebar from "../components/ReportSidebar";
import ReportContent from "../components/ReportContent";
import Footer from "../components/Footer";
import LegalPage from "./LegalPage";

interface ReportPageProps {
  taskId: string;
  onRestart: () => void;
  onGoAdmin?: () => void;
}

export default function ReportPage({ taskId, onRestart, onGoAdmin }: ReportPageProps) {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeChapter, setActiveChapter] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLegal, setShowLegal] = useState(false);

  useEffect(() => {
    getReport(taskId)
      .then((data) => {
        setReportData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [taskId]);

  const handleExport = () => {
    setExporting(true);
    const url = getExportUrl(taskId);
    // 用隐藏 iframe 触发下载，PC和手机浏览器都兼容
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(() => {
      document.body.removeChild(iframe);
      setExporting(false);
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">加载报告中...</p>
        </div>
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-sm text-red-600 mb-4">{error || "加载失败"}</p>
          <button onClick={onRestart} className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            重新上传
          </button>
        </div>
      </div>
    );
  }

  const { report } = reportData;
  const chapters = report.chapters || [];
  const currentChapter = chapters[activeChapter];

  if (showLegal) {
    return <LegalPage onBack={() => setShowLegal(false)} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 顶部工具栏 */}
      <header className="bg-white border-b border-gray-100 px-3 sm:px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onRestart}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            title="重新上传"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          {/* 移动端：章节切换按钮 */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="sm:hidden flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-50 text-gray-600 text-sm"
          >
            <span className="truncate max-w-[120px]">{currentChapter?.chapter_name || "章节"}</span>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold text-gray-800">
              《{report.book_title}》精读报告
            </h1>
            {reportData.text_stats && (
              <p className="text-xs text-gray-400">
                原文 {reportData.text_stats.chars.toLocaleString()} 字 · 共 {chapters.length} 章
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex-shrink-0 ${
            exporting
              ? "bg-green-50 text-green-600"
              : "bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.98] shadow-sm"
          }`}
        >
          {exporting ? "下载中..." : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span className="hidden sm:inline">导出 Word</span>
            </>
          )}
        </button>
      </header>

      {/* 主内容区 */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* 侧边栏：桌面端始终显示，移动端弹窗 */}
        <div className={`
          sm:hidden
          ${sidebarOpen ? "fixed inset-0 z-30 bg-black/30" : "hidden"}
        `}
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className={`sm:w-64 sm:h-full sm:static sm:block bg-white sm:border-r border-gray-100 h-full w-72 absolute left-0 top-0 z-40 shadow-xl sm:shadow-none`}
            onClick={(e) => e.stopPropagation()}
          >
            <ReportSidebar
              bookTitle={report.book_title}
              chapters={chapters}
              activeChapter={activeChapter}
              onChapterChange={(i) => { setActiveChapter(i); setSidebarOpen(false); }}
            />
          </div>
        </div>
        {/* 桌面端侧边栏（始终可见） */}
        <div className="hidden sm:block">
          <ReportSidebar
            bookTitle={report.book_title}
            chapters={chapters}
            activeChapter={activeChapter}
            onChapterChange={setActiveChapter}
          />
        </div>

        {/* 报告正文 */}
        {currentChapter ? (
          <ReportContent chapter={currentChapter} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            暂无章节数据
          </div>
        )}
      </div>
      <Footer onLegalClick={() => setShowLegal(true)} onAdminClick={onGoAdmin} compact />
    </div>
  );
}
