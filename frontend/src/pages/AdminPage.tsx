import { useState } from "react";

interface AdminPageProps { onBack: () => void; }

interface Overview {
  total_visits: number; total_uploads: number; completed: number; failed: number;
  success_rate: number; total_exports: number; export_rate: number;
  total_chars: number; total_tokens: number; total_time_hours: number;
  avg_duration_seconds: number; ocr_pages: number; cost_est: number; unique_users: number;
}

interface UserSummary {
  fingerprint: string; first_seen: number; last_seen: number; visits: number;
  uploads: number; completed: number; failed: number; exports: number;
  tokens_used: number; device: string; ip_masked: string;
}

interface UserDetail extends UserSummary {
  chars_processed: number; total_time_seconds: number;
  file_types: Record<string, number>; size_distribution: Record<string, number>;
  failure_reasons: Record<string, number>; phase_times: Record<string, number>;
  tasks: TaskEntry[];
}

interface Today { visits: number; uploads: number; completed: number; tokens: number; exports: number; fails: number; }

interface TrendPoint { date: string; visits: number; uploads: number; completed: number; tokens: number; exports: number; fails: number; }

interface StatsData {
  overview: Overview; today: Today; daily_trend: TrendPoint[];
  size_distribution: Record<string, number>; file_types: Record<string, number>;
  devices: Record<string, number>; failure_reasons: Record<string, number>;
  phase_avgs: Record<string, number>; recent_tasks: TaskEntry[];
  users: UserSummary[];
}

interface TaskEntry {
  task_id: string; filename: string; chars: number; tokens_est: number;
  duration_seconds: number | null; status: string; chapters: number; error: string | null;
}

export default function AdminPage({ onBack }: AdminPageProps) {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [pwd, setPwd] = useState("");

  const loadData = async (password: string) => {
    setPwd(password);
    setLoading(true); setError("");
    try {
      const [sr, tr] = await Promise.all([
        fetch(`/api/admin/stats?password=${encodeURIComponent(password)}`),
        fetch(`/api/admin/recent?password=${encodeURIComponent(password)}`),
      ]);
      if (sr.status === 403) { setError("密码错误"); setLoading(false); return; }
      setStats(await sr.json()); setTasks(await tr.json()); setAuthed(true);
    } catch { setError("加载失败"); }
    setLoading(false);
  };

  const fetchUserDetail = async (fp: string) => {
    try {
      const r = await fetch(`/api/admin/user/${fp}?password=${encodeURIComponent(pwd)}`);
      if (r.ok) setUserDetail(await r.json());
    } catch { /* ignore */ }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>返回
          </button>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h1 className="text-lg font-bold text-gray-800 mb-1">择书Zesoo 管理后台</h1>
            <p className="text-sm text-gray-400 mb-5">请输入管理密码</p>
            <form onSubmit={(e) => { e.preventDefault(); loadData(password); }}>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="管理密码"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3" autoFocus />
              {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
              <button type="submit" disabled={!password || loading}
                className="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400">
                {loading ? "加载中..." : "查看数据"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const o = stats?.overview;
  const t = stats?.today;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onBack={onBack} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-5">
        {/* 概览卡片 */}
        {o && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Card label="页面访问" v={o.total_visits.toLocaleString()} u="次" c="blue" />
              <Card label="书籍分析" v={o.completed.toLocaleString()} u="本" c="green" />
              <Card label="独立访客" v={o.unique_users.toLocaleString()} u="人" c="indigo" />
              <Card label="导出下载" v={o.total_exports.toLocaleString()} u="次" c="indigo" />
              <Card label="成功率" v={o.success_rate.toString()} u="%" c={o.success_rate > 80 ? "green" : "amber"} />
              <Card label="导出率" v={o.export_rate.toString()} u="%" c={o.export_rate > 50 ? "green" : "amber"} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Card label="累计Token" v={fmtTokens(o.total_tokens)} u="" c="purple" />
              <Card label="估算费用" v={`¥${o.cost_est.toFixed(2)}`} u="" c="purple" />
              <Card label="处理字数" v={(o.total_chars / 10000).toFixed(1)} u="万字" c="slate" />
              <Card label="累计耗时" v={o.total_time_hours.toFixed(1)} u="小时" c="slate" />
              <Card label="OCR页数" v={o.ocr_pages.toLocaleString()} u="页" c="slate" />
            </div>

            {/* 今日摘要 */}
            {t && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h2 className="text-sm font-bold text-gray-700 mb-3">📅 今日 ({new Date().toLocaleDateString("zh-CN")})</h2>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <KV k="访问" v={t.visits} /><KV k="上传" v={t.uploads} /><KV k="完成分析" v={t.completed} />
                  <KV k="失败" v={t.fails} /><KV k="Token" v={fmtTokens(t.tokens)} /><KV k="导出" v={t.exports} />
                </div>
              </div>
            )}

            {/* 趋势折线图 */}
            {stats?.daily_trend && stats.daily_trend.length > 0 && (
              <TrendChart data={stats.daily_trend} />
            )}

            {/* 分布面板 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <DistPanel title="📁 文件类型" data={stats?.file_types} colors={typeColors} />
              <DistPanel title="📏 书籍规模" data={stats?.size_distribution} colors={sizeColors} labels={sizeLabels} />
              <DistPanel title="📱 访问设备" data={stats?.devices} colors={deviceColors} labels={deviceLabels} />
              <DistPanel title="❌ 失败原因" data={stats?.failure_reasons} colors={failColors} />
            </div>

            {/* 各阶段耗时 */}
            {stats?.phase_avgs && (
              <PhaseTimeBar phases={stats.phase_avgs} />
            )}
          </>
        )}

        {/* 最近任务 */}
        <TaskTable tasks={tasks} />

        {/* 用户列表 */}
        {stats?.users && stats.users.length > 0 && (
          <UserTable users={stats.users} onUserClick={fetchUserDetail} />
        )}

        {/* 用户详情弹窗 */}
        {userDetail && (
          <UserDetailModal user={userDetail} onClose={() => setUserDetail(null)} />
        )}
      </div>
    </div>
  );
}

