import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, query, orderBy, limit, addDoc, getDocs } from "firebase/firestore";
import { useAuth, ROLE_COLORS, ROLE_LABELS } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  Shield, Activity, Users, TrendingUp, FileText, Calculator,
  Clock, Filter, ChevronDown, AlertTriangle, CheckCircle,
  MessageSquare, Star, DollarSign, Percent, Target, Zap,
  Download, RefreshCw, Search, Eye, BarChart2, Award
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
  const [mode, setMode] = useState("salary"); // salary | conversion | plan

  // Salary calculator
  const [rateType, setRateType] = useState("per_post"); // per_post | percent | fixed
  const [rateValue, setRateValue] = useState("");
  const [avgRevenue, setAvgRevenue] = useState("");
  const [period, setPeriod] = useState("month");

  // Conversion calculator
  const [views, setViews] = useState("");
  const [clicks, setClicks] = useState("");
  const [subs, setSubs] = useState("");
  const [subPrice, setSubPrice] = useState("");

  // Plan calculator
  const [targetRevenue, setTargetRevenue] = useState("");
  const [convRate, setConvRate] = useState("");
  const [avgCheck, setAvgCheck] = useState("");

  const periodDays = { day: 1, week: 7, month: 30 };
  const days = periodDays[period] || 30;

  // Salary calc
  const salaryResults = users.map(u => {
    const userEntries = entries.filter(e => {
      const d = new Date(e.createdAt);
      const now = new Date();
      return e.userId === u.uid && (now - d) / 86400000 <= days;
    });
    const postCount = userEntries.length;
    let salary = 0;
    if (rateType === "per_post") salary = postCount * (parseFloat(rateValue) || 0);
    else if (rateType === "percent") salary = postCount * (parseFloat(avgRevenue) || 0) * ((parseFloat(rateValue) || 0) / 100);
    else if (rateType === "fixed") salary = parseFloat(rateValue) || 0;
    return { ...u, postCount, salary };
  }).sort((a, b) => b.postCount - a.postCount);

  // Conversion calc
  const ctr = clicks && views ? ((parseFloat(clicks) / parseFloat(views)) * 100).toFixed(1) : null;
  const subRate = subs && clicks ? ((parseFloat(subs) / parseFloat(clicks)) * 100).toFixed(1) : null;
  const revenue = subs && subPrice ? (parseFloat(subs) * parseFloat(subPrice)).toFixed(0) : null;
  const roas = revenue && views ? (parseFloat(revenue) / parseFloat(views) * 1000).toFixed(2) : null;

  // Plan calc
  const neededSubs  = targetRevenue && avgCheck ? Math.ceil(parseFloat(targetRevenue) / parseFloat(avgCheck)) : null;
  const neededClicks = neededSubs && convRate ? Math.ceil(neededSubs / (parseFloat(convRate) / 100)) : null;
  const neededPosts  = neededClicks ? Math.ceil(neededClicks / 50) : null; // ~50 clicks per post avg

  const inputS = { background: t.bgInput, color: t.text, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", outline: "none", fontFamily: "inherit", width: "100%" };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Mode tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        {[
          { key: "salary",     label: "💰 Зарплаты" },
          { key: "conversion", label: "📊 Конверсия" },
          { key: "plan",       label: "🎯 Планирование" },
        ].map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            style={{ padding: "9px 18px", borderRadius: "10px", border: `1px solid ${mode === m.key ? "#7c3aed" : t.border}`, background: mode === m.key ? "rgba(124,58,237,0.15)" : t.bgCard, color: mode === m.key ? "#a78bfa" : t.textMuted, fontSize: "13px", fontWeight: mode === m.key ? 700 : 500, cursor: "pointer" }}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === "salary" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "18px" }}>
          {/* Settings */}
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "18px" }}>Настройки расчёта</h3>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase" }}>Период</label>
              <div style={{ display: "flex", gap: "6px" }}>
                {[{ v: "day", l: "День" }, { v: "week", l: "Неделя" }, { v: "month", l: "Месяц" }].map(opt => (
                  <button key={opt.v} onClick={() => setPeriod(opt.v)}
                    style={{ flex: 1, padding: "8px", borderRadius: "8px", border: `1px solid ${period === opt.v ? "#7c3aed" : t.border}`, background: period === opt.v ? "rgba(124,58,237,0.15)" : t.bgCardHover, color: period === opt.v ? "#a78bfa" : t.textMuted, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase" }}>Тип оплаты</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {[
                  { v: "per_post", l: "$ за пост" },
                  { v: "percent",  l: "% от выручки" },
                  { v: "fixed",    l: "Фиксированная" },
                ].map(opt => (
                  <button key={opt.v} onClick={() => setRateType(opt.v)}
                    style={{ padding: "9px 14px", borderRadius: "8px", border: `1px solid ${rateType === opt.v ? "#7c3aed" : t.border}`, background: rateType === opt.v ? "rgba(124,58,237,0.12)" : t.bgCardHover, color: rateType === opt.v ? "#a78bfa" : t.textMuted, fontSize: "13px", fontWeight: rateType === opt.v ? 700 : 400, cursor: "pointer", textAlign: "left" }}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: rateType === "percent" ? "12px" : 0 }}>
              <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase" }}>
                {rateType === "per_post" ? "Ставка за пост ($)" : rateType === "percent" ? "Процент (%)" : "Фикс. оплата ($)"}
              </label>
              <input type="number" value={rateValue} onChange={e => setRateValue(e.target.value)} placeholder="0" style={inputS} />
            </div>

            {rateType === "percent" && (
              <div style={{ marginTop: "12px" }}>
                <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase" }}>Средняя выручка с поста ($)</label>
                <input type="number" value={avgRevenue} onChange={e => setAvgRevenue(e.target.value)} placeholder="0" style={inputS} />
              </div>
            )}
          </div>

          {/* Results */}
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "16px" }}>Расчёт выплат</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {salaryResults.map((u, i) => {
                const rc = ROLE_COLORS[u.role] || "#64748b";
                const maxPosts = Math.max(...salaryResults.map(r => r.postCount), 1);
                const pct = Math.round((u.postCount / maxPosts) * 100);
                return (
                  <div key={u.id} style={{ padding: "14px 16px", background: t.bgCardHover, borderRadius: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: `linear-gradient(135deg, ${rc}, ${rc}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: u.avatarEmoji ? "14px" : "11px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                        {u.avatarEmoji || (u.name || "?")[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{u.name}</span>
                          <span style={{ color: u.salary > 0 ? "#10b981" : t.textFaint, fontSize: "14px", fontWeight: 700 }}>
                            {u.salary > 0 ? `$${u.salary.toFixed(0)}` : "—"}
                          </span>
                        </div>
                        <div style={{ color: t.textFaint, fontSize: "11px" }}>{u.postCount} постов за {period === "day" ? "день" : period === "week" ? "неделю" : "месяц"}</div>
                      </div>
                    </div>
                    <div style={{ height: "4px", background: t.border, borderRadius: "2px", overflow: "hidden" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
                        style={{ height: "100%", background: `linear-gradient(90deg, #7c3aed, #db2877)`, borderRadius: "2px" }} />
                    </div>
                  </div>
                );
              })}
              {rateValue && (
                <div style={{ marginTop: "8px", padding: "14px 16px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "12px", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: t.text, fontWeight: 600 }}>Итого к выплате:</span>
                  <span style={{ color: "#10b981", fontSize: "16px", fontWeight: 700 }}>${salaryResults.reduce((s, u) => s + u.salary, 0).toFixed(0)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === "conversion" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "18px" }}>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "18px" }}>Данные воронки</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                { label: "👁 Просмотры поста", v: views, set: setViews, ph: "10000" },
                { label: "🖱 Клики на профиль", v: clicks, set: setClicks, ph: "500" },
                { label: "🔔 Новых подписчиков", v: subs, set: setSubs, ph: "50" },
                { label: "💵 Цена подписки ($)", v: subPrice, set: setSubPrice, ph: "9.99" },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px", fontWeight: 600 }}>{f.label}</label>
                  <input type="number" value={f.v} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={inputS} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "20px" }}>Результаты</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[
                { label: "CTR (клики/просмотры)", value: ctr ? `${ctr}%` : "—", color: "#0ea5e9", icon: "👆", good: ctr > 3 },
                { label: "Конверсия в подписку", value: subRate ? `${subRate}%` : "—", color: "#7c3aed", icon: "🔔", good: subRate > 5 },
                { label: "Выручка с постов", value: revenue ? `$${fmt(Math.round(revenue))}` : "—", color: "#10b981", icon: "💰", good: true },
                { label: "Revenue per 1000 views", value: roas ? `$${roas}` : "—", color: "#f59e0b", icon: "📈", good: roas > 1 },
              ].map((m, i) => (
                <div key={i} style={{ background: t.bgCardHover, borderRadius: "12px", padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <span style={{ fontSize: "20px" }}>{m.icon}</span>
                    {m.value !== "—" && (
                      <span style={{ background: m.good ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", color: m.good ? "#10b981" : "#ef4444", fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "6px" }}>
                        {m.good ? "✓ OK" : "↑ Рост"}
                      </span>
                    )}
                  </div>
                  <div style={{ color: m.color, fontSize: "24px", fontWeight: 700, marginBottom: "4px" }}>{m.value}</div>
                  <div style={{ color: t.textFaint, fontSize: "11px" }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* Funnel visualization */}
            {views && (
              <div style={{ marginTop: "20px" }}>
                <div style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Воронка</div>
                {[
                  { label: "Просмотры", val: parseFloat(views) || 0, color: "#0ea5e9" },
                  { label: "Клики", val: parseFloat(clicks) || 0, color: "#7c3aed" },
                  { label: "Подписки", val: parseFloat(subs) || 0, color: "#10b981" },
                ].map((step, i) => {
                  const maxVal = parseFloat(views) || 1;
                  const pct = Math.round((step.val / maxVal) * 100);
                  return (
                    <div key={i} style={{ marginBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                        <span style={{ color: t.textMuted, fontSize: "12px" }}>{step.label}</span>
                        <span style={{ color: t.text, fontSize: "12px", fontWeight: 600 }}>{fmt(step.val)} ({pct}%)</span>
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
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "18px" }}>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "18px" }}>Цель</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                { label: "🎯 Цель по выручке ($)", v: targetRevenue, set: setTargetRevenue, ph: "5000" },
                { label: "💵 Средний чек ($)", v: avgCheck, set: setAvgCheck, ph: "15" },
                { label: "📊 Конверсия клик→подписка (%)", v: convRate, set: setConvRate, ph: "8" },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px", fontWeight: 600 }}>{f.label}</label>
                  <input type="number" value={f.v} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={inputS} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "20px" }}>Что нужно сделать</h3>
            {neededSubs ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { icon: "💰", label: "Нужно выручки", value: `$${fmt(parseFloat(targetRevenue))}`, color: "#10b981" },
                  { icon: "🔔", label: "Нужно подписчиков", value: fmt(neededSubs), color: "#7c3aed" },
                  { icon: "🖱", label: "Нужно кликов", value: neededClicks ? fmt(neededClicks) : "—", color: "#0ea5e9" },
                  { icon: "📝", label: "Нужно постов (прибл.)", value: neededPosts ? fmt(neededPosts) : "—", color: "#f59e0b" },
                  { icon: "👤", label: "Постов на чаттера (5 чел.)", value: neededPosts ? fmt(Math.ceil(neededPosts / 5)) : "—", color: "#db2877" },
                  { icon: "📅", label: "Постов в день (30 дней)", value: neededPosts ? Math.ceil(neededPosts / 30) : "—", color: "#8b5cf6" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", background: t.bgCardHover, borderRadius: "12px" }}>
                    <span style={{ fontSize: "22px" }}>{item.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: t.textMuted, fontSize: "12px" }}>{item.label}</div>
                    </div>
                    <div style={{ color: item.color, fontSize: "20px", fontWeight: 700 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: t.textFaint, textAlign: "center", padding: "40px", fontSize: "14px" }}>
                Заполни поля слева чтобы увидеть план
              </div>
            )}
          </div>
        </div>
      )}
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
