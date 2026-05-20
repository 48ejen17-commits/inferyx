import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, query, orderBy, limit, addDoc, getDocs } from "firebase/firestore";
import { useAuth, ROLE_COLORS, ROLE_LABELS } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  Shield, Activity, Users, TrendingUp, FileText, Calculator,
  Clock, Filter, ChevronDown, AlertTriangle, CheckCircle,
  MessageSquare, Star, DollarSign, Percent, Target, Zap,
  Download, RefreshCw, Search, Eye, BarChart2, Award,
  Edit3, Trash2, Plus, X, Minus
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n) => n?.toLocaleString("ru-RU") || "0";
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU") + " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
};

const ACTION_ICONS = {
  post_added:     { icon: "📝", color: "#10b981", label: "Добавил запись" },
  content_posted: { icon: "✅", color: "#7c3aed", label: "Отметил пост" },
  content_problem:{ icon: "⚠️", color: "#f59e0b", label: "Отметил проблему" },
  task_moved:     { icon: "📋", color: "#0ea5e9", label: "Двинул задачу" },
  task_created:   { icon: "➕", color: "#8b5cf6", label: "Создал задачу" },
  message_sent:   { icon: "💬", color: "#06b6d4", label: "Написал в чат" },
  profile_updated:{ icon: "👤", color: "#f97316", label: "Обновил профиль" },
  model_updated:  { icon: "🌟", color: "#db2877", label: "Изменил модель" },
  login:          { icon: "🔑", color: "#84cc16", label: "Вошёл в систему" },
};

// ── Mini stat card ─────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, t }) {
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "20px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -16, right: -16, width: 70, height: 70, borderRadius: "50%", background: `${color}12` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: t.textMuted, fontSize: "12px", marginBottom: "6px" }}>{label}</div>
          <div style={{ color: t.text, fontSize: "28px", fontWeight: 700, lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ color: t.textFaint, fontSize: "11px", marginTop: "5px" }}>{sub}</div>}
        </div>
        <div style={{ background: `${color}18`, borderRadius: "10px", padding: "10px", color, flexShrink: 0 }}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

