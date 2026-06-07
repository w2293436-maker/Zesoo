import type { ChapterData } from "../services/api";

interface ReportContentProps {
  chapter: ChapterData;
}

export default function ReportContent({ chapter }: ReportContentProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8">
      {/* 章节标题 */}
      <h1 className="text-2xl font-bold text-gray-800 mb-8">
        {chapter.chapter_name}
      </h1>

      {/* 1. 章节总结 */}
      <Section title="📝 章节总结" icon="📝">
        {chapter.summary ? (
          <p className="text-gray-700 leading-relaxed">{chapter.summary}</p>
        ) : (
          <EmptyHint />
        )}
      </Section>

      {/* 2. 核心观点 */}
      <Section title="💡 核心观点" icon="💡">
        {chapter.core_ideas?.length > 0 ? (
          <div className="space-y-4">
            {chapter.core_ideas.map((item, i) => (
              <div
                key={i}
                className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-gray-800 mb-2">
                      {item.idea}
                    </h3>
                    {item.elaboration && (
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {item.elaboration}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyHint />
        )}
      </Section>

      {/* 3. 金句摘录 */}
      <Section title="✨ 金句摘录" icon="✨">
        {chapter.quotes?.length > 0 ? (
          <div className="space-y-4">
            {chapter.quotes.map((q, i) => (
              <blockquote
                key={i}
                className="bg-white border-l-4 border-blue-400 rounded-r-xl p-5 shadow-sm"
              >
                <p className="text-base text-gray-700 leading-relaxed italic mb-2">
                  "{q.text}"
                </p>
                {q.context && (
                  <p className="text-xs text-gray-400">—— {q.context}</p>
                )}
              </blockquote>
            ))}
          </div>
        ) : (
          <EmptyHint />
        )}
      </Section>

      {/* 4. 方法论 */}
      <Section title="🔧 方法论" icon="🔧">
        {chapter.methodology?.length > 0 ? (
          <div className="space-y-5">
            {chapter.methodology.map((m, i) => (
              <div
                key={i}
                className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <h3 className="text-base font-semibold text-gray-800">
                    {m.name}
                  </h3>
                </div>
                {m.description && (
                  <p className="text-sm text-gray-600 leading-relaxed mb-3 ml-9">
                    {m.description}
                  </p>
                )}
                {m.steps && m.steps.length > 0 && (
                  <div className="ml-9 bg-gray-50 rounded-lg p-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      操作步骤
                    </p>
                    <ol className="space-y-1">
                      {m.steps.map((step, k) => (
                        <li
                          key={k}
                          className="text-sm text-gray-700 flex gap-2"
                        >
                          <span className="text-purple-500 font-bold">
                            {k + 1}.
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyHint />
        )}
      </Section>

      {/* 5. 启示与行动建议 */}
      <Section title="🎯 启示与行动建议" icon="🎯">
        {chapter.actionable_insights?.length > 0 ? (
          <div className="space-y-4">
            {chapter.actionable_insights.map((item, i) => (
              <div
                key={i}
                className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-lg bg-green-100 text-green-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-800 mb-2">
                      💡 {item.insight}
                    </h3>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-green-800 mb-1">
                        行动建议
                      </p>
                      <p className="text-sm text-green-700 leading-relaxed">
                        {item.action}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyHint />
        )}
      </Section>
    </div>
  );
}

/** 章节内的板块 */
function Section({
  title,
  children,
}: {
  title: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyHint() {
  return (
    <p className="text-sm text-gray-400 italic">本章暂无此内容</p>
  );
}