/* ====== 子组件 ====== */

function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h1 className="text-sm font-semibold text-gray-800">择书Zesoo 数据看板</h1>
      </div>
    </header>
  );
}

function Card({ label, v, u, c }: { label: string; v: string; u: string; c: string }) {
  const cls: Record<string, string> = { blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600", amber: "bg-amber-50 text-amber-600", purple: "bg-purple-50 text-purple-600", indigo: "bg-indigo-50 text-indigo-600", slate: "bg-gray-50 text-gray-600" };
  return (
    <div className={`rounded-2xl p-4 ${cls[c] || cls.slate}`}>
      <div className="text-xs opacity-70 mb-1">{label}</div>
      <div className="text-xl sm:text-2xl font-bold">{v}<span className="text-sm font-normal ml-1 opacity-70">{u}</span></div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string | number }) {
  return <div><span className="text-gray-400">{k}：</span><span className="font-semibold text-gray-700">{v}</span></div>;
}

const typeColors: Record<string, string> = { pdf: "#ef4444", docx: "#3b82f6", txt: "#6b7280" };
const sizeColors: Record<string, string> = { small: "#22c55e", medium: "#f59e0b", large: "#ef4444" };
const sizeLabels: Record<string, string> = { small: "小型 <1万字", medium: "中型 1-10万", large: "大型 >10万" };
const deviceColors: Record<string, string> = { pc: "#3b82f6", mobile: "#10b981", tablet: "#8b5cf6" };
const deviceLabels: Record<string, string> = { pc: "电脑", mobile: "手机", tablet: "平板" };
const failColors: Record<string, string> = { "OCR识别失败": "#ef4444", "超时": "#f59e0b", "API Key错误": "#dc2626", "文件解析失败": "#8b5cf6", "章节切分失败": "#06b6d4", "其他错误": "#6b7280" };

function DistPanel({ title, data, colors, labels }: { title: string; data?: Record<string, number>; colors: Record<string, string>; labels?: Record<string, string> }) {
  if (!data) return null;
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <h2 className="text-sm font-bold text-gray-700 mb-3">{title}</h2>
      <div className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-xs mb-1"><span className="text-gray-600">{labels?.[k] || k.toUpperCase()}</span><span className="text-gray-400">{v} ({total > 0 ? Math.round(v / total * 100) : 0}%)</span></div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${(v / total) * 100}%`, backgroundColor: colors[k] || "#6b7280" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhaseTimeBar({ phases }: { phases: Record<string, number> }) {
  const labels: Record<string, string> = { parse: "文件解析", detect: "章节识别", analyze: "逐章分析", export: "导出" };
  const colors: Record<string, string> = { parse: "#22c55e", detect: "#3b82f6", analyze: "#f59e0b", export: "#8b5cf6" };
  const total = Object.values(phases).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <h2 className="text-sm font-bold text-gray-700 mb-3">⏱ 各阶段平均耗时</h2>
      <div className="flex h-8 rounded-xl overflow-hidden">
        {Object.entries(phases).map(([k, v]) => (
          <div key={k} className="flex items-center justify-center text-xs text-white font-medium" style={{ width: `${(v / total) * 100}%`, backgroundColor: colors[k] || "#6b7280" }}>
            {v > total * 0.15 ? `${labels[k] || k} ${v}s` : ""}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
        {Object.entries(phases).map(([k, v]) => (
          <span key={k}>● {labels[k] || k}: {v}s</span>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ data }: { data: TrendPoint[] }) {
  const h = 140; const w = 600; const pad = { t: 10, r: 10, b: 20, l: 40 };
  const pw = w - pad.l - pad.r; const ph = h - pad.t - pad.b;
  const allVals = data.flatMap((d) => [d.visits, d.uploads, d.completed]);
  const maxY = Math.max(...allVals, 1);
  const lines = [
    { key: "visits", label: "访问", color: "#3b82f6" },
    { key: "uploads", label: "上传", color: "#f59e0b" },
    { key: "completed", label: "完成", color: "#22c55e" },
  ] as const;

  const pts = (key: string) =>
    data.map((d, i) => {
      const x = pad.l + (i / Math.max(data.length - 1, 1)) * pw;
      const y = pad.t + ph - ((d as any)[key] / maxY) * ph;
      return `${x},${y}`;
    }).join(" ");

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <h2 className="text-sm font-bold text-gray-700 mb-3">📈 7日趋势</h2>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[600px] h-auto">
          {/* 网格 */}
          {[0, 0.25, 0.5, 0.75, 1].map((r) => {
            const y = pad.t + ph * (1 - r);
            return <line key={r} x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#f1f5f9" strokeWidth="1" />;
          })}
          {/* Y轴标签 */}
          <text x={pad.l - 6} y={pad.t + 4} textAnchor="end" className="text-[8px]" fill="#94a3b8">{maxY}</text>
          <text x={pad.l - 6} y={pad.t + ph + 2} textAnchor="end" className="text-[8px]" fill="#94a3b8">0</text>
          {/* 折线 */}
          {lines.map((l) => (
            <polyline key={l.key} points={pts(l.key)} fill="none" stroke={l.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {/* X轴 */}
          {data.map((d, i) => {
            const x = pad.l + (i / Math.max(data.length - 1, 1)) * pw;
            return <text key={i} x={x} y={h - 2} textAnchor="middle" className="text-[8px]" fill="#94a3b8">{d.date}</text>;
          })}
        </svg>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-gray-500">
        {lines.map((l) => (<span key={l.key}>● {l.label}</span>))}
      </div>
    </div>
  );
}

function TaskTable({ tasks }: { tasks: TaskEntry[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100"><h2 className="text-sm font-bold text-gray-700">📋 最近任务</h2></div>
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
                <td className="px-3 py-2 text-gray-700 max-w-[120px] sm:max-w-[200px] truncate" title={t.filename}>{t.filename}</td>
                <td className="px-3 py-2 text-right text-gray-500">{(t.chars / 1000).toFixed(0)}k</td>
                <td className="px-3 py-2 text-right text-gray-500 hidden sm:table-cell">{fmtTokens(t.tokens_est)}</td>
                <td className="px-3 py-2 text-right text-gray-500">{t.duration_seconds ? `${t.duration_seconds.toFixed(0)}s` : "-"}</td>
                <td className="px-3 py-2 text-center">
                  {t.status === "completed" ? <span className="text-green-500 text-xs">✅ {t.chapters}章</span>
                    : t.status === "failed" ? <span className="text-red-500 text-xs" title={t.error || ""}>❌</span>
                    : <span className="text-yellow-500 text-xs">⏳</span>}
                </td>
              </tr>
            ))}
            {tasks.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">暂无数据</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmtTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return n.toString();
}

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("zh-CN") + " " + d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function UserTable({ users, onUserClick }: { users: UserSummary[]; onUserClick: (fp: string) => void }) {
  const deviceIcons: Record<string, string> = { pc: "💻", mobile: "📱", tablet: "📟" };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-700">👥 独立访客 ({users.length}人)</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium">来源</th>
              <th className="text-center px-2 py-2 font-medium">设备</th>
              <th className="text-right px-2 py-2 font-medium">访问</th>
              <th className="text-right px-2 py-2 font-medium">上传</th>
              <th className="text-right px-2 py-2 font-medium">完成</th>
              <th className="text-right px-2 py-2 font-medium">导出</th>
              <th className="text-right px-2 py-2 font-medium hidden sm:table-cell">Token</th>
              <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">最近活跃</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((u) => (
              <tr key={u.fingerprint} onClick={() => onUserClick(u.fingerprint)}
                className="hover:bg-blue-50 cursor-pointer transition-colors">
                <td className="px-3 py-2 text-gray-600 font-mono text-xs">{u.ip_masked}</td>
                <td className="px-2 py-2 text-center">{deviceIcons[u.device] || "💻"}</td>
                <td className="px-2 py-2 text-right text-gray-700">{u.visits}</td>
                <td className="px-2 py-2 text-right text-gray-700">{u.uploads}</td>
                <td className="px-2 py-2 text-right text-green-600">{u.completed || "-"}</td>
                <td className="px-2 py-2 text-right text-gray-700">{u.exports || "-"}</td>
                <td className="px-2 py-2 text-right text-gray-500 hidden sm:table-cell">{fmtTokens(u.tokens_used)}</td>
                <td className="px-3 py-2 text-right text-gray-400 hidden sm:table-cell text-xs">{fmtTime(u.last_seen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserDetailModal({ user, onClose }: { user: UserDetail; onClose: () => void }) {
  const tasks = user.tasks || [];
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-base font-bold text-gray-800">访客详情</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <MiniCard l="访问次数" v={user.visits} />
            <MiniCard l="上传文件" v={user.uploads} />
            <MiniCard l="完成分析" v={user.completed} c="green" />
            <MiniCard l="失败" v={user.failed} c="red" />
            <MiniCard l="导出下载" v={user.exports} />
            <MiniCard l="Token" v={fmtTokens(user.tokens_used)} />
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <p>IP: {user.ip_masked} · 设备: {user.device === "mobile" ? "📱手机" : user.device === "tablet" ? "📟平板" : "💻电脑"}</p>
            <p>首次访问: {fmtTime(user.first_seen)}</p>
            <p>最近活跃: {fmtTime(user.last_seen)}</p>
            {user.total_time_seconds > 0 && <p>累计用时: {(user.total_time_seconds / 60).toFixed(1)} 分钟</p>}
            {user.chars_processed > 0 && <p>处理字数: {(user.chars_processed / 10000).toFixed(1)} 万字</p>}
          </div>

          {/* 用户维度的分布图 */}
          <div className="grid grid-cols-2 gap-3">
            <MiniDist title="📁 文件类型" data={user.file_types} colors={{ pdf: "#ef4444", docx: "#3b82f6", txt: "#6b7280" }} />
            <MiniDist title="📏 书籍规模" data={user.size_distribution} colors={{ small: "#22c55e", medium: "#f59e0b", large: "#ef4444" }} labels={{ small: "小", medium: "中", large: "大" }} />
          </div>

          {Object.keys(user.failure_reasons).length > 0 && (
            <MiniDist title="❌ 失败原因" data={user.failure_reasons} colors={{ "OCR识别失败": "#ef4444", "超时": "#f59e0b", "API Key错误": "#dc2626", "文件解析失败": "#8b5cf6", "章节切分失败": "#06b6d4", "其他错误": "#6b7280" }} />
          )}

          {Object.values(user.phase_times).reduce((a,b) => a+b, 0) > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 mb-2">⏱ 阶段耗时</h3>
              <div className="flex gap-2 text-xs">
                {Object.entries(user.phase_times).filter(([, v]) => v !== 0).map(([k, v]) => (
                  <span key={k} className="px-2 py-1 bg-gray-50 rounded-lg text-gray-600">
                    {k === "parse" ? "解析" : k === "detect" ? "识别" : "分析"}: {v.toFixed(0)}s
                  </span>
                ))}
              </div>
            </div>
          )}

          {tasks.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-2">任务记录</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {tasks.map((t) => (
                  <div key={t.task_id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-gray-50">
                    <span className="text-gray-600 truncate max-w-[150px]" title={t.filename}>{t.filename}</span>
                    <span className="text-gray-400">{(t.chars / 1000).toFixed(0)}k字</span>
                    <span className="text-gray-400">{t.duration_seconds ? `${t.duration_seconds.toFixed(0)}s` : ""}</span>
                    <span>{t.status === "completed" ? "✅" : t.status === "failed" ? "❌" : "⏳"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniCard({ l, v, c }: { l: string; v: string | number; c?: string }) {
  const cc = c === "green" ? "text-green-600" : c === "red" ? "text-red-500" : "text-gray-700";
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <div className="text-xs text-gray-400">{l}</div>
      <div className={`text-lg font-bold ${cc}`}>{v}</div>
    </div>
  );
}

function MiniDist({ title, data, colors, labels }: { title: string; data?: Record<string, number>; colors: Record<string, string>; labels?: Record<string, string> }) {
  if (!data) return null;
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-bold text-gray-500 mb-2">{title}</h3>
      <div className="space-y-1.5">
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="text-gray-500">{labels?.[k] || k.toUpperCase()}</span>
              <span className="text-gray-400">{v}</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(v / total) * 100}%`, backgroundColor: colors[k] || "#6b7280" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