// ── TABS ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key: "overview",     label: "Обзор",          icon: BarChart2 },
  { key: "logs",         label: "Логи",            icon: Activity },
  { key: "reddit",       label: "Reddit Stats",    icon: TrendingUp },
  { key: "finance",      label: "Финансы",         icon: DollarSign },
  { key: "calculator",   label: "Калькуляторы",    icon: Calculator },
  { key: "kpi",          label: "KPI команды",     icon: Target },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function Admin() {
  const { db, profile, user } = useAuth();
  const { theme: t } = useTheme();
  const [tab, setTab] = useState("overview");

  // Data
  const [users,    setUsers]    = useState([]);
  const [entries,  setEntries]  = useState([]);
  const [tasks,    setTasks]    = useState([]);
  const [models,   setModels]   = useState([]);
  const [grid,     setGrid]     = useState([]);
  const [logs,     setLogs]     = useState([]);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "users"),        s => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "entries"),      s => setEntries(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "tasks"),        s => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "models"),       s => setModels(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "content_grid"), s => setGrid(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, "activity_logs"), orderBy("createdAt", "desc"), limit(200)),
        s => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  // ── Log writer (called from other pages via this util) ──
  // Export this so other pages can call it
  // logAction(db, user, profile, "post_added", { note: "..." })

  const today = new Date().toLocaleDateString("ru-RU");
  const week  = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toLocaleDateString("ru-RU"); });

  const todayEntries  = entries.filter(e => e.date === today);
  const weekEntries   = entries.filter(e => week.includes(e.date));
  const doneTasks     = tasks.filter(t => t.column === "done");
  const openTasks     = tasks.filter(t => t.column !== "done");
  const todayPosted   = grid.filter(g => g.date === today && g.status === "posted");

  // Online users (active within 2 min)
  const onlineUsers = users.filter(u => {
    if (!u.lastActiveAt) return false;
    return (Date.now() - new Date(u.lastActiveAt).getTime()) < 120000;
  });

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "linear-gradient(135deg, #f59e0b, #ef4444)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={20} style={{ color: "#fff" }} />
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: t.text }}>Admin Panel</h1>
          <span style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", border: "1px solid rgba(245,158,11,0.3)" }}>OWNER ONLY</span>
        </div>
        <p style={{ color: t.textMuted, fontSize: "14px" }}>Полный контроль над командой и системой</p>
      </motion.div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "24px", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "14px", padding: "5px" }}>
        {TABS.map(tb => {
          const Icon = tb.icon;
          const active = tab === tb.key;
          return (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", padding: "10px 14px", borderRadius: "10px", border: "none", cursor: "pointer", background: active ? "linear-gradient(135deg, #7c3aed, #db2877)" : "transparent", color: active ? "#fff" : t.textMuted, fontSize: "13px", fontWeight: active ? 700 : 500, transition: "all 0.2s" }}>
              <Icon size={15} />
              {tb.label}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "24px" }}>
            <StatCard icon={Users}      label="Всего в команде"  value={users.length}           sub={`${onlineUsers.length} онлайн сейчас`} color="#7c3aed" t={t} />
            <StatCard icon={FileText}   label="Постов сегодня"   value={todayEntries.length}     sub={`${weekEntries.length} за неделю`}      color="#10b981" t={t} />
            <StatCard icon={CheckCircle}label="Задач выполнено"  value={doneTasks.length}        sub={`${openTasks.length} открытых`}         color="#0ea5e9" t={t} />
            <StatCard icon={Activity}   label="Reddit сегодня"   value={todayPosted.length}      sub="отмечено ✅"                             color="#f59e0b" t={t} />
            <StatCard icon={Star}       label="Активных моделей" value={models.filter(m => m.status !== "inactive").length} sub={`из ${models.length} всего`} color="#db2877" t={t} />
            <StatCard icon={Zap}        label="Записей всего"    value={fmt(entries.length)}     sub="за всё время"                           color="#8b5cf6" t={t} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginBottom: "18px" }}>
            {/* Online now */}
            <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600 }}>Онлайн сейчас</h3>
                <span style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px" }}>{onlineUsers.length}</span>
              </div>
              {onlineUsers.length === 0 ? (
                <div style={{ color: t.textFaint, fontSize: "13px", textAlign: "center", padding: "16px" }}>Никого нет онлайн</div>
              ) : onlineUsers.map(u => {
                const rc = ROLE_COLORS[u.role] || "#64748b";
                const diff = Math.floor((Date.now() - new Date(u.lastActiveAt).getTime()) / 1000);
                const ago = diff < 60 ? "только что" : `${Math.floor(diff / 60)} мин назад`;
                return (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "10px", background: t.bgCardHover, marginBottom: "6px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: `linear-gradient(135deg, ${rc}, ${rc}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: u.avatarEmoji ? "15px" : "12px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {u.avatarEmoji || (u.name || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{u.name}</div>
                      <div style={{ color: t.textFaint, fontSize: "11px" }}>{ROLE_LABELS[u.role] || u.role}</div>
                    </div>
                    <div style={{ color: "#10b981", fontSize: "11px" }}>{ago}</div>
                  </div>
                );
              })}
            </div>

            {/* Top performers today */}
            <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <Award size={16} style={{ color: "#f59e0b" }} />
                <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600 }}>Активность сегодня</h3>
              </div>
              {users.length === 0 ? (
                <div style={{ color: t.textFaint, fontSize: "13px", textAlign: "center", padding: "16px" }}>Нет данных</div>
              ) : [...users]
                .map(u => ({ ...u, count: todayEntries.filter(e => e.userId === u.uid).length }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 6)
                .map((u, i) => {
                  const rc = ROLE_COLORS[u.role] || "#64748b";
                  const medals = ["🥇", "🥈", "🥉"];
                  return (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 10px", borderRadius: "10px", background: i === 0 && u.count > 0 ? "rgba(245,158,11,0.07)" : "transparent", marginBottom: "4px" }}>
                      <span style={{ fontSize: "14px", width: "22px", textAlign: "center" }}>{medals[i] || `${i + 1}.`}</span>
                      <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: `linear-gradient(135deg, ${rc}, ${rc}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: u.avatarEmoji ? "13px" : "11px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                        {u.avatarEmoji || (u.name || "?")[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: t.text, fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
                      </div>
                      <div style={{ color: u.count > 0 ? "#10b981" : t.textFaint, fontSize: "13px", fontWeight: 700 }}>{u.count}</div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Models performance */}
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "16px" }}>Модели — активность за неделю</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[...models]
                .map(m => ({ ...m, weekCount: weekEntries.filter(e => e.model === m.name).length, todayCount: todayEntries.filter(e => e.model === m.name).length }))
                .sort((a, b) => b.weekCount - a.weekCount)
                .map(m => {
                  const max = Math.max(...models.map(mm => weekEntries.filter(e => e.model === mm.name).length), 1);
                  const pct = Math.round((m.weekCount / max) * 100);
                  const color = m.color || "#7c3aed";
                  return (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: `linear-gradient(135deg, ${color}, ${color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>
                        {m.emoji || m.name[0]}
                      </div>
                      <div style={{ width: "120px", color: t.text, fontSize: "13px", fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                      <div style={{ flex: 1, height: "8px", background: t.bgCardHover, borderRadius: "4px", overflow: "hidden" }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.1 }}
                          style={{ height: "100%", background: `linear-gradient(90deg, ${color}, ${color}88)`, borderRadius: "4px" }} />
                      </div>
                      <div style={{ color: t.textMuted, fontSize: "12px", width: "60px", textAlign: "right", flexShrink: 0 }}>{m.weekCount} / сег. {m.todayCount}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── LOGS ─────────────────────────────────────────────────────────────── */}
      {tab === "logs" && (
        <LogsTab logs={logs} users={users} entries={entries} tasks={tasks} grid={grid} t={t} />
      )}

      {/* ── CALCULATOR ───────────────────────────────────────────────────────── */}
      {tab === "finance" && (
        <FinanceTab db={db} t={t} />
      )}

      {tab === "reddit" && (
        <RedditStatsTab db={db} models={models} t={t} />
      )}

      {tab === "calculator" && (
        <CalculatorTab users={users} entries={entries} t={t} />
      )}

      {/* ── KPI ──────────────────────────────────────────────────────────────── */}
      {tab === "kpi" && (
        <KpiTab users={users} entries={entries} tasks={tasks} grid={grid} t={t} />
      )}
    </div>
  );
}

// ── LOGS TAB ──────────────────────────────────────────────────────────────────
function LogsTab({ logs, users, entries, tasks, grid, t }) {
  const [search, setSearch] = useState("");
  const [filterUser, setFilterUser] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Build activity feed from real collections
  const feed = [
    ...entries.map(e => ({
      id: "e_" + e.id, type: "post_added", userId: e.userId,
      userName: e.adminName || e.admin || "—",
      detail: `${e.platform} · ${e.model || "—"}`,
      createdAt: e.createdAt,
    })),
    ...grid.filter(g => g.status !== "none").map(g => ({
      id: "g_" + g.id, type: g.status === "posted" ? "content_posted" : "content_problem",
      userId: g.updatedByUid || "",
      userName: g.updatedBy || "—",
      detail: `${g.date}`,
      createdAt: g.updatedAt || g.createdAt || "",
    })),
    ...tasks.map(tk => ({
      id: "t_" + tk.id, type: "task_moved",
      userId: tk.assigneeId || "",
      userName: tk.assigneeName || "—",
      detail: tk.title,
      createdAt: tk.updatedAt || tk.createdAt || "",
    })),
    ...logs,
  ].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 300);

  const filtered = feed.filter(item => {
    if (filterUser !== "all" && item.userId !== filterUser && item.userName !== filterUser) return false;
    if (filterType !== "all" && item.type !== filterType) return false;
    if (search && !item.userName?.toLowerCase().includes(search.toLowerCase()) && !item.detail?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const uniqueUsers = [...new Set(feed.map(f => f.userName).filter(Boolean))];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
          <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: t.textMuted }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени или действию..."
            style={{ width: "100%", background: t.bgCard, color: t.text, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "10px 12px 10px 34px", fontSize: "13px", outline: "none", fontFamily: "inherit" }} />
        </div>
        <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
          style={{ background: t.bgCard, color: t.text, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "10px 14px", fontSize: "13px", outline: "none", fontFamily: "inherit" }}>
          <option value="all">Все пользователи</option>
          {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ background: t.bgCard, color: t.text, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "10px 14px", fontSize: "13px", outline: "none", fontFamily: "inherit" }}>
          <option value="all">Все действия</option>
          {Object.entries(ACTION_ICONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: t.text, fontSize: "14px", fontWeight: 600 }}>Лента активности</span>
          <span style={{ color: t.textFaint, fontSize: "12px" }}>{filtered.length} событий</span>
        </div>
        <div style={{ maxHeight: "600px", overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: t.textFaint }}>Нет событий по фильтру</div>
          ) : filtered.map((item, i) => {
            const info = ACTION_ICONS[item.type] || { icon: "•", color: "#64748b", label: item.type };
            const userObj = users.find(u => u.uid === item.userId);
            const rc = ROLE_COLORS[userObj?.role] || "#64748b";
            return (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 20px", borderBottom: i < filtered.length - 1 ? `1px solid ${t.border}` : "none", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = t.bgCardHover}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                {/* Avatar */}
                <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: `linear-gradient(135deg, ${rc}, ${rc}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: userObj?.avatarEmoji ? "15px" : "12px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {userObj?.avatarEmoji || (item.userName || "?")[0].toUpperCase()}
                </div>
                {/* Event icon */}
                <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: `${info.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>
                  {info.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{item.userName}</span>
                    <span style={{ color: info.color, fontSize: "12px" }}>{info.label}</span>
                  </div>
                  {item.detail && <div style={{ color: t.textMuted, fontSize: "12px", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.detail}</div>}
                </div>
                <div style={{ color: t.textFaint, fontSize: "11px", flexShrink: 0 }}>{fmtDate(item.createdAt)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}


// ── CALCULATOR TAB ────────────────────────────────────────────────────────────
function CalculatorTab({ users, entries, t }) {
  const [mode, setMode] = useState("salary");
  const [userRates, setUserRates] = useState({});
  const [period, setPeriod] = useState("month");
  const [globalType, setGlobalType] = useState("per_post");
  const [globalValue, setGlobalValue] = useState("");
  const [globalAvgRev, setGlobalAvgRev] = useState("");
  const [views, setViews] = useState("");
  const [clicks, setClicks] = useState("");
  const [subs, setSubs] = useState("");
  const [subPrice, setSubPrice] = useState("");
  const [targetRevenue, setTargetRevenue] = useState("");
  const [convRate, setConvRate] = useState("");
  const [avgCheck, setAvgCheck] = useState("");

  const days = { day: 1, week: 7, month: 30 }[period] || 30;
  const getRate = (uid) => userRates[uid] || { type: globalType, value: "", avgRevenue: "", bonus: "", note: "" };
  const setRate = (uid, field, val) => setUserRates(p => ({ ...p, [uid]: { ...getRate(uid), [field]: val } }));

  const applyGlobal = () => {
    const next = {};
    users.forEach(u => { next[u.uid] = { ...getRate(u.uid), type: globalType, value: globalValue, avgRevenue: globalAvgRev }; });
    setUserRates(next);
  };

  const calcUser = (u) => {
    const r = getRate(u.uid);
    const userEntries = entries.filter(e => e.userId === u.uid && (new Date() - new Date(e.createdAt)) / 86400000 <= days);
    const posts = userEntries.length;
    let base = 0;
    if (r.type === "per_post") base = posts * (parseFloat(r.value) || 0);
    else if (r.type === "percent") base = posts * (parseFloat(r.avgRevenue) || 0) * ((parseFloat(r.value) || 0) / 100);
    else if (r.type === "fixed") base = parseFloat(r.value) || 0;
    const bonus = parseFloat(r.bonus) || 0;
    return { posts, base, bonus, total: base + bonus };
  };

  const results = users.map(u => ({ ...u, ...calcUser(u) })).sort((a, b) => b.posts - a.posts);
  const grandTotal = results.reduce((s, u) => s + u.total, 0);

  const ctr      = clicks && views     ? ((parseFloat(clicks) / parseFloat(views)) * 100).toFixed(1) : null;
  const subRate  = subs && clicks      ? ((parseFloat(subs) / parseFloat(clicks)) * 100).toFixed(1) : null;
  const revenue  = subs && subPrice    ? (parseFloat(subs) * parseFloat(subPrice)).toFixed(0) : null;
  const roas     = revenue && views    ? (parseFloat(revenue) / parseFloat(views) * 1000).toFixed(2) : null;
  const neededSubs   = targetRevenue && avgCheck ? Math.ceil(parseFloat(targetRevenue) / parseFloat(avgCheck)) : null;
  const neededClicks = neededSubs && convRate    ? Math.ceil(neededSubs / (parseFloat(convRate) / 100)) : null;
  const neededPosts  = neededClicks              ? Math.ceil(neededClicks / 50) : null;

  const inputS  = { background: t.bgInput, color: t.text, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "10px 14px", fontSize: "13px", outline: "none", fontFamily: "inherit", width: "100%" };
  const smInput = { ...inputS, padding: "7px 10px", fontSize: "12px" };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        {[{ key: "salary", label: "💰 Зарплаты" }, { key: "conversion", label: "📊 Конверсия" }, { key: "plan", label: "🎯 Планирование" }].map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            style={{ padding: "9px 18px", borderRadius: "10px", border: `1px solid ${mode === m.key ? "#7c3aed" : t.border}`, background: mode === m.key ? "rgba(124,58,237,0.15)" : t.bgCard, color: mode === m.key ? "#a78bfa" : t.textMuted, fontSize: "13px", fontWeight: mode === m.key ? 700 : 500, cursor: "pointer" }}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === "salary" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Global settings bar */}
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "14px", padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span style={{ color: t.textMuted, fontSize: "13px", fontWeight: 600 }}>Период:</span>
              {[{ v: "day", l: "День" }, { v: "week", l: "Неделя" }, { v: "month", l: "Месяц" }].map(opt => (
                <button key={opt.v} onClick={() => setPeriod(opt.v)}
                  style={{ padding: "6px 14px", borderRadius: "8px", border: `1px solid ${period === opt.v ? "#7c3aed" : t.border}`, background: period === opt.v ? "rgba(124,58,237,0.15)" : t.bgCardHover, color: period === opt.v ? "#a78bfa" : t.textMuted, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  {opt.l}
                </button>
              ))}
              <div style={{ width: "1px", height: "24px", background: t.border }} />
              <span style={{ color: t.textMuted, fontSize: "13px" }}>Применить ко всем:</span>
              <select value={globalType} onChange={e => setGlobalType(e.target.value)} style={{ ...smInput, width: "120px" }}>
                <option value="per_post">$/пост</option>
                <option value="percent">%</option>
                <option value="fixed">Фикс.</option>
              </select>
              <input type="number" value={globalValue} onChange={e => setGlobalValue(e.target.value)}
                placeholder={globalType === "per_post" ? "$/пост" : globalType === "percent" ? "%" : "$"}
                style={{ ...smInput, width: "80px" }} />
              {globalType === "percent" && (
                <input type="number" value={globalAvgRev} onChange={e => setGlobalAvgRev(e.target.value)}
                  placeholder="выручка/пост" style={{ ...smInput, width: "110px" }} />
              )}
              <button onClick={applyGlobal}
                style={{ padding: "7px 16px", borderRadius: "8px", background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#a78bfa", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                → Применить
              </button>
            </div>
          </div>

          {/* Per-user table */}
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", overflow: "hidden" }}>
            <div style={{ padding: "13px 20px", borderBottom: `1px solid ${t.border}`, display: "grid", gridTemplateColumns: "2fr 60px 110px 80px 90px 80px 1fr 90px", gap: "8px", alignItems: "center" }}>
              {["Сотрудник", "Постов", "Тип", "Ставка", "Выр./пост", "Бонус", "Заметка", "Итого"].map((h, i) => (
                <div key={i} style={{ color: t.textFaint, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", textAlign: i === 7 ? "right" : "left" }}>{h}</div>
              ))}
            </div>
            {results.map((u, i) => {
              const r = getRate(u.uid);
              const rc = ROLE_COLORS[u.role] || "#64748b";
              return (
                <div key={u.id}
                  style={{ padding: "11px 20px", borderBottom: i < results.length - 1 ? `1px solid ${t.border}` : "none", display: "grid", gridTemplateColumns: "2fr 60px 110px 80px 90px 80px 1fr 90px", gap: "8px", alignItems: "center" }}
                  onMouseEnter={e => e.currentTarget.style.background = t.bgCardHover}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: `linear-gradient(135deg, ${rc}, ${rc}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: u.avatarEmoji ? "13px" : "11px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {u.avatarEmoji || (u.name || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{u.name}</div>
                      <div style={{ color: t.textFaint, fontSize: "10px" }}>{ROLE_LABELS[u.role] || u.role}</div>
                    </div>
                  </div>
                  <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{u.posts}</div>
                  <select value={r.type} onChange={e => setRate(u.uid, "type", e.target.value)} style={{ ...smInput }}>
                    <option value="per_post">$/пост</option>
                    <option value="percent">%</option>
                    <option value="fixed">Фикс.</option>
                  </select>
                  <input type="number" value={r.value} onChange={e => setRate(u.uid, "value", e.target.value)} placeholder="0" style={{ ...smInput }} />
                  {r.type === "percent"
                    ? <input type="number" value={r.avgRevenue} onChange={e => setRate(u.uid, "avgRevenue", e.target.value)} placeholder="$" style={{ ...smInput }} />
                    : <div style={{ color: t.textFaint, fontSize: "12px", paddingLeft: "4px" }}>—</div>}
                  <input type="number" value={r.bonus} onChange={e => setRate(u.uid, "bonus", e.target.value)}
                    placeholder="0" style={{ ...smInput, borderColor: r.bonus ? "rgba(16,185,129,0.4)" : t.border }} />
                  <input value={r.note} onChange={e => setRate(u.uid, "note", e.target.value)}
                    placeholder="заметка..." style={{ ...smInput }} />
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: u.total > 0 ? "#10b981" : t.textFaint, fontSize: "14px", fontWeight: 700 }}>
                      {u.total > 0 ? `$${u.total.toFixed(0)}` : "—"}
                    </div>
                    {u.bonus > 0 && <div style={{ color: "#f59e0b", fontSize: "10px" }}>+${u.bonus.toFixed(0)} бонус</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div style={{ padding: "18px 22px", background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: t.text, fontSize: "15px", fontWeight: 700 }}>💰 Итого к выплате</div>
              <div style={{ color: t.textFaint, fontSize: "12px", marginTop: "3px" }}>
                {results.filter(u => u.total > 0).length} сотрудников · {period === "day" ? "день" : period === "week" ? "неделя" : "месяц"}
              </div>
            </div>
            <div style={{ color: "#10b981", fontSize: "26px", fontWeight: 800 }}>${grandTotal.toFixed(0)}</div>
          </div>
        </div>
      )}

      {mode === "conversion" && (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "18px" }}>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "18px" }}>Данные воронки</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                { label: "👁 Просмотры", v: views, set: setViews, ph: "10000" },
                { label: "🖱 Клики", v: clicks, set: setClicks, ph: "500" },
                { label: "🔔 Подписчики", v: subs, set: setSubs, ph: "50" },
                { label: "💵 Цена подписки ($)", v: subPrice, set: setSubPrice, ph: "9.99" },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "5px", fontWeight: 600 }}>{f.label}</label>
                  <input type="number" value={f.v} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={inputS} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "20px" }}>Результаты</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[
                { label: "CTR", value: ctr ? `${ctr}%` : "—", color: "#0ea5e9", icon: "👆", good: ctr > 3 },
                { label: "Конверсия в подписку", value: subRate ? `${subRate}%` : "—", color: "#7c3aed", icon: "🔔", good: subRate > 5 },
                { label: "Выручка", value: revenue ? `$${revenue}` : "—", color: "#10b981", icon: "💰", good: true },
                { label: "RPM (на 1000 просм.)", value: roas ? `$${roas}` : "—", color: "#f59e0b", icon: "📈", good: roas > 1 },
              ].map((m, i) => (
                <div key={i} style={{ background: t.bgCardHover, borderRadius: "12px", padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "20px" }}>{m.icon}</span>
                    {m.value !== "—" && <span style={{ background: m.good ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", color: m.good ? "#10b981" : "#ef4444", fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "6px" }}>{m.good ? "✓ OK" : "↑ Рост"}</span>}
                  </div>
                  <div style={{ color: m.color, fontSize: "24px", fontWeight: 700, marginBottom: "4px" }}>{m.value}</div>
                  <div style={{ color: t.textFaint, fontSize: "11px" }}>{m.label}</div>
                </div>
              ))}
            </div>
            {views && (
              <div style={{ marginTop: "20px" }}>
                <div style={{ color: t.textMuted, fontSize: "11px", fontWeight: 700, marginBottom: "10px", textTransform: "uppercase" }}>Воронка</div>
                {[{ label: "Просмотры", val: parseFloat(views)||0, color: "#0ea5e9" }, { label: "Клики", val: parseFloat(clicks)||0, color: "#7c3aed" }, { label: "Подписки", val: parseFloat(subs)||0, color: "#10b981" }].map((step, i) => {
                  const pct = Math.round((step.val / (parseFloat(views)||1)) * 100);
                  return (
                    <div key={i} style={{ marginBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                        <span style={{ color: t.textMuted, fontSize: "12px" }}>{step.label}</span>
                        <span style={{ color: t.text, fontSize: "12px", fontWeight: 600 }}>{step.val.toLocaleString()} ({pct}%)</span>
                      </div>
                      <div style={{ height: "8px", background: t.border, borderRadius: "4px", overflow: "hidden" }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, delay: i * 0.1 }}
                          style={{ height: "100%", background: step.color, borderRadius: "4px" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {mode === "plan" && (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "18px" }}>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "18px" }}>Цель</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                { label: "🎯 Цель по выручке ($)", v: targetRevenue, set: setTargetRevenue, ph: "5000" },
                { label: "💵 Средний чек ($)", v: avgCheck, set: setAvgCheck, ph: "15" },
                { label: "📊 Конверсия клик→подписка (%)", v: convRate, set: setConvRate, ph: "8" },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "5px", fontWeight: 600 }}>{f.label}</label>
                  <input type="number" value={f.v} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={inputS} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "20px" }}>Что нужно сделать</h3>
            {neededSubs ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { icon: "💰", label: "Нужно выручки", value: `$${parseFloat(targetRevenue).toLocaleString()}`, color: "#10b981" },
                  { icon: "🔔", label: "Нужно подписчиков", value: neededSubs.toLocaleString(), color: "#7c3aed" },
                  { icon: "🖱", label: "Нужно кликов", value: neededClicks ? neededClicks.toLocaleString() : "—", color: "#0ea5e9" },
                  { icon: "📝", label: "Нужно постов (прибл.)", value: neededPosts ? neededPosts.toLocaleString() : "—", color: "#f59e0b" },
                  { icon: "📅", label: "Постов в день (30 дней)", value: neededPosts ? Math.ceil(neededPosts / 30) : "—", color: "#8b5cf6" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "13px 16px", background: t.bgCardHover, borderRadius: "10px" }}>
                    <span style={{ fontSize: "20px" }}>{item.icon}</span>
                    <div style={{ flex: 1, color: t.textMuted, fontSize: "13px" }}>{item.label}</div>
                    <div style={{ color: item.color, fontSize: "18px", fontWeight: 700 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: t.textFaint, textAlign: "center", padding: "40px", fontSize: "14px" }}>Заполни поля слева</div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── FINANCE TAB ───────────────────────────────────────────────────────────────
function FinanceTab({ db, t }) {
  const [entries, setEntries] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState(30);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    type: "income",       // income | expense
    amount: "",
    description: "",
    tag: "",              // free-form tag
    note: "",
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, "finance_entries"), orderBy("date", "desc")),
      snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [db]);

  const save = async () => {
    if (!form.amount || !form.description) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        amount: parseFloat(form.amount) || 0,
        updatedAt: new Date().toISOString(),
      };
      if (editEntry) {
        const { id, ...rest } = data;
        await import("firebase/firestore").then(m =>
          m.updateDoc(m.doc(db, "finance_entries", editEntry.id), rest)
        );
      } else {
        await addDoc(collection(db, "finance_entries"), { ...data, createdAt: new Date().toISOString() });
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditEntry(null);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const del = async (id) => {
    await import("firebase/firestore").then(m => m.deleteDoc(m.doc(db, "finance_entries", id)));
    setConfirmDel(null);
  };

  const startEdit = (e) => {
    setForm({ ...e });
    setEditEntry(e);
    setShowForm(true);
  };

  // Filter by period
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - filterPeriod);
  const filtered = entries.filter(e => !e.date || new Date(e.date) >= cutoff);

  const income   = filtered.filter(e => e.type === "income");
  const expense  = filtered.filter(e => e.type === "expense");
  const totalIn  = income.reduce((s, e) => s + (e.amount || 0), 0);
  const totalOut = expense.reduce((s, e) => s + (e.amount || 0), 0);
  const profit   = totalIn - totalOut;

  // By tag
  const byTag = Object.entries(
    filtered.reduce((acc, e) => {
      const k = e.tag || "Без тега";
      if (!acc[k]) acc[k] = { income: 0, expense: 0 };
      if (e.type === "income") acc[k].income += e.amount || 0;
      else acc[k].expense += e.amount || 0;
      return acc;
    }, {})
  ).sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense));

  // By date last 30 days
  const last30 = Array.from({ length: Math.min(filterPeriod, 30) }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (Math.min(filterPeriod, 30) - 1 - i));
    return d.toISOString().split("T")[0];
  });
  const byDate = last30.map(date => ({
    date,
    label: new Date(date).getDate(),
    income:  filtered.filter(e => e.date === date && e.type === "income").reduce((s, e) => s + e.amount, 0),
    expense: filtered.filter(e => e.date === date && e.type === "expense").reduce((s, e) => s + e.amount, 0),
  }));
  const maxBar = Math.max(...byDate.map(d => Math.max(d.income, d.expense)), 1);

  const inputS = { background: t.bgInput, color: t.text, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "10px 14px", fontSize: "13px", outline: "none", fontFamily: "inherit", width: "100%" };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

      {/* Controls */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {[7, 14, 30, 90, 365].map(d => (
            <button key={d} onClick={() => setFilterPeriod(d)}
              style={{ padding: "7px 14px", borderRadius: "8px", border: `1px solid ${filterPeriod === d ? "#7c3aed" : t.border}`, background: filterPeriod === d ? "rgba(124,58,237,0.15)" : t.bgCard, color: filterPeriod === d ? "#a78bfa" : t.textMuted, fontSize: "13px", fontWeight: filterPeriod === d ? 700 : 400, cursor: "pointer" }}>
              {d === 365 ? "Год" : `${d}д`}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => { setForm({ ...emptyForm, type: "expense" }); setEditEntry(null); setShowForm(true); }}
          style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", borderRadius: "10px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
          <Minus size={14} />Расход
        </button>
        <button onClick={() => { setForm({ ...emptyForm, type: "income" }); setEditEntry(null); setShowForm(true); }}
          style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981", borderRadius: "10px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
          <Plus size={14} />Доход
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "20px" }}>
        {[
          { label: "Доходы", value: `$${totalIn.toLocaleString("ru-RU", { minimumFractionDigits: 0 })}`, color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)", icon: "📈", count: income.length },
          { label: "Расходы", value: `$${totalOut.toLocaleString("ru-RU", { minimumFractionDigits: 0 })}`, color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", icon: "📉", count: expense.length },
          { label: "Прибыль", value: `${profit >= 0 ? "+" : ""}$${profit.toLocaleString("ru-RU", { minimumFractionDigits: 0 })}`, color: profit >= 0 ? "#10b981" : "#ef4444", bg: profit >= 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: profit >= 0 ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)", icon: profit >= 0 ? "✅" : "⚠️", count: filtered.length },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: "16px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ color: t.textMuted, fontSize: "12px", marginBottom: "6px" }}>{s.label}</div>
                <div style={{ color: s.color, fontSize: "26px", fontWeight: 800, lineHeight: 1 }}>{s.value}</div>
                <div style={{ color: t.textFaint, fontSize: "11px", marginTop: "5px" }}>{s.count} операций</div>
              </div>
              <span style={{ fontSize: "24px" }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "16px", marginBottom: "16px" }}>
        {/* Bar chart */}
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "20px" }}>
          <h3 style={{ color: t.text, fontSize: "14px", fontWeight: 600, marginBottom: "16px" }}>
            Доходы / Расходы по дням
            <span style={{ marginLeft: "12px", color: t.textFaint, fontSize: "11px", fontWeight: 400 }}>
              <span style={{ color: "#10b981" }}>■</span> доходы &nbsp;
              <span style={{ color: "#ef4444" }}>■</span> расходы
            </span>
          </h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "90px" }}>
            {byDate.map((d, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", height: "100%" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "1px", width: "100%" }}>
                  {d.income > 0 && (
                    <motion.div initial={{ height: 0 }} animate={{ height: `${Math.round((d.income / maxBar) * 100) * 0.9}%` }}
                      transition={{ duration: 0.4, delay: i * 0.01 }}
                      style={{ background: "#10b981", borderRadius: "2px 2px 0 0", minHeight: "3px" }}
                      title={`Доход: $${d.income}`} />
                  )}
                  {d.expense > 0 && (
                    <motion.div initial={{ height: 0 }} animate={{ height: `${Math.round((d.expense / maxBar) * 100) * 0.9}%` }}
                      transition={{ duration: 0.4, delay: i * 0.01 }}
                      style={{ background: "#ef4444", borderRadius: "2px 2px 0 0", minHeight: "3px" }}
                      title={`Расход: $${d.expense}`} />
                  )}
                  {d.income === 0 && d.expense === 0 && (
                    <div style={{ height: "3px", background: t.border, borderRadius: "2px" }} />
                  )}
                </div>
                {i % 5 === 0 && <div style={{ color: t.textFaint, fontSize: "9px" }}>{d.label}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* By tag */}
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "20px" }}>
          <h3 style={{ color: t.text, fontSize: "14px", fontWeight: 600, marginBottom: "14px" }}>По тегам</h3>
          {byTag.length === 0 ? (
            <div style={{ color: t.textFaint, fontSize: "13px", textAlign: "center", padding: "20px" }}>Нет данных</div>
          ) : byTag.slice(0, 7).map(([tag, data], i) => (
            <div key={tag} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < byTag.slice(0, 7).length - 1 ? `1px solid ${t.border}` : "none" }}>
              <span style={{ color: t.textMuted, fontSize: "12px" }}>#{tag}</span>
              <div style={{ display: "flex", gap: "10px" }}>
                {data.income > 0 && <span style={{ color: "#10b981", fontSize: "12px", fontWeight: 600 }}>+${data.income.toFixed(0)}</span>}
                {data.expense > 0 && <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: 600 }}>-${data.expense.toFixed(0)}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions table */}
      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: t.text, fontSize: "14px", fontWeight: 600 }}>Все операции</span>
          <span style={{ color: t.textFaint, fontSize: "12px" }}>{filtered.length} записей</span>
        </div>
        <div style={{ maxHeight: "420px", overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: t.textFaint, fontSize: "13px" }}>
              Нет записей. Добавь первый доход или расход.
            </div>
          ) : filtered.map((e, i) => (
            <div key={e.id}
              style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 20px", borderBottom: i < filtered.length - 1 ? `1px solid ${t.border}` : "none" }}
              onMouseEnter={ev => ev.currentTarget.style.background = t.bgCardHover}
              onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>

              {/* Type icon */}
              <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: e.type === "income" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                {e.type === "income" ? "📈" : "📉"}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: t.text, fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.description}</span>
                  {e.tag && <span style={{ background: t.bgCardHover, color: t.textMuted, fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "20px", flexShrink: 0 }}>#{e.tag}</span>}
                </div>
                <div style={{ color: t.textFaint, fontSize: "11px", marginTop: "2px" }}>
                  {e.date}{e.note ? ` · ${e.note}` : ""}
                </div>
              </div>

              {/* Amount */}
              <div style={{ color: e.type === "income" ? "#10b981" : "#ef4444", fontSize: "15px", fontWeight: 700, flexShrink: 0 }}>
                {e.type === "income" ? "+" : "-"}${(e.amount || 0).toFixed(2)}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                <button onClick={() => startEdit(e)}
                  style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", padding: "4px" }}
                  onMouseEnter={ev => ev.currentTarget.style.color = "#7c3aed"}
                  onMouseLeave={ev => ev.currentTarget.style.color = t.textFaint}>
                  <Edit3 size={13} />
                </button>
                <button onClick={() => setConfirmDel(e)}
                  style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", padding: "4px" }}
                  onMouseEnter={ev => ev.currentTarget.style.color = "#ef4444"}
                  onMouseLeave={ev => ev.currentTarget.style.color = t.textFaint}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setShowForm(false); setEditEntry(null); }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: t.bgSecondary || t.bgCard, border: `1px solid ${t.border}`, borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "440px", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
                <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 700 }}>
                  {editEntry ? "✏️ Редактировать" : form.type === "income" ? "📈 Новый доход" : "📉 Новый расход"}
                </h3>
                <button onClick={() => { setShowForm(false); setEditEntry(null); }} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Type toggle */}
                <div style={{ display: "flex", gap: "8px" }}>
                  {[{ v: "income", l: "📈 Доход", c: "#10b981", bc: "rgba(16,185,129,0.2)" }, { v: "expense", l: "📉 Расход", c: "#ef4444", bc: "rgba(239,68,68,0.2)" }].map(opt => (
                    <button key={opt.v} onClick={() => setForm({ ...form, type: opt.v })}
                      style={{ flex: 1, padding: "10px", borderRadius: "10px", border: `1px solid ${form.type === opt.v ? opt.bc : t.border}`, background: form.type === opt.v ? opt.bc : t.bgCardHover, color: form.type === opt.v ? opt.c : t.textMuted, fontSize: "14px", fontWeight: form.type === opt.v ? 700 : 400, cursor: "pointer" }}>
                      {opt.l}
                    </button>
                  ))}
                </div>

                <div>
                  <label style={{ color: t.textMuted, fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase" }}>Дата</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputS} />
                </div>

                <div>
                  <label style={{ color: t.textMuted, fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase" }}>Сумма ($) *</label>
                  <input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                    style={{ ...inputS, fontSize: "20px", fontWeight: 700, color: form.type === "income" ? "#10b981" : "#ef4444", borderColor: form.amount ? (form.type === "income" ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)") : t.border }} />
                </div>

                <div>
                  <label style={{ color: t.textMuted, fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase" }}>Описание *</label>
                  <input placeholder="Зарплата команды, реклама, выручка OF..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={inputS} />
                </div>

                <div>
                  <label style={{ color: t.textMuted, fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase" }}>Тег (необязательно)</label>
                  <input placeholder="зарплата, реклама, onlyfans, инструменты..." value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })}
                    style={inputS} />
                  <div style={{ color: t.textFaint, fontSize: "11px", marginTop: "4px" }}>Свободный тег для группировки в аналитике</div>
                </div>

                <div>
                  <label style={{ color: t.textMuted, fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase" }}>Заметка</label>
                  <textarea placeholder="Дополнительные детали..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                    rows={2} style={{ ...inputS, resize: "none" }} />
                </div>

                <button onClick={save} disabled={saving || !form.amount || !form.description}
                  style={{ width: "100%", background: (!form.amount || !form.description) ? "rgba(124,58,237,0.3)" : form.type === "income" ? "linear-gradient(135deg, #059669, #10b981)" : "linear-gradient(135deg, #dc2626, #ef4444)", color: "#fff", border: "none", borderRadius: "12px", padding: "13px", fontSize: "15px", fontWeight: 700, cursor: (!form.amount || !form.description) ? "not-allowed" : "pointer" }}>
                  {saving ? "Сохраняем..." : editEntry ? "Сохранить" : form.type === "income" ? "Добавить доход" : "Добавить расход"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {confirmDel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setConfirmDel(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.93 }} animate={{ scale: 1 }} exit={{ scale: 0.93 }}
              onClick={e => e.stopPropagation()}
              style={{ background: t.bgSecondary || t.bgCard, border: "1px solid rgba(239,68,68,0.3)", borderRadius: "18px", padding: "24px", maxWidth: "360px", width: "100%", textAlign: "center" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>🗑️</div>
              <h3 style={{ color: t.text, marginBottom: "8px" }}>Удалить запись?</h3>
              <p style={{ color: t.textMuted, fontSize: "13px", marginBottom: "20px" }}>{confirmDel.description} · ${confirmDel.amount}</p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => del(confirmDel.id)} style={{ flex: 1, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: "10px", padding: "11px", fontWeight: 600, cursor: "pointer" }}>Удалить</button>
                <button onClick={() => setConfirmDel(null)} style={{ flex: 1, background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "10px", padding: "11px", cursor: "pointer" }}>Отмена</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── KPI TAB ───────────────────────────────────────────────────────────────────
function KpiTab({ users, entries, tasks, grid, t }) {
  const [period, setPeriod] = useState(30);

  const days = Array.from({ length: period }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return d.toLocaleDateString("ru-RU");
  });

  const userStats = users.map(u => {
    const userEntries = entries.filter(e => e.userId === u.uid && days.includes(e.date));
    const userTasks   = tasks.filter(t => t.assigneeId === u.uid && t.column === "done");
    const posted      = grid.filter(g => g.updatedByUid === u.uid && days.includes(g.date) && g.status === "posted");
    const problems    = grid.filter(g => g.updatedByUid === u.uid && days.includes(g.date) && g.status === "problem");
    const score = userEntries.length * 3 + posted.length * 2 + userTasks.length * 5 - problems.length * 2;
    return { ...u, postsCount: userEntries.length, tasksCount: userTasks.length, postedCount: posted.length, problemsCount: problems.length, score: Math.max(0, score) };
  }).sort((a, b) => b.score - a.score);

  const maxScore = Math.max(...userStats.map(u => u.score), 1);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", alignItems: "center" }}>
        <span style={{ color: t.textMuted, fontSize: "13px" }}>Период:</span>
        {[{ v: 7, l: "7 дней" }, { v: 30, l: "30 дней" }, { v: 90, l: "90 дней" }].map(opt => (
          <button key={opt.v} onClick={() => setPeriod(opt.v)}
            style={{ padding: "7px 14px", borderRadius: "8px", border: `1px solid ${period === opt.v ? "#7c3aed" : t.border}`, background: period === opt.v ? "rgba(124,58,237,0.15)" : t.bgCard, color: period === opt.v ? "#a78bfa" : t.textMuted, fontSize: "13px", fontWeight: period === opt.v ? 700 : 400, cursor: "pointer" }}>
            {opt.l}
          </button>
        ))}
      </div>

      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}`, display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr" }}>
          {["Сотрудник", "Записей", "Постов Reddit", "Проблем", "Задач", "Скор"].map((h, i) => (
            <div key={i} style={{ color: t.textFaint, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: i > 0 ? "center" : "left" }}>{h}</div>
          ))}
        </div>

        {userStats.map((u, i) => {
          const rc = ROLE_COLORS[u.role] || "#64748b";
          const pct = Math.round((u.score / maxScore) * 100);
          const medals = ["🥇", "🥈", "🥉"];
          return (
            <div key={u.id} style={{ padding: "14px 20px", borderBottom: i < userStats.length - 1 ? `1px solid ${t.border}` : "none", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", alignItems: "center" }}
              onMouseEnter={e => e.currentTarget.style.background = t.bgCardHover}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "14px", width: "22px" }}>{medals[i] || `${i + 1}.`}</span>
                <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: `linear-gradient(135deg, ${rc}, ${rc}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: u.avatarEmoji ? "15px" : "12px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {u.avatarEmoji || (u.name || "?")[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{u.name}</div>
                  <div style={{ color: t.textFaint, fontSize: "11px" }}>{ROLE_LABELS[u.role] || u.role}</div>
                </div>
              </div>
              <div style={{ textAlign: "center", color: t.text, fontSize: "14px", fontWeight: 600 }}>{u.postsCount}</div>
              <div style={{ textAlign: "center", color: "#10b981", fontSize: "14px", fontWeight: 600 }}>{u.postedCount}</div>
              <div style={{ textAlign: "center", color: u.problemsCount > 0 ? "#f59e0b" : t.textFaint, fontSize: "14px", fontWeight: 600 }}>{u.problemsCount}</div>
              <div style={{ textAlign: "center", color: "#0ea5e9", fontSize: "14px", fontWeight: 600 }}>{u.tasksCount}</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: i === 0 ? "#f59e0b" : "#7c3aed", fontSize: "15px", fontWeight: 700, marginBottom: "4px" }}>{u.score}</div>
                <div style={{ height: "4px", background: t.border, borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: i === 0 ? "linear-gradient(90deg, #f59e0b, #f97316)" : "linear-gradient(90deg, #7c3aed, #db2877)", borderRadius: "2px" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "14px", background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: "12px", padding: "12px 16px" }}>
        <span style={{ color: "#a78bfa", fontSize: "12px" }}>📊 Скор = (записи × 3) + (посты Reddit × 2) + (задачи выполнены × 5) − (проблемы × 2)</span>
      </div>
    </motion.div>
  );
}

// ── REDDIT STATS TAB ──────────────────────────────────────────────────────────
function RedditStatsTab({ db, models, t }) {
  const [entries, setEntries] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [filterModel, setFilterModel] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState(30);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    modelId: "", modelName: "",
    subreddit: "",
    postTitle: "",
    views: "", upvotes: "", upvoteRatio: "", comments: "", shares: "",
    dms: "", newSubs: "", revenue: "",
    note: "",
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, "reddit_stats"), orderBy("date", "desc")),
      snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [db]);

  const save = async () => {
    if (!form.subreddit || !form.date) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        views:       parseInt(form.views)       || 0,
        upvotes:     parseInt(form.upvotes)      || 0,
        upvoteRatio: parseFloat(form.upvoteRatio)|| 0,
        comments:    parseInt(form.comments)     || 0,
        shares:      parseInt(form.shares)       || 0,
        dms:         parseInt(form.dms)          || 0,
        newSubs:     parseInt(form.newSubs)      || 0,
        revenue:     parseFloat(form.revenue)    || 0,
        updatedAt: new Date().toISOString(),
      };
      if (editEntry) {
        const { id, ...rest } = data;
        await import("firebase/firestore").then(m =>
          m.updateDoc(m.doc(db, "reddit_stats", editEntry.id), rest)
        );
      } else {
        await addDoc(collection(db, "reddit_stats"), { ...data, createdAt: new Date().toISOString() });
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditEntry(null);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const del = async (id) => {
    await import("firebase/firestore").then(m =>
      m.deleteDoc(m.doc(db, "reddit_stats", id))
    );
    setConfirmDel(null);
  };

  const startEdit = (e) => {
    setForm({ ...e, date: e.date || "" });
    setEditEntry(e);
    setShowForm(true);
  };

  // Filter
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - filterPeriod);
  const filtered = entries.filter(e => {
    if (filterModel !== "all" && e.modelId !== filterModel && e.modelName !== filterModel) return false;
    if (e.date && new Date(e.date) < cutoff) return false;
    return true;
  });

  // Aggregate
  const total = (key) => filtered.reduce((s, e) => s + (e[key] || 0), 0);
  const avg   = (key) => filtered.length ? (total(key) / filtered.length).toFixed(1) : 0;
  const bestPost = [...filtered].sort((a, b) => (b.views || 0) - (a.views || 0))[0];

  // By subreddit
  const bySubreddit = Object.entries(
    filtered.reduce((acc, e) => {
      const k = e.subreddit || "—";
      if (!acc[k]) acc[k] = { views: 0, upvotes: 0, dms: 0, revenue: 0, count: 0 };
      acc[k].views   += e.views   || 0;
      acc[k].upvotes += e.upvotes || 0;
      acc[k].dms     += e.dms     || 0;
      acc[k].revenue += e.revenue || 0;
      acc[k].count++;
      return acc;
    }, {})
  ).sort((a, b) => b[1].views - a[1].views);

  // By model
  const byModel = Object.entries(
    filtered.reduce((acc, e) => {
      const k = e.modelName || "—";
      if (!acc[k]) acc[k] = { views: 0, dms: 0, revenue: 0, count: 0 };
      acc[k].views   += e.views   || 0;
      acc[k].dms     += e.dms     || 0;
      acc[k].revenue += e.revenue || 0;
      acc[k].count++;
      return acc;
    }, {})
  ).sort((a, b) => b[1].views - a[1].views);

  // By date (last 14 days)
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split("T")[0];
  });
  const byDate = last14.map(date => ({
    date,
    label: new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
    views: filtered.filter(e => e.date === date).reduce((s, e) => s + (e.views || 0), 0),
    dms:   filtered.filter(e => e.date === date).reduce((s, e) => s + (e.dms   || 0), 0),
  }));
  const maxViews = Math.max(...byDate.map(d => d.views), 1);

  const inputS = { background: t.bgInput, color: t.text, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit", width: "100%" };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

      {/* Controls */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
        <select value={filterModel} onChange={e => setFilterModel(e.target.value)}
          style={{ ...inputS, width: "auto" }}>
          <option value="all">Все модели</option>
          {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div style={{ display: "flex", gap: "6px" }}>
          {[7, 14, 30, 90].map(d => (
            <button key={d} onClick={() => setFilterPeriod(d)}
              style={{ padding: "8px 14px", borderRadius: "8px", border: `1px solid ${filterPeriod === d ? "#7c3aed" : t.border}`, background: filterPeriod === d ? "rgba(124,58,237,0.15)" : t.bgCard, color: filterPeriod === d ? "#a78bfa" : t.textMuted, fontSize: "13px", fontWeight: filterPeriod === d ? 700 : 400, cursor: "pointer" }}>
              {d}д
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => { setForm(emptyForm); setEditEntry(null); setShowForm(true); }}
          style={{ display: "flex", alignItems: "center", gap: "7px", background: "linear-gradient(135deg, #7c3aed, #db2877)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
          <Plus size={15} />Добавить запись
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        {[
          { icon: "👁",  label: "Просмотры",    value: fmt(total("views")),   color: "#0ea5e9" },
          { icon: "⬆️",  label: "Upvotes",       value: fmt(total("upvotes")), color: "#7c3aed" },
          { icon: "💬",  label: "Комментарии",   value: fmt(total("comments")),color: "#8b5cf6" },
          { icon: "📩",  label: "DM конверсия",  value: fmt(total("dms")),     color: "#10b981" },
          { icon: "🔔",  label: "Новых подписок",value: fmt(total("newSubs")), color: "#f59e0b" },
          { icon: "💰",  label: "Выручка",       value: `$${fmt(total("revenue"))}`, color: "#db2877" },
        ].map((s, i) => (
          <div key={i} style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "14px", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ color: t.textMuted, fontSize: "11px", marginBottom: "5px" }}>{s.label}</div>
                <div style={{ color: t.text, fontSize: "22px", fontWeight: 700 }}>{s.value}</div>
                <div style={{ color: t.textFaint, fontSize: "10px", marginTop: "3px" }}>ср. {filtered.length > 0 ? (total(s.label === "Выручка" ? "revenue" : s.label === "Просмотры" ? "views" : s.label === "Upvotes" ? "upvotes" : s.label === "Комментарии" ? "comments" : s.label === "DM конверсия" ? "dms" : "newSubs") / filtered.length).toFixed(0) : 0} / пост</div>
              </div>
              <span style={{ fontSize: "20px" }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>

        {/* Chart by date */}
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "20px" }}>
          <h3 style={{ color: t.text, fontSize: "14px", fontWeight: 600, marginBottom: "16px" }}>👁 Просмотры по дням</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "100px" }}>
            {byDate.map((d, i) => {
              const h = maxViews > 0 ? Math.round((d.views / maxViews) * 100) : 0;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                  <motion.div initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.5, delay: i * 0.03 }}
                    style={{ width: "100%", minHeight: d.views > 0 ? "4px" : "2px", background: d.views > 0 ? "linear-gradient(180deg, #7c3aed, #db2877)" : t.border, borderRadius: "3px 3px 0 0", cursor: "default" }}
                    title={`${d.label}: ${fmt(d.views)} просмотров`} />
                  {i % 3 === 0 && <div style={{ color: t.textFaint, fontSize: "9px", textAlign: "center", lineHeight: 1 }}>{new Date(d.date).getDate()}</div>}
                </div>
              );
            })}
          </div>
          {filtered.length === 0 && <div style={{ color: t.textFaint, fontSize: "12px", textAlign: "center", marginTop: "8px" }}>Нет данных за период</div>}
        </div>

        {/* Top subreddits */}
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "20px" }}>
          <h3 style={{ color: t.text, fontSize: "14px", fontWeight: 600, marginBottom: "14px" }}>🏆 Топ сабреддитов</h3>
          {bySubreddit.length === 0 ? (
            <div style={{ color: t.textFaint, fontSize: "12px", textAlign: "center", padding: "20px" }}>Нет данных</div>
          ) : bySubreddit.slice(0, 5).map(([sub, data], i) => {
            const maxV = bySubreddit[0]?.[1]?.views || 1;
            const pct = Math.round((data.views / maxV) * 100);
            return (
              <div key={sub} style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                  <span style={{ color: "#ff4500", fontSize: "12px", fontWeight: 600 }}>r/{sub}</span>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <span style={{ color: t.textMuted, fontSize: "11px" }}>👁 {fmt(data.views)}</span>
                    <span style={{ color: "#10b981", fontSize: "11px" }}>📩 {data.dms}</span>
                    <span style={{ color: "#db2877", fontSize: "11px" }}>${data.revenue.toFixed(0)}</span>
                  </div>
                </div>
                <div style={{ height: "5px", background: t.border, borderRadius: "3px", overflow: "hidden" }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: i * 0.08 }}
                    style={{ height: "100%", background: "linear-gradient(90deg, #ff4500, #ff6534)", borderRadius: "3px" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>

        {/* By model */}
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "20px" }}>
          <h3 style={{ color: t.text, fontSize: "14px", fontWeight: 600, marginBottom: "14px" }}>👤 По моделям</h3>
          {byModel.length === 0 ? (
            <div style={{ color: t.textFaint, fontSize: "12px", textAlign: "center", padding: "20px" }}>Нет данных</div>
          ) : byModel.map(([name, data], i) => {
            const model = models.find(m => m.name === name);
            const color = model?.color || "#7c3aed";
            const maxV = byModel[0]?.[1]?.views || 1;
            const pct = Math.round((data.views / maxV) * 100);
            return (
              <div key={name} style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <div style={{ width: "20px", height: "20px", borderRadius: "6px", background: `linear-gradient(135deg, ${color}, ${color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>
                      {model?.emoji || name[0]}
                    </div>
                    <span style={{ color: t.text, fontSize: "12px", fontWeight: 600 }}>{name}</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span style={{ color: t.textMuted, fontSize: "11px" }}>👁 {fmt(data.views)}</span>
                    <span style={{ color: "#db2877", fontSize: "11px" }}>${data.revenue.toFixed(0)}</span>
                  </div>
                </div>
                <div style={{ height: "5px", background: t.border, borderRadius: "3px", overflow: "hidden" }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: i * 0.08 }}
                    style={{ height: "100%", background: `linear-gradient(90deg, ${color}, ${color}88)`, borderRadius: "3px" }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Best post + DM funnel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {bestPost && (
            <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "16px", padding: "18px" }}>
              <div style={{ color: "#f59e0b", fontSize: "12px", fontWeight: 700, marginBottom: "10px" }}>🏆 Лучший пост</div>
              <div style={{ color: t.text, fontSize: "13px", fontWeight: 600, marginBottom: "6px", lineHeight: "1.4" }}>{bestPost.postTitle || `r/${bestPost.subreddit}`}</div>
              <div style={{ color: t.textMuted, fontSize: "12px", marginBottom: "8px" }}>r/{bestPost.subreddit} · {bestPost.modelName} · {bestPost.date}</div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {[
                  { icon: "👁", val: fmt(bestPost.views) },
                  { icon: "⬆️", val: bestPost.upvotes },
                  { icon: "💬", val: bestPost.comments },
                  { icon: "📩", val: bestPost.dms },
                ].map((s, i) => (
                  <span key={i} style={{ color: t.text, fontSize: "12px" }}>{s.icon} {s.val}</span>
                ))}
              </div>
            </div>
          )}

          {/* Avg upvote ratio */}
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "18px", flex: 1 }}>
            <div style={{ color: t.text, fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>📊 Средние показатели поста</div>
            {filtered.length === 0 ? (
              <div style={{ color: t.textFaint, fontSize: "12px" }}>Нет данных</div>
            ) : [
              { label: "Просмотров", val: Math.round(total("views") / filtered.length), icon: "👁" },
              { label: "Upvotes", val: Math.round(total("upvotes") / filtered.length), icon: "⬆️" },
              { label: "Комментариев", val: Math.round(total("comments") / filtered.length), icon: "💬" },
              { label: "DM", val: Math.round(total("dms") / filtered.length), icon: "📩" },
              { label: "Upvote ratio", val: filtered.filter(e => e.upvoteRatio).length > 0 ? (filtered.reduce((s, e) => s + (e.upvoteRatio || 0), 0) / filtered.filter(e => e.upvoteRatio).length * 100).toFixed(0) + "%" : "—", icon: "📈" },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < 4 ? `1px solid ${t.border}` : "none" }}>
                <span style={{ color: t.textMuted, fontSize: "12px" }}>{row.icon} {row.label}</span>
                <span style={{ color: t.text, fontSize: "13px", fontWeight: 700 }}>{row.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: t.text, fontSize: "14px", fontWeight: 600 }}>Все записи</span>
          <span style={{ color: t.textFaint, fontSize: "12px" }}>{filtered.length} постов</span>
        </div>
        <div style={{ maxHeight: "400px", overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: t.textFaint }}>
              Нет данных. Добавь первую запись через кнопку выше.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: t.bgCardHover }}>
                  {["Дата", "Модель", "Сабреддит", "Пост", "Просмотры", "⬆️", "💬", "📩 DM", "🔔", "💰", ""].map((h, i) => (
                    <th key={i} style={{ padding: "10px 12px", color: t.textFaint, fontWeight: 600, textAlign: "left", whiteSpace: "nowrap", borderBottom: `1px solid ${t.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.id}
                    onMouseEnter={ev => ev.currentTarget.style.background = t.bgCardHover}
                    onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "10px 12px", color: t.textMuted, whiteSpace: "nowrap" }}>{e.date}</td>
                    <td style={{ padding: "10px 12px", color: t.text, fontWeight: 600 }}>{e.modelName || "—"}</td>
                    <td style={{ padding: "10px 12px", color: "#ff4500", fontWeight: 600 }}>r/{e.subreddit}</td>
                    <td style={{ padding: "10px 12px", color: t.textMuted, maxWidth: "160px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.postTitle || "—"}</td>
                    <td style={{ padding: "10px 12px", color: t.text, fontWeight: 600 }}>{fmt(e.views)}</td>
                    <td style={{ padding: "10px 12px", color: "#7c3aed" }}>{e.upvotes || 0}</td>
                    <td style={{ padding: "10px 12px", color: t.textMuted }}>{e.comments || 0}</td>
                    <td style={{ padding: "10px 12px", color: "#10b981", fontWeight: 600 }}>{e.dms || 0}</td>
                    <td style={{ padding: "10px 12px", color: "#f59e0b" }}>{e.newSubs || 0}</td>
                    <td style={{ padding: "10px 12px", color: "#db2877", fontWeight: 600 }}>{e.revenue ? `$${e.revenue}` : "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => startEdit(e)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: "2px" }}
                          onMouseEnter={ev => ev.currentTarget.style.color = "#7c3aed"}
                          onMouseLeave={ev => ev.currentTarget.style.color = t.textMuted}>
                          <Edit3 size={13} />
                        </button>
                        <button onClick={() => setConfirmDel(e)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: "2px" }}
                          onMouseEnter={ev => ev.currentTarget.style.color = "#ef4444"}
                          onMouseLeave={ev => ev.currentTarget.style.color = t.textMuted}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setShowForm(false); setEditEntry(null); }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: t.bgSecondary || t.bgCard, border: `1px solid ${t.border}`, borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
                <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 700 }}>{editEntry ? "✏️ Редактировать запись" : "➕ Новая Reddit запись"}</h3>
                <button onClick={() => { setShowForm(false); setEditEntry(null); }} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {/* Row 1 */}
                <div>
                  <label style={{ color: t.textMuted, fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase" }}>Дата</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputS} />
                </div>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase" }}>Модель</label>
                  <select value={form.modelId} onChange={e => {
                    const m = models.find(m => m.id === e.target.value);
                    setForm({ ...form, modelId: e.target.value, modelName: m?.name || "" });
                  }} style={inputS}>
                    <option value="">Выбери...</option>
                    {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>

                {/* Row 2 */}
                <div>
                  <label style={{ color: t.textMuted, fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase" }}>Сабреддит</label>
                  <input placeholder="nsfwonlyfans18" value={form.subreddit} onChange={e => setForm({ ...form, subreddit: e.target.value.replace("r/", "") })} style={inputS} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ color: t.textMuted, fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase" }}>Заголовок поста</label>
                  <input placeholder="Заголовок..." value={form.postTitle} onChange={e => setForm({ ...form, postTitle: e.target.value })} style={inputS} />
                </div>

                {/* Divider */}
                <div style={{ gridColumn: "1 / -1", borderBottom: `1px solid ${t.border}`, margin: "4px 0" }} />
                <div style={{ gridColumn: "1 / -1", color: t.textMuted, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>📊 Метрики поста</div>

                {[
                  { key: "views",       label: "👁 Просмотры",    ph: "10000" },
                  { key: "upvotes",     label: "⬆️ Upvotes",       ph: "250" },
                  { key: "upvoteRatio", label: "📈 Upvote ratio",  ph: "0.92" },
                  { key: "comments",    label: "💬 Комментарии",   ph: "45" },
                  { key: "shares",      label: "🔗 Шеры",          ph: "12" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ color: t.textMuted, fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "5px" }}>{f.label}</label>
                    <input type="number" placeholder={f.ph} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={inputS} />
                  </div>
                ))}

                {/* Divider */}
                <div style={{ gridColumn: "1 / -1", borderBottom: `1px solid ${t.border}`, margin: "4px 0" }} />
                <div style={{ gridColumn: "1 / -1", color: t.textMuted, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>💰 Бизнес метрики</div>

                {[
                  { key: "dms",     label: "📩 Новых DM",       ph: "15" },
                  { key: "newSubs", label: "🔔 Новых подписчиков", ph: "5" },
                  { key: "revenue", label: "💰 Выручка ($)",     ph: "49.95" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ color: t.textMuted, fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "5px" }}>{f.label}</label>
                    <input type="number" placeholder={f.ph} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={inputS} />
                  </div>
                ))}

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ color: t.textMuted, fontSize: "11px", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase" }}>Заметка</label>
                  <textarea placeholder="Что сработало, что нет..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                    rows={2} style={{ ...inputS, resize: "none" }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button onClick={save} disabled={saving || !form.subreddit}
                  style={{ flex: 1, background: form.subreddit ? "linear-gradient(135deg, #7c3aed, #db2877)" : "rgba(124,58,237,0.3)", color: "#fff", border: "none", borderRadius: "12px", padding: "13px", fontSize: "14px", fontWeight: 700, cursor: form.subreddit ? "pointer" : "not-allowed" }}>
                  {saving ? "Сохраняем..." : editEntry ? "Сохранить" : "Добавить"}
                </button>
                <button onClick={() => { setShowForm(false); setEditEntry(null); }}
                  style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "12px", padding: "13px 20px", cursor: "pointer" }}>Отмена</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {confirmDel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setConfirmDel(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.93 }} animate={{ scale: 1 }} exit={{ scale: 0.93 }}
              onClick={e => e.stopPropagation()}
              style={{ background: t.bgSecondary || t.bgCard, border: "1px solid rgba(239,68,68,0.3)", borderRadius: "18px", padding: "24px", maxWidth: "360px", width: "100%", textAlign: "center" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>🗑️</div>
              <h3 style={{ color: t.text, marginBottom: "8px" }}>Удалить запись?</h3>
              <p style={{ color: t.textMuted, fontSize: "13px", marginBottom: "20px" }}>r/{confirmDel.subreddit} · {confirmDel.date}</p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => del(confirmDel.id)} style={{ flex: 1, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: "10px", padding: "11px", fontWeight: 600, cursor: "pointer" }}>Удалить</button>
                <button onClick={() => setConfirmDel(null)} style={{ flex: 1, background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "10px", padding: "11px", cursor: "pointer" }}>Отмена</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
