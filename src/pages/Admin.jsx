import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, query, orderBy, limit, addDoc, getDocs } from "firebase/firestore";
import { useAuth, ROLE_COLORS, ROLE_LABELS, ROLE_LABELS_DISPLAY } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  Shield, Activity, Users, TrendingUp, FileText, Calculator,
  Clock, Filter, ChevronDown, AlertTriangle, CheckCircle,
  MessageSquare, Star, DollarSign, Percent, Target, Zap,
  Download, RefreshCw, Search, Eye, BarChart2, Award,
  Edit3, Trash2, Plus, X, Minus, Globe
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
  { key: "online",       label: "Онлайн",          icon: Users },
  { key: "logs",         label: "Логи",            icon: Activity },
  { key: "reddit",       label: "Reddit Stats",    icon: TrendingUp },
  { key: "finance",      label: "Финансы",         icon: DollarSign },
  { key: "platforms",    label: "Платформы",       icon: Globe },
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
      {tab === "online" && (
        <OnlineTab users={users} t={t} />
      )}

      {tab === "logs" && (
        <LogsTab logs={logs} users={users} entries={entries} tasks={tasks} grid={grid} t={t} />
      )}

      {/* ── CALCULATOR ───────────────────────────────────────────────────────── */}
      {tab === "finance" && (
        <FinanceTab db={db} t={t} />
      )}

      {tab === "platforms" && (
        <PlatformsTab db={db} t={t} />
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



// ── ONLINE TAB ────────────────────────────────────────────────────────────────
function OnlineTab({ users, t }) {
  const [search,     setSearch]     = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [sortBy,     setSortBy]     = useState("status"); // status | name | last
  const [now,        setNow]        = useState(Date.now());

  // Live clock for "X минут назад"
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(iv);
  }, []);

  const fmtAgo = (iso) => {
    if (!iso) return "Никогда";
    const diff = now - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1)  return "Только что";
    if (m < 60) return `${m} мин назад`;
    if (h < 24) return `${h} ч назад`;
    if (d < 7)  return `${d} дн назад`;
    return new Date(iso).toLocaleDateString("ru-RU", { day:"numeric", month:"short" });
  };

  const fmtDateTime = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("ru-RU", {
      day:"2-digit", month:"2-digit", year:"numeric",
      hour:"2-digit", minute:"2-digit"
    });
  };

  const isOnline = (u) => {
    if (!u.isOnline) return false;
    if (!u.lastActiveAt) return false;
    // Consider online if last seen < 2 min ago
    return (now - new Date(u.lastActiveAt).getTime()) < 120000;
  };

  const getStatus = (u) => {
    if (isOnline(u)) return "online";
    if (!u.lastActiveAt) return "never";
    const diff = now - new Date(u.lastActiveAt).getTime();
    if (diff < 3600000)  return "recent";   // < 1h
    if (diff < 86400000) return "today";    // < 24h
    return "offline";
  };

  const STATUS_CONFIG = {
    online:  { label:"В сети",        color:"#10b981", dot:"#10b981", order:0 },
    recent:  { label:"Недавно",       color:"#f59e0b", dot:"#f59e0b", order:1 },
    today:   { label:"Сегодня",       color:"#0ea5e9", dot:"#0ea5e9", order:2 },
    offline: { label:"Не в сети",     color:"#475569", dot:"#475569", order:3 },
    never:   { label:"Не заходил",    color:"#334155", dot:"#334155", order:4 },
  };

  const filtered = users
    .filter(u => {
      if (filterRole !== "all" && u.role !== filterRole) return false;
      if (search && !u.name?.toLowerCase().includes(search.toLowerCase()) &&
          !u.role?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "status") {
        const oa = STATUS_CONFIG[getStatus(a)].order;
        const ob = STATUS_CONFIG[getStatus(b)].order;
        if (oa !== ob) return oa - ob;
      }
      if (sortBy === "name") return (a.name||"").localeCompare(b.name||"");
      if (sortBy === "last") {
        const ta = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const tb = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        return tb - ta;
      }
      return (a.name||"").localeCompare(b.name||"");
    });

  const onlineCount = users.filter(u => isOnline(u)).length;
  const todayCount  = users.filter(u => { const s = getStatus(u); return s === "online" || s === "recent" || s === "today"; }).length;

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>

      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:"12px", marginBottom:"20px" }}>
        {[
          { label:"🟢 Сейчас онлайн", val:onlineCount,          color:"#10b981" },
          { label:"📅 Были сегодня",  val:todayCount,            color:"#0ea5e9" },
          { label:"👥 Всего",         val:users.length,          color:"#7c3aed" },
          { label:"😴 Не в сети",     val:users.length-todayCount, color:"#475569" },
        ].map((s,i) => (
          <div key={i} style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"14px", padding:"16px" }}>
            <div style={{ color:t.textMuted, fontSize:"11px", marginBottom:"5px" }}>{s.label}</div>
            <div style={{ color:s.color, fontSize:"24px", fontWeight:800 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:"10px", marginBottom:"16px", flexWrap:"wrap", alignItems:"center" }}>
        {/* Search */}
        <div style={{ position:"relative", flex:1, minWidth:"200px" }}>
          <Search size={14} style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)", color:t.textMuted, pointerEvents:"none" }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Поиск по имени или роли..."
            style={{ width:"100%", background:t.bgCard, color:t.text, border:`1px solid ${t.border}`, borderRadius:"10px", padding:"9px 12px 9px 34px", fontSize:"13px", outline:"none", fontFamily:"inherit" }}/>
        </div>

        {/* Role filter */}
        <select value={filterRole} onChange={e=>setFilterRole(e.target.value)}
          style={{ background:t.bgCard, color:t.text, border:`1px solid ${t.border}`, borderRadius:"10px", padding:"9px 12px", fontSize:"13px", outline:"none", fontFamily:"inherit" }}>
          <option value="all">Все роли</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="project_manager">PM</option>
          <option value="team_lead">Team Lead</option>
          <option value="chatter">Chatter</option>
        </select>

        {/* Sort */}
        <div style={{ display:"flex", gap:"4px" }}>
          {[{v:"status",l:"По статусу"},{v:"name",l:"По имени"},{v:"last",l:"По времени"}].map(s => (
            <button key={s.v} onClick={() => setSortBy(s.v)}
              style={{ padding:"8px 12px", borderRadius:"8px", border:`1px solid ${sortBy===s.v?"#7c3aed":t.border}`, background:sortBy===s.v?"rgba(124,58,237,0.15)":t.bgCard, color:sortBy===s.v?"#a78bfa":t.textMuted, fontSize:"12px", fontWeight:sortBy===s.v?700:400, cursor:"pointer" }}>
              {s.l}
            </button>
          ))}
        </div>

        <span style={{ color:t.textFaint, fontSize:"12px", flexShrink:0 }}>{filtered.length} чел.</span>
      </div>

      {/* Table */}
      <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"16px", overflow:"hidden" }}>
        {/* Header */}
        <div style={{ display:"grid", gridTemplateColumns:"2fr 120px 180px 200px 150px", gap:"8px", padding:"11px 18px", borderBottom:`1px solid ${t.border}`, background:t.bgCardHover }}>
          {["Пользователь","Роль","Статус","Последний визит","Дата регистрации"].map((h,i) => (
            <div key={i} style={{ color:t.textFaint, fontSize:"11px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.4px" }}>{h}</div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding:"40px", textAlign:"center", color:t.textFaint }}>Нет пользователей</div>
        ) : filtered.map((u, i) => {
          const status = getStatus(u);
          const sc     = STATUS_CONFIG[status];
          const rc     = ROLE_COLORS[u.role] || "#64748b";

          return (
            <div key={u.id}
              style={{ display:"grid", gridTemplateColumns:"2fr 120px 180px 200px 150px", gap:"8px", padding:"12px 18px", borderBottom:i<filtered.length-1?`1px solid ${t.border}`:"none", alignItems:"center" }}
              onMouseEnter={e => e.currentTarget.style.background = t.bgCardHover}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

              {/* User */}
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <div style={{ position:"relative", flexShrink:0 }}>
                  <div style={{ width:"36px", height:"36px", borderRadius:"10px", background:`linear-gradient(135deg,${rc},${rc}88)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:u.avatarEmoji?"16px":"13px", fontWeight:700, color:"#fff" }}>
                    {u.avatarEmoji || (u.name||"?")[0].toUpperCase()}
                  </div>
                  {/* Online dot */}
                  <div style={{ position:"absolute", bottom:"-2px", right:"-2px", width:"11px", height:"11px", borderRadius:"50%", background:sc.dot, border:`2px solid ${t.bgCard}`, boxShadow:status==="online"?`0 0 6px ${sc.dot}`:"none" }}/>
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ color:t.text, fontSize:"13px", fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{u.name || "—"}</div>
                  <div style={{ color:t.textFaint, fontSize:"11px" }}>{u.email || "—"}</div>
                </div>
              </div>

              {/* Role */}
              <div>
                <span style={{ background:`${rc}18`, color:rc, fontSize:"11px", fontWeight:700, padding:"3px 8px", borderRadius:"20px", textTransform:"uppercase", letterSpacing:"0.3px" }}>
                  {ROLE_LABELS_DISPLAY[u.role] || u.role || "—"}
                </span>
              </div>

              {/* Status */}
              <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:sc.dot, boxShadow:status==="online"?`0 0 5px ${sc.dot}`:"none", flexShrink:0 }}/>
                <span style={{ color:sc.color, fontSize:"12px", fontWeight:600 }}>{sc.label}</span>
              </div>

              {/* Last seen */}
              <div>
                <div style={{ color:t.text, fontSize:"12px", fontWeight:500 }}>{fmtAgo(u.lastActiveAt)}</div>
                <div style={{ color:t.textFaint, fontSize:"11px", marginTop:"1px" }}>{fmtDateTime(u.lastActiveAt)}</div>
              </div>

              {/* Registered */}
              <div style={{ color:t.textMuted, fontSize:"12px" }}>
                {u.createdAt ? new Date(u.createdAt).toLocaleDateString("ru-RU", {day:"numeric",month:"short",year:"numeric"}) : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── INFO TOOLTIP ──────────────────────────────────────────────────────────────
function InfoTip({ content, t }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position:"relative", display:"inline-flex" }}>
      <div
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ width:"16px", height:"16px", borderRadius:"50%", background:"rgba(124,58,237,0.2)", border:"1px solid rgba(124,58,237,0.4)", color:"#a78bfa", fontSize:"10px", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", cursor:"help", flexShrink:0 }}>
        i
      </div>
      <AnimatePresence>
        {show && (
          <motion.div initial={{ opacity:0, y:4, scale:0.95 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, scale:0.95 }}
            style={{ position:"absolute", bottom:"calc(100% + 8px)", left:"50%", transform:"translateX(-50%)", background:t.bgSecondary||t.bgCard, border:"1px solid rgba(124,58,237,0.3)", borderRadius:"12px", padding:"10px 14px", width:"240px", zIndex:999, boxShadow:"0 8px 24px rgba(0,0,0,0.3)", pointerEvents:"none" }}>
            <div style={{ color:t.text, fontSize:"12px", lineHeight:"1.6" }}>{content}</div>
            <div style={{ position:"absolute", bottom:"-5px", left:"50%", width:"8px", height:"8px", background:t.bgSecondary||t.bgCard, border:"1px solid rgba(124,58,237,0.3)", borderBottom:"none", borderRight:"none", transform:"translateX(-50%) rotate(225deg)" }}/>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── CALCULATOR TAB ────────────────────────────────────────────────────────────
const CALC_MODES = [
  { key:"salary",     label:"💰 Зарплаты",      desc:"Расчёт выплат сотрудникам" },
  { key:"roi",        label:"📈 ROI",            desc:"Возврат инвестиций" },
  { key:"conversion", label:"🎯 Конверсия",      desc:"Воронка и конверсия трафика" },
  { key:"plan",       label:"📋 План",           desc:"Сколько нужно постов для цели" },
  { key:"unit",       label:"⚖️ Unit Economics", desc:"Экономика одного подписчика" },
  { key:"tax",        label:"🧾 Налоги",         desc:"Расчёт налогов и чистой прибыли" },
];

const INFO = {
  salary: {
    per_post: "Фиксированная сумма за каждый пост опубликованный чаттером. Простая и прозрачная схема.",
    percent:  "Процент от выручки модели. Мотивирует чаттера работать на результат. Нужно указать среднюю выручку с поста.",
    fixed:    "Фиксированная ставка за период (день/неделя/месяц) независимо от количества постов.",
    bonus:    "Разовая доплата сверх основной ставки. Используй для премий, компенсаций или переработок.",
  },
  roi: {
    invest:   "Сумма вложений: реклама, инструменты, зарплаты, прочие расходы за период.",
    revenue:  "Общая выручка от агентства за тот же период.",
    roi:      "ROI = (Выручка − Инвестиции) / Инвестиции × 100%. Показывает эффективность вложений. ROI > 0 = прибыльно.",
  },
  conversion: {
    views:    "Просмотры постов на Reddit или другой платформе.",
    clicks:   "Переходы по ссылке/в профиль. CTR = Клики / Просмотры × 100%.",
    subs:     "Новые подписчики OF после перехода. Conversion Rate = Подписки / Клики × 100%.",
    revenue:  "Выручка с новых подписчиков. RPM = Выручка / Просмотры × 1000 — стоимость 1000 просмотров.",
  },
  plan: {
    target:   "Сколько хочешь заработать за период (месяц).",
    avgCheck: "Средняя стоимость подписки или средний чек с одного подписчика.",
    convRate: "Какой % переходов конвертируется в подписку. Обычно 3–15% для OF-трафика.",
    posts:    "Среднее количество кликов с одного поста. Зависит от суба и качества контента (обычно 30–150).",
  },
  unit: {
    cac:      "CAC (Customer Acquisition Cost) — стоимость привлечения одного подписчика. Расходы на трафик / Кол-во новых подписчиков.",
    ltv:      "LTV (Lifetime Value) — сколько приносит один подписчик за всё время. Средний чек × Среднее кол-во месяцев подписки.",
    margin:   "Маржа = (LTV − CAC) / LTV × 100%. Показывает прибыльность каждого привлечённого подписчика.",
  },
  tax: {
    revenue:  "Общая выручка до вычета налогов и расходов.",
    expenses: "Все расходы: зарплаты, реклама, инструменты, прочее.",
    taxRate:  "Ставка налога в % (например, 6% для УСН доходы в РФ, или 20% НДС, или personal tax в других странах).",
  },
};

function InfoBlock({ title, items, t }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background:"rgba(124,58,237,0.06)", border:"1px solid rgba(124,58,237,0.15)", borderRadius:"12px", marginBottom:"16px", overflow:"hidden" }}>
      <button onClick={() => setOpen(v=>!v)}
        style={{ width:"100%", display:"flex", alignItems:"center", gap:"8px", padding:"12px 16px", background:"none", border:"none", cursor:"pointer", textAlign:"left" }}>
        <span style={{ fontSize:"14px" }}>📖</span>
        <span style={{ color:"#a78bfa", fontSize:"13px", fontWeight:600, flex:1 }}>{title}</span>
        <span style={{ color:"#a78bfa", fontSize:"12px" }}>{open ? "▲" : "▼"}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height:0 }} animate={{ height:"auto" }} exit={{ height:0 }} style={{ overflow:"hidden" }}>
            <div style={{ padding:"0 16px 16px", display:"flex", flexDirection:"column", gap:"8px" }}>
              {items.map((item, i) => (
                <div key={i} style={{ display:"grid", gridTemplateColumns:"110px 1fr", gap:"10px", padding:"8px 10px", background:t.bgCardHover, borderRadius:"8px" }}>
                  <span style={{ color:"#a78bfa", fontSize:"12px", fontWeight:700 }}>{item.term}</span>
                  <span style={{ color:t.textMuted, fontSize:"12px", lineHeight:"1.5" }}>{item.def}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CalcResult({ label, value, color = "#10b981", size = "lg", info, t }) {
  return (
    <div style={{ background:t.bgCardHover, border:`1px solid ${t.border}`, borderRadius:"12px", padding:"14px 16px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"6px" }}>
        <span style={{ color:t.textMuted, fontSize:"12px" }}>{label}</span>
        {info && <InfoTip content={info} t={t} />}
      </div>
      <div style={{ color, fontSize: size === "lg" ? "26px" : "20px", fontWeight:800 }}>{value}</div>
    </div>
  );
}

function CalculatorTab({ users, entries, t }) {
  const [mode, setMode]           = useState("salary");
  const [showGuide, setShowGuide] = useState(false);

  // ── SALARY ────────────────────────────────────────────────────────────────
  const [period,      setPeriod]     = useState("month");
  const [globalType,  setGlobalType] = useState("per_post");
  const [globalValue, setGlobalVal]  = useState("");
  const [globalRev,   setGlobalRev]  = useState("");
  const [userRates,   setUserRates]  = useState({});

  const days = { day:1, week:7, month:30 }[period] || 30;
  const getRate = (uid) => userRates[uid] || { type:globalType, value:"", avgRevenue:"", bonus:"", note:"" };
  const setRate = (uid, field, val) => setUserRates(p => ({ ...p, [uid]:{ ...getRate(uid), [field]:val } }));

  const applyGlobal = () => {
    const next = {};
    users.forEach(u => { next[u.uid||u.id] = { ...getRate(u.uid||u.id), type:globalType, value:globalValue, avgRevenue:globalRev }; });
    setUserRates(next);
  };

  const calcUser = (u) => {
    const r = getRate(u.uid||u.id);
    const posts = entries.filter(e => e.userId === (u.uid||u.id) && (new Date()-new Date(e.createdAt))/86400000 <= days).length;
    let base = 0;
    if (r.type==="per_post") base = posts*(parseFloat(r.value)||0);
    else if (r.type==="percent") base = posts*(parseFloat(r.avgRevenue)||0)*((parseFloat(r.value)||0)/100);
    else if (r.type==="fixed") base = parseFloat(r.value)||0;
    return { posts, base, bonus:parseFloat(r.bonus)||0, total:base+(parseFloat(r.bonus)||0) };
  };
  const salaryResults  = users.map(u => ({ ...u, ...calcUser(u) })).sort((a,b)=>b.posts-a.posts);
  const grandTotal     = salaryResults.reduce((s,u)=>s+u.total,0);
  const totalBonus     = salaryResults.reduce((s,u)=>s+u.bonus,0);

  // ── ROI ────────────────────────────────────────────────────────────────────
  const [roiInvest,  setRoiInvest]  = useState("");
  const [roiRev,     setRoiRev]     = useState("");
  const roiVal    = roiInvest && roiRev ? ((parseFloat(roiRev)-parseFloat(roiInvest))/parseFloat(roiInvest)*100).toFixed(1) : null;
  const roiProfit = roiInvest && roiRev ? (parseFloat(roiRev)-parseFloat(roiInvest)).toFixed(0) : null;

  // ── CONVERSION ─────────────────────────────────────────────────────────────
  const [cvViews,  setCvViews]  = useState("");
  const [cvClicks, setCvClicks] = useState("");
  const [cvSubs,   setCvSubs]   = useState("");
  const [cvPrice,  setCvPrice]  = useState("");
  const ctr     = cvClicks&&cvViews   ? ((+cvClicks/+cvViews)*100).toFixed(2) : null;
  const cr      = cvSubs&&cvClicks    ? ((+cvSubs/+cvClicks)*100).toFixed(2)  : null;
  const cvRev   = cvSubs&&cvPrice     ? (+cvSubs * +cvPrice).toFixed(0)        : null;
  const rpm     = cvRev&&cvViews      ? (+cvRev/+cvViews*1000).toFixed(2)      : null;
  const cps     = cvClicks&&cvSubs    ? (+cvClicks/+cvSubs).toFixed(1)         : null;

  // ── PLAN ───────────────────────────────────────────────────────────────────
  const [plTarget, setPlTarget]  = useState("");
  const [plCheck,  setPlCheck]   = useState("");
  const [plConv,   setPlConv]    = useState("");
  const [plClkPst, setPlClkPst]  = useState("50");
  const neededSubs   = plTarget&&plCheck  ? Math.ceil(+plTarget/+plCheck)                     : null;
  const neededClicks = neededSubs&&plConv ? Math.ceil(neededSubs/(+plConv/100))                : null;
  const neededPosts  = neededClicks&&plClkPst ? Math.ceil(neededClicks/+plClkPst)              : null;
  const postsPerDay  = neededPosts         ? Math.ceil(neededPosts/30)                          : null;

  // ── UNIT ECONOMICS ─────────────────────────────────────────────────────────
  const [unitSpend,  setUnitSpend]  = useState("");
  const [unitNewSub, setUnitNewSub] = useState("");
  const [unitAvgChk, setUnitAvgChk] = useState("");
  const [unitMonths, setUnitMonths] = useState("");
  const cac     = unitSpend&&unitNewSub ? (+unitSpend/+unitNewSub).toFixed(2)            : null;
  const ltv     = unitAvgChk&&unitMonths ? (+unitAvgChk*+unitMonths).toFixed(2)          : null;
  const ltvCac  = ltv&&cac  ? (+ltv/+cac).toFixed(2)                                    : null;
  const margin  = ltv&&cac  ? (((+ltv-+cac)/+ltv)*100).toFixed(1)                       : null;
  const payback = cac&&unitAvgChk ? Math.ceil(+cac/+unitAvgChk)                         : null;

  // ── TAX ────────────────────────────────────────────────────────────────────
  const [taxRev,      setTaxRev]      = useState("");
  const [taxExpenses, setTaxExpenses] = useState("");
  const [taxRate,     setTaxRate]     = useState("6");
  const [taxSalaries, setTaxSalaries] = useState("");
  const grossProfit = taxRev&&taxExpenses ? (+taxRev-+taxExpenses).toFixed(0)              : null;
  const taxAmount   = grossProfit&&taxRate ? (+grossProfit*(+taxRate/100)).toFixed(0)      : null;
  const netProfit   = grossProfit&&taxAmount&&taxSalaries
    ? (+grossProfit-+taxAmount-+taxSalaries).toFixed(0)
    : grossProfit&&taxAmount
    ? (+grossProfit-+taxAmount).toFixed(0) : null;
  const effectiveMargin = taxRev&&netProfit ? ((+netProfit/+taxRev)*100).toFixed(1) : null;

  const inputS = { background:t.bgInput, color:t.text, border:`1px solid ${t.border}`, borderRadius:"10px", padding:"10px 14px", fontSize:"13px", outline:"none", fontFamily:"inherit", width:"100%" };
  const smInp  = { ...inputS, padding:"7px 10px", fontSize:"12px" };
  const labelS = { color:t.textMuted, fontSize:"11px", fontWeight:600, display:"block", marginBottom:"5px", textTransform:"uppercase", letterSpacing:"0.4px" };

  const fmt = (n, prefix="$") => n !== null ? `${prefix}${parseFloat(n).toLocaleString("ru-RU")}` : "—";

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
      {/* Mode tabs */}
      <div style={{ display:"flex", gap:"6px", marginBottom:"20px", flexWrap:"wrap" }}>
        {CALC_MODES.map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            style={{ display:"flex", flexDirection:"column", padding:"10px 16px", borderRadius:"12px", border:`1px solid ${mode===m.key?"#7c3aed":t.border}`, background:mode===m.key?"rgba(124,58,237,0.15)":t.bgCard, color:mode===m.key?"#a78bfa":t.textMuted, fontSize:"13px", fontWeight:mode===m.key?700:400, cursor:"pointer", textAlign:"left" }}>
            <span>{m.label}</span>
            {!false && <span style={{ fontSize:"10px", opacity:0.6, marginTop:"2px" }}>{m.desc}</span>}
          </button>
        ))}
      </div>

      {/* ── SALARY ── */}
      {mode === "salary" && (
        <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
          <InfoBlock title="Как работает расчёт зарплат?" t={t} items={[
            { term:"$/пост",    def:"Сотрудник получает фиксированную сумму за каждый опубликованный пост. Просто и прозрачно." },
            { term:"% от выр.", def:"Процент от средней выручки с поста. Стимулирует работать на результат." },
            { term:"Фикс.",     def:"Фиксированная сумма за период (день/неделя/месяц) независимо от количества постов." },
            { term:"Бонус",     def:"Разовая доплата сверх основной ставки. Премия, компенсация или поощрение." },
            { term:"Период",    def:"За какой период считать посты: день, неделя или месяц от текущей даты." },
          ]}/>

          {/* Global controls */}
          <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"14px", padding:"16px 18px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px" }}>
              <span style={{ color:t.text, fontSize:"13px", fontWeight:600 }}>Применить ко всем сотрудникам</span>
              <InfoTip content="Задаёт одинаковую схему оплаты всем. После применения можно изменить индивидуально в таблице ниже." t={t}/>
            </div>
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"flex-end" }}>
              <div>
                <label style={labelS}>Период</label>
                <div style={{ display:"flex", gap:"4px" }}>
                  {[{v:"day",l:"День"},{v:"week",l:"Нед."},{v:"month",l:"Мес."}].map(o => (
                    <button key={o.v} onClick={() => setPeriod(o.v)}
                      style={{ padding:"7px 12px", borderRadius:"8px", border:`1px solid ${period===o.v?"#7c3aed":t.border}`, background:period===o.v?"rgba(124,58,237,0.15)":t.bgCardHover, color:period===o.v?"#a78bfa":t.textMuted, fontSize:"12px", fontWeight:600, cursor:"pointer" }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelS}>Тип оплаты</label>
                <select value={globalType} onChange={e=>setGlobalType(e.target.value)} style={{ ...smInp, width:"120px" }}>
                  <option value="per_post">$/пост</option>
                  <option value="percent">% от выр.</option>
                  <option value="fixed">Фикс.</option>
                </select>
              </div>
              <div>
                <label style={labelS}>{globalType==="per_post"?"$/пост":globalType==="percent"?"%":"Сумма $"}</label>
                <input type="number" value={globalValue} onChange={e=>setGlobalVal(e.target.value)} placeholder="0" style={{ ...smInp, width:"80px" }}/>
              </div>
              {globalType==="percent" && (
                <div>
                  <label style={labelS}>Выручка/пост $</label>
                  <input type="number" value={globalRev} onChange={e=>setGlobalRev(e.target.value)} placeholder="0" style={{ ...smInp, width:"110px" }}/>
                </div>
              )}
              <button onClick={applyGlobal}
                style={{ padding:"7px 16px", borderRadius:"8px", background:"rgba(124,58,237,0.15)", border:"1px solid rgba(124,58,237,0.3)", color:"#a78bfa", fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
                → Применить
              </button>
            </div>
          </div>

          {/* Per-user table */}
          <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"14px", overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 55px 100px 75px 80px 75px 1fr 80px", gap:"6px", padding:"10px 16px", borderBottom:`1px solid ${t.border}`, background:t.bgCardHover }}>
              {["Сотрудник","Постов","Тип","Ставка","Выр./пост","Бонус","Заметка","Итого"].map((h,i) => (
                <div key={i} style={{ color:t.textFaint, fontSize:"10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.4px", textAlign:i===7?"right":"left" }}>{h}</div>
              ))}
            </div>
            {salaryResults.length === 0 ? (
              <div style={{ padding:"32px", textAlign:"center", color:t.textFaint }}>Нет сотрудников</div>
            ) : salaryResults.map((u,i) => {
              const r  = getRate(u.uid||u.id);
              const rc = ROLE_COLORS[u.role]||"#64748b";
              return (
                <div key={u.id} style={{ display:"grid", gridTemplateColumns:"2fr 55px 100px 75px 80px 75px 1fr 80px", gap:"6px", padding:"10px 16px", borderBottom:i<salaryResults.length-1?`1px solid ${t.border}`:"none", alignItems:"center" }}
                  onMouseEnter={e=>e.currentTarget.style.background=t.bgCardHover}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
                    <div style={{ width:"26px", height:"26px", borderRadius:"7px", background:`linear-gradient(135deg,${rc},${rc}88)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:u.avatarEmoji?"12px":"10px", fontWeight:700, color:"#fff", flexShrink:0 }}>
                      {u.avatarEmoji||(u.name||"?")[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ color:t.text, fontSize:"12px", fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{u.name}</div>
                      <div style={{ color:t.textFaint, fontSize:"10px" }}>{ROLE_LABELS[u.role]||u.role}</div>
                    </div>
                  </div>
                  <div style={{ color:t.text, fontSize:"13px", fontWeight:700 }}>{u.posts}</div>
                  <select value={r.type} onChange={e=>setRate(u.uid||u.id,"type",e.target.value)} style={smInp}>
                    <option value="per_post">$/пост</option>
                    <option value="percent">%</option>
                    <option value="fixed">Фикс.</option>
                  </select>
                  <input type="number" value={r.value} onChange={e=>setRate(u.uid||u.id,"value",e.target.value)} placeholder="0" style={smInp}/>
                  {r.type==="percent"
                    ? <input type="number" value={r.avgRevenue} onChange={e=>setRate(u.uid||u.id,"avgRevenue",e.target.value)} placeholder="$" style={smInp}/>
                    : <div style={{ color:t.textFaint, fontSize:"12px" }}>—</div>}
                  <input type="number" value={r.bonus} onChange={e=>setRate(u.uid||u.id,"bonus",e.target.value)} placeholder="0"
                    style={{ ...smInp, borderColor:r.bonus?"rgba(16,185,129,0.4)":t.border }}/>
                  <input value={r.note} onChange={e=>setRate(u.uid||u.id,"note",e.target.value)} placeholder="заметка..." style={smInp}/>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:u.total>0?"#10b981":t.textFaint, fontSize:"14px", fontWeight:700 }}>
                      {u.total>0?`$${u.total.toFixed(0)}`:"—"}
                    </div>
                    {u.bonus>0&&<div style={{ color:"#f59e0b", fontSize:"10px" }}>+${u.bonus.toFixed(0)}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px" }}>
            <CalcResult label="Итого к выплате" value={fmt(grandTotal)} color="#10b981" t={t}
              info="Сумма всех индивидуальных выплат включая бонусы."/>
            <CalcResult label="Из них бонусы" value={fmt(totalBonus)} color="#f59e0b" size="md" t={t}
              info="Сумма всех бонусов и доплат."/>
            <CalcResult label="Сотрудников" value={`${salaryResults.filter(u=>u.total>0).length} из ${salaryResults.length}`} color="#a78bfa" size="md" t={t}
              info="Количество сотрудников с ненулевой выплатой."/>
          </div>
        </div>
      )}

      {/* ── ROI ── */}
      {mode === "roi" && (
        <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:"20px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            <InfoBlock title="Что такое ROI?" t={t} items={[
              { term:"ROI",        def:"Return on Investment — возврат инвестиций. Показывает насколько эффективны вложения." },
              { term:"ROI > 100%", def:"Каждый вложенный доллар принёс больше доллара прибыли. Бизнес прибыльный." },
              { term:"ROI = 0%",   def:"Вышли в ноль — выручка равна расходам." },
              { term:"ROI < 0%",   def:"Убыток — расходы больше выручки." },
            ]}/>
            {[
              { label:"💸 Инвестиции ($)", val:roiInvest, set:setRoiInvest, ph:"10000", info:INFO.roi.invest },
              { label:"💰 Выручка ($)",    val:roiRev,    set:setRoiRev,    ph:"25000", info:INFO.roi.revenue },
            ].map(f => (
              <div key={f.label}>
                <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"5px" }}>
                  <label style={{ ...labelS, marginBottom:0 }}>{f.label}</label>
                  <InfoTip content={f.info} t={t}/>
                </div>
                <input type="number" value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} style={inputS}/>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            {roiVal !== null ? (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                  <CalcResult label="ROI" value={`${roiVal}%`}
                    color={+roiVal>100?"#10b981":+roiVal>0?"#f59e0b":"#ef4444"} t={t}
                    info={INFO.roi.roi}/>
                  <CalcResult label="Чистая прибыль" value={fmt(roiProfit)}
                    color={+roiProfit>0?"#10b981":"#ef4444"} size="md" t={t}
                    info="Выручка минус инвестиции."/>
                </div>

                {/* Visual gauge */}
                <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"14px", padding:"20px" }}>
                  <div style={{ color:t.textMuted, fontSize:"12px", marginBottom:"10px" }}>Оценка эффективности</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    {[
                      { label:"Убыток",         range:[-Infinity,0],    color:"#ef4444" },
                      { label:"Слабая",          range:[0,50],           color:"#f97316" },
                      { label:"Нормальная",      range:[50,150],         color:"#f59e0b" },
                      { label:"Хорошая",         range:[150,300],        color:"#10b981" },
                      { label:"Отличная",        range:[300,Infinity],   color:"#7c3aed" },
                    ].map((band, i) => {
                      const active = +roiVal >= band.range[0] && +roiVal < band.range[1];
                      return (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"8px 12px", borderRadius:"8px", background:active?`${band.color}18`:"transparent", border:`1px solid ${active?band.color+"40":"transparent"}` }}>
                          <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:band.color, flexShrink:0 }}/>
                          <span style={{ color:active?band.color:t.textMuted, fontSize:"13px", fontWeight:active?700:400 }}>{band.label}</span>
                          {active && <span style={{ color:band.color, fontSize:"12px", marginLeft:"auto" }}>← вы здесь</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"14px", padding:"40px", textAlign:"center", color:t.textFaint }}>Заполни поля слева</div>
            )}
          </div>
        </div>
      )}

      {/* ── CONVERSION ── */}
      {mode === "conversion" && (
        <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:"20px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            <InfoBlock title="Воронка конверсии" t={t} items={[
              { term:"CTR",   def:"Click-Through Rate — % переходов от просмотров. Норма для OF-трафика: 2–8%." },
              { term:"CR",    def:"Conversion Rate — % подписок от кликов. Норма: 3–15%." },
              { term:"RPM",   def:"Revenue Per Mille — выручка с 1000 просмотров. Ключевая метрика эффективности поста." },
              { term:"CPS",   def:"Cost Per Subscriber — сколько кликов нужно для одной подписки." },
            ]}/>
            {[
              { label:"👁 Просмотры",        val:cvViews,  set:setCvViews,  ph:"10000", info:INFO.conversion.views },
              { label:"🖱 Клики",            val:cvClicks, set:setCvClicks, ph:"300",   info:INFO.conversion.clicks },
              { label:"🔔 Новых подписок",   val:cvSubs,   set:setCvSubs,   ph:"30",    info:INFO.conversion.subs },
              { label:"💵 Цена подписки ($)",val:cvPrice,  set:setCvPrice,  ph:"9.99",  info:"Средняя стоимость подписки на OF или другой платформе." },
            ].map(f => (
              <div key={f.label}>
                <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"5px" }}>
                  <label style={{ ...labelS, marginBottom:0 }}>{f.label}</label>
                  <InfoTip content={f.info} t={t}/>
                </div>
                <input type="number" value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} style={inputS}/>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
              <CalcResult label="CTR" value={ctr?`${ctr}%`:"—"} color={ctr&&+ctr>3?"#10b981":ctr?"#f59e0b":"#64748b"} t={t} info="% переходов от просмотров. > 3% — хороший результат."/>
              <CalcResult label="CR (в подписку)" value={cr?`${cr}%`:"—"} color={cr&&+cr>5?"#10b981":cr?"#f59e0b":"#64748b"} t={t} info="% подписок от кликов. > 5% — хороший результат."/>
              <CalcResult label="Выручка" value={cvRev?fmt(cvRev):"—"} color="#a78bfa" t={t} info="Общая выручка с новых подписчиков."/>
              <CalcResult label="RPM" value={rpm?`$${rpm}`:"—"} color={rpm&&+rpm>1?"#10b981":rpm?"#f59e0b":"#64748b"} t={t} info={INFO.conversion.revenue}/>
            </div>
            {/* Funnel visual */}
            {cvViews && (
              <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"14px", padding:"18px" }}>
                <div style={{ color:t.textMuted, fontSize:"12px", marginBottom:"12px" }}>Воронка</div>
                {[
                  { label:"Просмотры",  val:+cvViews||0,  color:"#0ea5e9" },
                  { label:"Клики",      val:+cvClicks||0, color:"#7c3aed" },
                  { label:"Подписки",   val:+cvSubs||0,   color:"#10b981" },
                ].map((step, i) => {
                  const pct = Math.round((step.val/(+cvViews||1))*100);
                  return (
                    <div key={i} style={{ marginBottom:"8px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px" }}>
                        <span style={{ color:t.textMuted, fontSize:"12px" }}>{step.label}</span>
                        <span style={{ color:t.text, fontSize:"12px", fontWeight:600 }}>{step.val.toLocaleString()} ({pct}%)</span>
                      </div>
                      <div style={{ height:"8px", background:t.border, borderRadius:"4px", overflow:"hidden" }}>
                        <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ duration:0.6, delay:i*0.1 }}
                          style={{ height:"100%", background:step.color, borderRadius:"4px" }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PLAN ── */}
      {mode === "plan" && (
        <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:"20px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            <InfoBlock title="Как считается план?" t={t} items={[
              { term:"Логика",       def:"Цель → нужно подписок → нужно кликов → нужно постов → постов в день." },
              { term:"Avg Check",    def:"Средняя выручка с одного нового подписчика." },
              { term:"Conv. Rate",   def:"Какой % кликов превращается в подписку. Обычно 5–15% для OF." },
              { term:"Клики/пост",   def:"Среднее количество кликов с одного поста. Зависит от суба: 30–200." },
            ]}/>
            {[
              { label:"🎯 Цель ($)",          val:plTarget,  set:setPlTarget,  ph:"5000",  info:INFO.plan.target },
              { label:"💵 Средний чек ($)",    val:plCheck,   set:setPlCheck,   ph:"15",    info:INFO.plan.avgCheck },
              { label:"📊 Конверсия (%)",      val:plConv,    set:setPlConv,    ph:"8",     info:INFO.plan.convRate },
              { label:"🖱 Кликов с поста",     val:plClkPst,  set:setPlClkPst,  ph:"50",    info:INFO.plan.posts },
            ].map(f => (
              <div key={f.label}>
                <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"5px" }}>
                  <label style={{ ...labelS, marginBottom:0 }}>{f.label}</label>
                  <InfoTip content={f.info} t={t}/>
                </div>
                <input type="number" value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} style={inputS}/>
              </div>
            ))}
          </div>

          {neededSubs ? (
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              {[
                { icon:"💰", label:"Нужно выручки",      val:`$${(+plTarget).toLocaleString()}`,   color:"#10b981" },
                { icon:"🔔", label:"Нужно подписчиков",   val:neededSubs.toLocaleString(),          color:"#7c3aed" },
                { icon:"🖱", label:"Нужно кликов",        val:neededClicks?.toLocaleString()||"—",  color:"#0ea5e9" },
                { icon:"📝", label:"Нужно постов (всего)",val:neededPosts?.toLocaleString()||"—",   color:"#f59e0b" },
                { icon:"📅", label:"Постов в день (30д)", val:postsPerDay?.toLocaleString()||"—",   color:"#db2877" },
              ].map((item, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"14px 18px", background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"12px" }}>
                  <span style={{ fontSize:"22px" }}>{item.icon}</span>
                  <div style={{ flex:1, color:t.textMuted, fontSize:"13px" }}>{item.label}</div>
                  <div style={{ color:item.color, fontSize:"20px", fontWeight:800 }}>{item.val}</div>
                </div>
              ))}
              {neededPosts && (
                <div style={{ padding:"12px 16px", background:"rgba(124,58,237,0.07)", border:"1px solid rgba(124,58,237,0.15)", borderRadius:"12px" }}>
                  <div style={{ color:"#a78bfa", fontSize:"12px", lineHeight:"1.6" }}>
                    💡 При {plClkPst} кликах с поста и {plConv}% конверсии нужно публиковать <strong>{postsPerDay} постов/день</strong> чтобы заработать ${(+plTarget).toLocaleString()} за месяц.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"14px", padding:"40px", textAlign:"center", color:t.textFaint }}>Заполни поля слева</div>
          )}
        </div>
      )}

      {/* ── UNIT ECONOMICS ── */}
      {mode === "unit" && (
        <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:"20px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            <InfoBlock title="Unit Economics — что это?" t={t} items={[
              { term:"CAC",       def:"Customer Acquisition Cost — стоимость привлечения одного подписчика. Расходы / Новых подписчиков." },
              { term:"LTV",       def:"Lifetime Value — сколько денег приносит один подписчик за всё время. Чек × Месяцы." },
              { term:"LTV/CAC",   def:"Соотношение ценности к стоимости. > 3 — здоровый бизнес. < 1 — убыток на каждом клиенте." },
              { term:"Payback",   def:"Срок окупаемости — через сколько месяцев подписки окупается стоимость привлечения." },
              { term:"Маржа",     def:"(LTV − CAC) / LTV × 100%. Какой % от выручки остаётся прибылью." },
            ]}/>
            {[
              { label:"💸 Расходы на трафик ($)",   val:unitSpend,  set:setUnitSpend,  ph:"1000", info:INFO.unit.cac },
              { label:"🔔 Новых подписчиков",        val:unitNewSub, set:setUnitNewSub, ph:"50",   info:"Сколько новых подписчиков привлекли за этот бюджет." },
              { label:"💵 Средний чек ($/мес)",      val:unitAvgChk, set:setUnitAvgChk, ph:"15",   info:INFO.unit.ltv },
              { label:"📅 Среднее мес. подписки",    val:unitMonths, set:setUnitMonths, ph:"3",    info:"Сколько месяцев в среднем остаётся подписчик." },
            ].map(f => (
              <div key={f.label}>
                <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"5px" }}>
                  <label style={{ ...labelS, marginBottom:0 }}>{f.label}</label>
                  <InfoTip content={f.info} t={t}/>
                </div>
                <input type="number" value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} style={inputS}/>
              </div>
            ))}
          </div>

          {cac !== null ? (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                <CalcResult label="CAC" value={`$${cac}`} color="#f59e0b" t={t} info={INFO.unit.cac}/>
                <CalcResult label="LTV" value={ltv?`$${ltv}`:"—"} color="#0ea5e9" t={t} info={INFO.unit.ltv}/>
                <CalcResult label="LTV / CAC" value={ltvCac||"—"}
                  color={ltvCac&&+ltvCac>=3?"#10b981":ltvCac&&+ltvCac>=1?"#f59e0b":"#ef4444"} t={t}
                  info="Ключевое соотношение. > 3 — отличный результат, > 1 — прибыльно."/>
                <CalcResult label="Маржа" value={margin?`${margin}%`:"—"}
                  color={margin&&+margin>=50?"#10b981":margin&&+margin>=20?"#f59e0b":"#ef4444"} size="md" t={t}
                  info={INFO.unit.margin}/>
              </div>
              {payback && (
                <div style={{ padding:"14px 18px", background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ color:t.textMuted, fontSize:"12px", marginBottom:"3px" }}>Срок окупаемости</div>
                    <div style={{ color:"#a78bfa", fontSize:"20px", fontWeight:800 }}>{payback} мес.</div>
                  </div>
                  <div style={{ color:t.textFaint, fontSize:"12px", maxWidth:"200px", lineHeight:"1.5", textAlign:"right" }}>
                    {payback <= 1 ? "🔥 Отлично — окупается в первый месяц" :
                     payback <= 3 ? "✅ Хорошо — окупается за квартал" :
                     payback <= 6 ? "⚠️ Долго — проверь LTV и CAC" :
                     "❌ Слишком долго — нужна оптимизация"}
                  </div>
                </div>
              )}
              {ltvCac && (
                <div style={{ padding:"12px 16px", background:`${+ltvCac>=3?"rgba(16,185,129,0.08)":+ltvCac>=1?"rgba(245,158,11,0.08)":"rgba(239,68,68,0.08)"}`, border:`1px solid ${+ltvCac>=3?"rgba(16,185,129,0.2)":+ltvCac>=1?"rgba(245,158,11,0.2)":"rgba(239,68,68,0.2)"}`, borderRadius:"12px" }}>
                  <div style={{ color:+ltvCac>=3?"#10b981":+ltvCac>=1?"#f59e0b":"#ef4444", fontSize:"13px", lineHeight:"1.6" }}>
                    {+ltvCac >= 3 ? `✅ LTV/CAC = ${ltvCac} — бизнес здоровый. Каждый доллар на привлечение приносит $${ltvCac} выручки.` :
                     +ltvCac >= 1 ? `⚠️ LTV/CAC = ${ltvCac} — есть прибыль, но маловато. Снижай CAC или увеличивай удержание.` :
                     `❌ LTV/CAC = ${ltvCac} — убыток на каждом подписчике. Нужна срочная оптимизация.`}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"14px", padding:"40px", textAlign:"center", color:t.textFaint }}>Заполни поля слева</div>
          )}
        </div>
      )}

      {/* ── TAX ── */}
      {mode === "tax" && (
        <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:"20px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            <InfoBlock title="Расчёт налогов" t={t} items={[
              { term:"УСН 6%",     def:"Упрощённая система — 6% от доходов. Популярна для небольших агентств в РФ." },
              { term:"УСН 15%",    def:"Упрощённая — 15% от прибыли (доходы минус расходы)." },
              { term:"НДС 20%",    def:"Налог на добавленную стоимость. Актуален при работе с юрлицами." },
              { term:"НДФЛ 13%",   def:"Налог на доходы физлиц для ИП или самозанятых." },
              { term:"Чистая приб.",def:"Выручка − Расходы − Налог − Зарплаты = что остаётся владельцу." },
            ]}/>
            {[
              { label:"💰 Выручка ($)",        val:taxRev,      set:setTaxRev,      ph:"50000", info:INFO.tax.revenue },
              { label:"💸 Расходы ($)",         val:taxExpenses, set:setTaxExpenses, ph:"20000", info:INFO.tax.expenses },
              { label:"👥 Зарплаты ($)",        val:taxSalaries, set:setTaxSalaries, ph:"10000", info:"Суммарные выплаты сотрудникам за период." },
              { label:"📊 Налоговая ставка (%)",val:taxRate,     set:setTaxRate,     ph:"6",     info:INFO.tax.taxRate },
            ].map(f => (
              <div key={f.label}>
                <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"5px" }}>
                  <label style={{ ...labelS, marginBottom:0 }}>{f.label}</label>
                  <InfoTip content={f.info} t={t}/>
                </div>
                <input type="number" value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} style={inputS}/>
              </div>
            ))}

            {/* Tax rate presets */}
            <div>
              <label style={{ ...labelS }}>Быстрые ставки</label>
              <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
                {[{l:"УСН 6%",v:"6"},{l:"УСН 15%",v:"15"},{l:"НДФЛ 13%",v:"13"},{l:"НДС 20%",v:"20"},{l:"30%",v:"30"}].map(p => (
                  <button key={p.v} onClick={()=>setTaxRate(p.v)}
                    style={{ padding:"5px 10px", borderRadius:"7px", border:`1px solid ${taxRate===p.v?"#7c3aed":t.border}`, background:taxRate===p.v?"rgba(124,58,237,0.15)":t.bgCardHover, color:taxRate===p.v?"#a78bfa":t.textMuted, fontSize:"11px", fontWeight:600, cursor:"pointer" }}>
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {taxRev ? (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                <CalcResult label="Валовая прибыль" value={grossProfit?fmt(grossProfit):"—"}
                  color={grossProfit&&+grossProfit>0?"#10b981":"#ef4444"} t={t}
                  info="Выручка минус операционные расходы (без налогов и зарплат)."/>
                <CalcResult label={`Налог ${taxRate}%`} value={taxAmount?fmt(taxAmount):"—"} color="#f97316" size="md" t={t}
                  info={`Налог ${taxRate}% от валовой прибыли.`}/>
                <CalcResult label="Чистая прибыль" value={netProfit?fmt(netProfit):"—"}
                  color={netProfit&&+netProfit>0?"#10b981":"#ef4444"} t={t}
                  info="Что остаётся после всех расходов, зарплат и налогов."/>
                <CalcResult label="Маржа" value={effectiveMargin?`${effectiveMargin}%`:"—"}
                  color={effectiveMargin&&+effectiveMargin>=20?"#10b981":effectiveMargin&&+effectiveMargin>=10?"#f59e0b":"#ef4444"} size="md" t={t}
                  info="Чистая прибыль / Выручка × 100%"/>
              </div>

              {/* Breakdown bar */}
              {grossProfit && taxAmount && (
                <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"14px", padding:"18px" }}>
                  <div style={{ color:t.textMuted, fontSize:"12px", marginBottom:"12px" }}>Структура выручки ${(+taxRev).toLocaleString()}</div>
                  {[
                    { label:"Расходы",  val:+taxExpenses||0, color:"#ef4444" },
                    { label:"Зарплаты", val:+taxSalaries||0, color:"#f59e0b" },
                    { label:"Налог",    val:+taxAmount,       color:"#f97316" },
                    { label:"Прибыль",  val:+netProfit||0,    color:"#10b981" },
                  ].filter(s=>s.val>0).map((seg, i) => {
                    const pct = Math.round((seg.val/+taxRev)*100);
                    return (
                      <div key={i} style={{ marginBottom:"8px" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px" }}>
                          <span style={{ color:t.textMuted, fontSize:"12px" }}>{seg.label}</span>
                          <span style={{ color:seg.color, fontSize:"12px", fontWeight:600 }}>${seg.val.toLocaleString()} ({pct}%)</span>
                        </div>
                        <div style={{ height:"6px", background:t.border, borderRadius:"3px", overflow:"hidden" }}>
                          <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ duration:0.5, delay:i*0.1 }}
                            style={{ height:"100%", background:seg.color, borderRadius:"3px" }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"14px", padding:"40px", textAlign:"center", color:t.textFaint }}>Заполни поля слева</div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── FINANCE TAB ───────────────────────────────────────────────────────────────
function FinanceTab({ db, t }) {
  const [entries,    setEntries]    = useState([]);
  const [showForm,   setShowForm]   = useState(false);
  const [editEntry,  setEditEntry]  = useState(null);
  const [filterPeriod, setFilterPeriod] = useState(30);
  const [saving,     setSaving]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const emptyForm = { date: new Date().toISOString().split("T")[0], type: "income", amount: "", description: "", tag: "", note: "" };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    return onSnapshot(query(collection(db, "finance_entries"), orderBy("date", "desc")),
      snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [db]);

  const save = async () => {
    if (!form.amount || !form.description) return;
    setSaving(true);
    try {
      const data = { ...form, amount: parseFloat(form.amount) || 0, updatedAt: new Date().toISOString() };
      if (editEntry) {
        await import("firebase/firestore").then(m => m.updateDoc(m.doc(db, "finance_entries", editEntry.id), data));
      } else {
        await addDoc(collection(db, "finance_entries"), { ...data, createdAt: new Date().toISOString() });
      }
      setForm(emptyForm); setShowForm(false); setEditEntry(null);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const del = async (id) => {
    await import("firebase/firestore").then(m => m.deleteDoc(m.doc(db, "finance_entries", id)));
    setConfirmDel(null);
  };

  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - filterPeriod);
  const filtered = entries.filter(e => !e.date || new Date(e.date) >= cutoff);
  const income  = filtered.filter(e => e.type === "income").reduce((s,e) => s+(e.amount||0), 0);
  const expense = filtered.filter(e => e.type === "expense").reduce((s,e) => s+(e.amount||0), 0);
  const profit  = income - expense;

  const byTag = Object.entries(filtered.reduce((acc,e) => {
    const k = e.tag || "Без тега";
    if (!acc[k]) acc[k] = { income:0, expense:0 };
    if (e.type==="income") acc[k].income += e.amount||0;
    else acc[k].expense += e.amount||0;
    return acc;
  }, {})).sort((a,b) => (b[1].income+b[1].expense)-(a[1].income+a[1].expense));

  const inputS = { background:t.bgInput, color:t.text, border:`1px solid ${t.border}`, borderRadius:"10px", padding:"10px 14px", fontSize:"13px", outline:"none", fontFamily:"inherit", width:"100%" };

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
      <div style={{ display:"flex", gap:"10px", marginBottom:"20px", flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ display:"flex", gap:"6px" }}>
          {[7,14,30,90,365].map(d => (
            <button key={d} onClick={() => setFilterPeriod(d)}
              style={{ padding:"7px 12px", borderRadius:"8px", border:`1px solid ${filterPeriod===d?"#7c3aed":t.border}`, background:filterPeriod===d?"rgba(124,58,237,0.15)":t.bgCard, color:filterPeriod===d?"#a78bfa":t.textMuted, fontSize:"12px", fontWeight:filterPeriod===d?700:400, cursor:"pointer" }}>
              {d===365?"Год":`${d}д`}
            </button>
          ))}
        </div>
        <div style={{ flex:1 }} />
        <button onClick={() => { setForm({...emptyForm,type:"expense"}); setEditEntry(null); setShowForm(true); }}
          style={{ display:"flex", alignItems:"center", gap:"6px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", color:"#f87171", borderRadius:"10px", padding:"9px 14px", fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
          <Minus size={13}/>Расход
        </button>
        <button onClick={() => { setForm({...emptyForm,type:"income"}); setEditEntry(null); setShowForm(true); }}
          style={{ display:"flex", alignItems:"center", gap:"6px", background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.25)", color:"#10b981", borderRadius:"10px", padding:"9px 14px", fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
          <Plus size={13}/>Доход
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px", marginBottom:"16px" }}>
        {[
          { label:"Доходы",  value:`$${income.toLocaleString()}`,  color:"#10b981", bg:"rgba(16,185,129,0.08)",  border:"rgba(16,185,129,0.2)",  icon:"📈", count:filtered.filter(e=>e.type==="income").length },
          { label:"Расходы", value:`$${expense.toLocaleString()}`, color:"#ef4444", bg:"rgba(239,68,68,0.08)",   border:"rgba(239,68,68,0.2)",   icon:"📉", count:filtered.filter(e=>e.type==="expense").length },
          { label:"Прибыль", value:`${profit>=0?"+":""}$${profit.toLocaleString()}`, color:profit>=0?"#10b981":"#ef4444", bg:profit>=0?"rgba(16,185,129,0.08)":"rgba(239,68,68,0.08)", border:profit>=0?"rgba(16,185,129,0.2)":"rgba(239,68,68,0.2)", icon:profit>=0?"✅":"⚠️", count:filtered.length },
        ].map((s,i) => (
          <div key={i} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:"14px", padding:"16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <div>
                <div style={{ color:t.textMuted, fontSize:"12px", marginBottom:"5px" }}>{s.label}</div>
                <div style={{ color:s.color, fontSize:"24px", fontWeight:800 }}>{s.value}</div>
                <div style={{ color:t.textFaint, fontSize:"11px", marginTop:"3px" }}>{s.count} операций</div>
              </div>
              <span style={{ fontSize:"22px" }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 220px", gap:"14px", marginBottom:"14px" }}>
        <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"14px", padding:"18px" }}>
          <div style={{ color:t.textMuted, fontSize:"12px", fontWeight:600, marginBottom:"10px" }}>По тегам</div>
          {byTag.length === 0 ? <div style={{ color:t.textFaint, fontSize:"12px" }}>Нет данных</div> : byTag.slice(0,6).map(([tag,data],i) => (
            <div key={tag} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:i<byTag.slice(0,6).length-1?`1px solid ${t.border}`:"none" }}>
              <span style={{ color:t.textMuted, fontSize:"12px" }}>#{tag}</span>
              <div style={{ display:"flex", gap:"10px" }}>
                {data.income>0&&<span style={{ color:"#10b981", fontSize:"12px" }}>+${data.income.toFixed(0)}</span>}
                {data.expense>0&&<span style={{ color:"#ef4444", fontSize:"12px" }}>-${data.expense.toFixed(0)}</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"14px", padding:"18px" }}>
          <div style={{ color:t.textMuted, fontSize:"12px", fontWeight:600, marginBottom:"10px" }}>Средние показатели</div>
          {[
            { label:"Ср. доход", val:filtered.filter(e=>e.type==="income").length ? `$${(income/filtered.filter(e=>e.type==="income").length).toFixed(0)}` : "—" },
            { label:"Ср. расход", val:filtered.filter(e=>e.type==="expense").length ? `$${(expense/filtered.filter(e=>e.type==="expense").length).toFixed(0)}` : "—" },
            { label:"Маржа", val:income>0?`${((profit/income)*100).toFixed(1)}%`:"—" },
          ].map((r,i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:i<2?`1px solid ${t.border}`:"none" }}>
              <span style={{ color:t.textMuted, fontSize:"12px" }}>{r.label}</span>
              <span style={{ color:t.text, fontSize:"13px", fontWeight:700 }}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"14px", overflow:"hidden" }}>
        <div style={{ padding:"12px 18px", borderBottom:`1px solid ${t.border}`, display:"flex", justifyContent:"space-between" }}>
          <span style={{ color:t.text, fontSize:"14px", fontWeight:600 }}>Все операции</span>
          <span style={{ color:t.textFaint, fontSize:"12px" }}>{filtered.length} записей</span>
        </div>
        <div style={{ maxHeight:"380px", overflowY:"auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding:"40px", textAlign:"center", color:t.textFaint }}>Нет записей. Добавь доход или расход.</div>
          ) : filtered.map((e,i) => (
            <div key={e.id} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"11px 18px", borderBottom:i<filtered.length-1?`1px solid ${t.border}`:"none" }}
              onMouseEnter={ev=>ev.currentTarget.style.background=t.bgCardHover}
              onMouseLeave={ev=>ev.currentTarget.style.background="transparent"}>
              <div style={{ width:"32px", height:"32px", borderRadius:"9px", background:e.type==="income"?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.12)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"15px", flexShrink:0 }}>
                {e.type==="income"?"📈":"📉"}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
                  <span style={{ color:t.text, fontSize:"13px", fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{e.description}</span>
                  {e.tag&&<span style={{ background:t.bgCardHover, color:t.textMuted, fontSize:"10px", fontWeight:600, padding:"1px 6px", borderRadius:"20px", flexShrink:0 }}>#{e.tag}</span>}
                </div>
                <div style={{ color:t.textFaint, fontSize:"11px" }}>{e.date}{e.note?` · ${e.note}`:""}</div>
              </div>
              <div style={{ color:e.type==="income"?"#10b981":"#ef4444", fontSize:"15px", fontWeight:700, flexShrink:0 }}>
                {e.type==="income"?"+":"-"}${(e.amount||0).toFixed(2)}
              </div>
              <div style={{ display:"flex", gap:"4px", flexShrink:0 }}>
                <button onClick={() => { setForm({...e}); setEditEntry(e); setShowForm(true); }} style={{ background:"none", border:"none", color:t.textFaint, cursor:"pointer", padding:"3px" }}
                  onMouseEnter={ev=>ev.currentTarget.style.color="#7c3aed"} onMouseLeave={ev=>ev.currentTarget.style.color=t.textFaint}><Edit3 size={13}/></button>
                <button onClick={() => setConfirmDel(e)} style={{ background:"none", border:"none", color:t.textFaint, cursor:"pointer", padding:"3px" }}
                  onMouseEnter={ev=>ev.currentTarget.style.color="#ef4444"} onMouseLeave={ev=>ev.currentTarget.style.color=t.textFaint}><Trash2 size={13}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>{setShowForm(false);setEditEntry(null);}}
            style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
            <motion.div initial={{scale:0.93}} animate={{scale:1}} exit={{scale:0.93}} onClick={e=>e.stopPropagation()}
              style={{background:t.bgSecondary||t.bgCard,border:`1px solid ${t.border}`,borderRadius:"20px",padding:"26px",width:"100%",maxWidth:"420px",boxShadow:"0 32px 80px rgba(0,0,0,0.6)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
                <h3 style={{color:t.text,fontSize:"16px",fontWeight:700}}>{editEntry?"✏️ Редактировать":form.type==="income"?"📈 Новый доход":"📉 Новый расход"}</h3>
                <button onClick={()=>{setShowForm(false);setEditEntry(null);}} style={{background:"none",border:"none",color:t.textMuted,cursor:"pointer"}}><X size={18}/></button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                <div style={{display:"flex",gap:"8px"}}>
                  {[{v:"income",l:"📈 Доход",c:"#10b981",bc:"rgba(16,185,129,0.2)"},{v:"expense",l:"📉 Расход",c:"#ef4444",bc:"rgba(239,68,68,0.2)"}].map(opt=>(
                    <button key={opt.v} onClick={()=>setForm({...form,type:opt.v})}
                      style={{flex:1,padding:"10px",borderRadius:"10px",border:`1px solid ${form.type===opt.v?opt.bc:t.border}`,background:form.type===opt.v?opt.bc:t.bgCardHover,color:form.type===opt.v?opt.c:t.textMuted,fontSize:"13px",fontWeight:form.type===opt.v?700:400,cursor:"pointer"}}>
                      {opt.l}
                    </button>
                  ))}
                </div>
                <div><label style={{color:t.textMuted,fontSize:"11px",fontWeight:600,display:"block",marginBottom:"4px",textTransform:"uppercase"}}>Дата</label><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={inputS}/></div>
                <div><label style={{color:t.textMuted,fontSize:"11px",fontWeight:600,display:"block",marginBottom:"4px",textTransform:"uppercase"}}>Сумма ($) *</label>
                  <input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}
                    style={{...inputS,fontSize:"18px",fontWeight:700,color:form.type==="income"?"#10b981":"#ef4444",borderColor:form.amount?(form.type==="income"?"rgba(16,185,129,0.4)":"rgba(239,68,68,0.4)"):t.border}}/></div>
                <div><label style={{color:t.textMuted,fontSize:"11px",fontWeight:600,display:"block",marginBottom:"4px",textTransform:"uppercase"}}>Описание *</label><input placeholder="Зарплата, реклама, выручка..." value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={inputS}/></div>
                <div><label style={{color:t.textMuted,fontSize:"11px",fontWeight:600,display:"block",marginBottom:"4px",textTransform:"uppercase"}}>Тег</label><input placeholder="зарплата, реклама, onlyfans..." value={form.tag} onChange={e=>setForm({...form,tag:e.target.value})} style={inputS}/></div>
                <div><label style={{color:t.textMuted,fontSize:"11px",fontWeight:600,display:"block",marginBottom:"4px",textTransform:"uppercase"}}>Заметка</label><textarea placeholder="Дополнительно..." value={form.note} onChange={e=>setForm({...form,note:e.target.value})} rows={2} style={{...inputS,resize:"none"}}/></div>
                <button onClick={save} disabled={saving||!form.amount||!form.description}
                  style={{width:"100%",background:(!form.amount||!form.description)?"rgba(124,58,237,0.3)":form.type==="income"?"linear-gradient(135deg,#059669,#10b981)":"linear-gradient(135deg,#dc2626,#ef4444)",color:"#fff",border:"none",borderRadius:"12px",padding:"13px",fontSize:"14px",fontWeight:700,cursor:(!form.amount||!form.description)?"not-allowed":"pointer"}}>
                  {saving?"Сохраняем...":editEntry?"Сохранить":form.type==="income"?"Добавить доход":"Добавить расход"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDel && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setConfirmDel(null)}
            style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
            <motion.div initial={{scale:0.93}} animate={{scale:1}} exit={{scale:0.93}} onClick={e=>e.stopPropagation()}
              style={{background:t.bgSecondary||t.bgCard,border:"1px solid rgba(239,68,68,0.3)",borderRadius:"18px",padding:"24px",maxWidth:"360px",width:"100%",textAlign:"center"}}>
              <div style={{fontSize:"30px",marginBottom:"10px"}}>🗑️</div>
              <h3 style={{color:t.text,marginBottom:"8px"}}>Удалить запись?</h3>
              <p style={{color:t.textMuted,fontSize:"13px",marginBottom:"20px"}}>{confirmDel.description} · ${confirmDel.amount}</p>
              <div style={{display:"flex",gap:"10px"}}>
                <button onClick={()=>del(confirmDel.id)} style={{flex:1,background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",color:"#ef4444",borderRadius:"10px",padding:"11px",fontWeight:600,cursor:"pointer"}}>Удалить</button>
                <button onClick={()=>setConfirmDel(null)} style={{flex:1,background:t.bgCardHover,border:`1px solid ${t.border}`,color:t.textMuted,borderRadius:"10px",padding:"11px",cursor:"pointer"}}>Отмена</button>
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

// ── PLATFORMS TAB ─────────────────────────────────────────────────────────────
function PlatformsTab({ db, t }) {
  const [platforms, setPlatforms] = useState([]);
  const [newName,   setNewName]   = useState("");
  const [adding,    setAdding]    = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const DEFAULT_PLATFORMS = ["Reddit","Twitter/X","TikTok","Instagram","Telegram","Discord","Facebook","YouTube","OnlyFans","Snapchat"];

  useEffect(() => {
    return onSnapshot(collection(db, "platforms"), snap =>
      setPlatforms(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [db]);

  const add = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    await addDoc(collection(db, "platforms"), { name: newName.trim(), createdAt: new Date().toISOString() });
    setNewName("");
    setAdding(false);
  };

  const del = async (id) => {
    await import("firebase/firestore").then(m => m.deleteDoc(m.doc(db, "platforms", id)));
    setConfirmDel(null);
  };

  const allPlatforms = [
    ...DEFAULT_PLATFORMS.map(name => ({ id: null, name, isDefault: true })),
    ...platforms.filter(p => !DEFAULT_PLATFORMS.includes(p.name)).map(p => ({ ...p, isDefault: false })),
  ];

  const inputS = { background: t.bgInput, color: t.text, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "10px 14px", fontSize: "13px", outline: "none", fontFamily: "inherit", flex: 1 };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "6px" }}>Платформы для трафика</h3>
        <p style={{ color: t.textMuted, fontSize: "13px" }}>Эти платформы отображаются в чек-листе публикаций и отчётах.</p>
      </div>

      {/* Add new */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
        <input value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
          placeholder="Название новой платформы..."
          style={inputS} />
        <button onClick={add} disabled={adding || !newName.trim()}
          style={{ display: "flex", alignItems: "center", gap: "6px", background: newName.trim() ? "linear-gradient(135deg,#7c3aed,#db2877)" : "rgba(124,58,237,0.2)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 700, cursor: newName.trim() ? "pointer" : "not-allowed", flexShrink: 0 }}>
          <Plus size={14} />{adding ? "..." : "Добавить"}
        </button>
      </div>

      {/* Platforms grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "10px" }}>
        {allPlatforms.map((p, i) => (
          <div key={p.id || p.name} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "12px" }}>
            <Globe size={16} style={{ color: p.isDefault ? "#7c3aed" : "#10b981", flexShrink: 0 }} />
            <span style={{ color: t.text, fontSize: "13px", fontWeight: 600, flex: 1 }}>{p.name}</span>
            {p.isDefault ? (
              <span style={{ color: t.textFaint, fontSize: "10px" }}>по умолч.</span>
            ) : (
              <button onClick={() => setConfirmDel(p)}
                style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", padding: "2px" }}
                onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                onMouseLeave={e => e.currentTarget.style.color = t.textFaint}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: "16px", padding: "12px 16px", background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: "10px" }}>
        <span style={{ color: "#a78bfa", fontSize: "12px" }}>
          💡 Платформы по умолчанию нельзя удалить. Добавленные тобой — можно.
        </span>
      </div>

      <AnimatePresence>
        {confirmDel && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={() => setConfirmDel(null)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
            <motion.div initial={{ scale:0.92 }} animate={{ scale:1 }} exit={{ scale:0.92 }}
              onClick={e => e.stopPropagation()}
              style={{ background: t.bgSecondary||t.bgCard, border:"1px solid rgba(239,68,68,0.3)", borderRadius:"18px", padding:"24px", maxWidth:"360px", width:"100%", textAlign:"center" }}>
              <div style={{ fontSize:"28px", marginBottom:"10px" }}>🗑️</div>
              <h3 style={{ color:t.text, marginBottom:"8px" }}>Удалить платформу?</h3>
              <p style={{ color:t.textMuted, fontSize:"13px", marginBottom:"20px" }}>«{confirmDel.name}» будет удалена из чек-листа</p>
              <div style={{ display:"flex", gap:"10px" }}>
                <button onClick={() => del(confirmDel.id)} style={{ flex:1, background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", color:"#ef4444", borderRadius:"10px", padding:"11px", fontWeight:600, cursor:"pointer" }}>Удалить</button>
                <button onClick={() => setConfirmDel(null)} style={{ flex:1, background:t.bgCardHover, border:`1px solid ${t.border}`, color:t.textMuted, borderRadius:"10px", padding:"11px", cursor:"pointer" }}>Отмена</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
