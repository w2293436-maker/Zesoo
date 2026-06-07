import type { ChapterData } from "../services/api";

interface ReportSidebarProps {
  bookTitle: string;
  chapters: ChapterData[];
  activeChapter: number;
  onChapterChange: (index: number) => void;
}

export default function ReportSidebar({
  bookTitle,
  chapters,
  activeChapter,
  onChapterChange,
}: ReportSidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-gray-100 h-full flex flex-col">
      {/* 书名 */}
      <div className="p-5 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-800 truncate" title={bookTitle}>
          《{bookTitle}》
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          精读报告 · 共 {chapters.length} 章
        </p>
      </div>

      {/* 章节导航 */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {chapters.map((ch, i) => (
          <button
            key={i}
            onClick={() => onChapterChange(i)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
              activeChapter === i
                ? "bg-blue-50 text-blue-700 font-medium shadow-sm"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <span className="truncate">{ch.chapter_name}</span>
            </div>
            {/* 该章数据概览 */}
            <div className="flex gap-2 mt-1.5 ml-7">
              {ch.core_ideas?.length > 0 && (
                <span className="text-xs text-gray-400">{ch.core_ideas.length} 观点</span>
              )}
              {ch.quotes?.length > 0 && (
                <span className="text-xs text-gray-400">{ch.quotes.length} 金句</span>
              )}
              {ch.methodology?.length > 0 && (
                <span className="text-xs text-gray-400">{ch.methodology.length} 方法</span>
              )}
            </div>
          </button>
        ))}
      </nav>

      {/* 底部 */}
      <div className="p-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">AI 生成，仅供参考</p>
      </div>
    </aside>
  );
}
