import { useEffect, useState } from "react";

interface AdminPageProps {
  onBack: () => void;
}

interface StatsData {
  overview: {
    total_visits: number;
    total_uploads: number;
    completed: number;
    failed: number;
    success_rate: number;
    total_chars: number;
    total_tokens: number;
    total_time_hours: number;
    avg_duration_seconds: number;
    ocr_pages: number;
  };
  today: { visits: number; uploads: number; tokens: number };
  file_types: Record<string, number>;
}

interface TaskEntry {
  task_id: string;
  filename: string;
  chars: number;
  tokens_est: number;
  start_time: number;
  finish_time: number | null;
  duration_seconds: number | null;
  status: string;
  chapters: number;
  error: string | null;
}

export default function AdminPage({ onBack }: AdminPageProps) {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = async (pwd: string) => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, tasksRes] = await Promise.all([
        fetch(`/api/admin/stats?password=${encodeURIComponent(pwd)}`),
        fetch(`/api/admin/recent?password=${encodeURIComponent(pwd)}`),
      ]);
      if (statsRes.status === 403 || tasksRes.status === 403) {
        setError("密码错误");
        setLoading(false);
        return;
      }
      const statsData = await statsRes.json();
      const tasksData = await tasksRes.json();
      setStats(statsData);
      setTasks(tasksData);
      setAuthed(true);
    } catch {
      setError("加载失败");
    }
    setLoading(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loadData(password);
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            返回
          </button>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h1 className="text-lg font-bold text-gray-800 mb-1">择书Zesoo 管理后台</h1>
            <p className="text-sm text-gray-400 mb-5">请输入管理密码查看数据</p>
            <form onSubmit={handleLogin}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="管理密码"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3"
                autoFocus
              />
              {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
              <button
                type="submit"
                disabled={!password || loading}
                className="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                {loading ? "加载中..." : "查看数据"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 顶栏 */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-sm font-semibold text-gray-800">择书Zesoo 数据看板</h1>
        </div>
        <span className="text-xs text-gray-400">数据实时更新</span>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* 概览卡片 */}
        {stats && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="页面访问" value={stats.overview.total_visits.toLocaleString()} unit="次" color="blue" />
              <StatCard label="书籍分析" value={stats.overview.completed.toLocaleString()} unit="本" color="green" />
              <StatCard label="成功率" value={stats.overview.success_rate.toString()} unit="%" color="amber" />
              <StatCard label="累计Token" value={formatTokens(stats.overview.total_tokens)} unit="" color="purple" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="处理字数" value={(stats.overview.total_chars / 10000).toFixed(1)} unit="万字" color="slate" />
              <StatCard label="累计耗时" value={stats.overview.total_time_hours.toFixed(1)} unit="小时" color="slate" />
              <StatCard label="平均耗时" value={stats.overview.avg_duration_seconds.toFixed(0)} unit="秒/本" color="slate" />
              <StatCard label="OCR页数" value={stats.overview.ocr_pages.toLocaleString()} unit="页" color="slate" />
            </div>

            {/* 今日统计 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h2 className="text-sm font-bold text-gray-700 mb-3">📅 今日数据</h2>
              <div className="flex gap-6 text-sm">
                <div><span className="text-gray-400">访问：</span><span className="font-semibold text-gray-700">{stats.today.visits}</span></div>
                <div><span className="text-gray-400">上传：</span><span className="font-semibold text-gray-700">{stats.today.uploads}</span></div>
                <div><span className="text-gray-400">Token：</span><span className="font-semibold text-gray-700">{formatTokens(stats.today.tokens)}</span></div>
              </div>
            </div>

            {/* 文件类型分布 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h2 className="text-sm font-bold text-gray-700 mb-3">📁 文件类型分布</h2>
              <div className="flex gap-4">
                {Object.entries(stats.file_types).map(([type, count]) => (
                  <div key={type} className="text-center">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-1">
                      <span className="text-xs font-bold text-blue-600 uppercase">{type}</span>
                    </div>
                    <span className="text-xs text-gray-500">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 最近任务列表 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700">📋 最近任务</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">文件</th>
                  <th className="text-right px-3 py-2 font-medium">字数</th>
                  <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">Token</th>
                  <th className="text-right px-3 py-2 font-medium">耗时</th>
                  <th className="text-center px-3 py-2 font-medium">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tasks.slice(0, 15).map((t) => (
                  <tr key={t.task_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700 max-w-[120px] sm:max-w-[200px] truncate" title={t.filename}>
                      {t.filename}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      {(t.chars / 1000).toFixed(0)}k
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500 hidden sm:table-cell">
                      {formatTokens(t.tokens_est)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      {t.duration_seconds ? `${t.duration_seconds.toFixed(0)}s` : "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {t.status === "completed" ? (
                        <span className="text-green-500 text-xs">✅ {t.chapters}章</span>
                      ) : t.status === "failed" ? (
                        <span className="text-red-500 text-xs">❌</span>
                      ) : (
                        <span className="text-yellow-500 text-xs">⏳</span>
                      )}
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400">暂无数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
    slate: "bg-gray-50 text-gray-600",
  };
  return (
    <div className={`rounded-2xl p-4 ${colors[color] || colors.slate}`}>
      <div className="text-xs opacity-70 mb-1">{label}</div>
      <div className="text-xl sm:text-2xl font-bold">
        {value}<span className="text-sm font-normal ml-1 opacity-70">{unit}</span>
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return n.toString();
}
