import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { useAuth, ROLE_COLORS, ROLE_LABELS } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { TrendingUp, Users, CheckSquare, Activity, ArrowUpRight, Clock } from "lucide-react";

const card = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

export default function Dashboard() {
  const { db, profile } = useAuth();
  const { theme } = useTheme();
  const [entries, setEntries] = useState([]);
  const [users, setUsers] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubs = [
      onSnapshot(query(collection(db, "entries"), orderBy("createdAt", "desc"), limit(50)), snap => {
        setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }),
      onSnapshot(collection(db, "users"), snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "models"), snap => setModels(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  const today = new Date().toLocaleDateString("ru-RU");
  const todayEntries = entries.filter(e => e.date === today);
  const totalTraffic = entries.reduce((s, e) => s + (e.traffic || 0), 0);
  const todayTraffic = todayEntries.reduce((s, e) => s + (e.traffic || 0), 0);

  const topAdmins = users
    .map(u => ({
      ...u,
      count: entries.filter(e => e.userId === u.id).length,
      traffic: entries.filter(e => e.userId === u.id).reduce((s, e) => s + (e.traffic || 0), 0),
    }))
    .sort((a, b) => b.traffic - a.traffic)
    .slice(0, 5);

  const stats = [
    { label: "Всего трафика", value: totalTraffic.toLocaleString(), sub: `+${todayTraffic.toLocaleString()} сегодня`, icon: TrendingUp, color: "#7c3aed" },
    { label: "Записей сегодня", value: todayEntries.length, sub: `из ${entries.length} всего`, icon: Activity, color: "#0ea5e9" },
    { label: "Моделей", value: models.length, sub: "активных", icon: Users, color: "#10b981" },
    { label: "Команда", value: users.length, sub: "участников", icon: CheckSquare, color: "#f59e0b" },
  ];

  const t = theme;

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: t.text, marginBottom: "6px" }}>
          Привет, {profile?.name?.split(" ")[0] || "—"} 👋
        </h1>
        <p style={{ color: t.textMuted, fontSize: "14px" }}>
          {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })} · Inferyx Dashboard
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div variants={container} initial="hidden" animate="show"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        {stats.map((s, i) => (
          <motion.div key={i} variants={card}
            style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px", position: "relative", overflow: "hidden", transition: "background 0.3s" }}>
            <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "80px", height: "80px", borderRadius: "50%", background: `${s.color}15` }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ color: t.textMuted, fontSize: "13px", marginBottom: "8px" }}>{s.label}</div>
                <div style={{ color: t.text, fontSize: "28px", fontWeight: 700, lineHeight: 1 }}>{loading ? "—" : s.value}</div>
                <div style={{ color: s.color, fontSize: "12px", marginTop: "6px" }}>{s.sub}</div>
              </div>
              <div style={{ background: `${s.color}20`, borderRadius: "10px", padding: "10px", color: s.color }}>
                <s.icon size={20} />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Recent activity */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
          style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "24px", transition: "background 0.3s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600 }}>Последние записи</h3>
            <Clock size={16} style={{ color: t.textMuted }} />
          </div>
          {loading ? (
            <div style={{ color: t.textMuted, textAlign: "center", padding: "20px" }}>Загрузка...</div>
          ) : entries.length === 0 ? (
            <div style={{ color: t.textMuted, textAlign: "center", padding: "20px" }}>Нет записей</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {entries.slice(0, 6).map((e, i) => (
                <motion.div key={e.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px", borderRadius: "10px", background: t.bgCardHover }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                    {e.platformIcon || "📌"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: t.text, fontSize: "13px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.note || "—"}</div>
                    <div style={{ color: t.textMuted, fontSize: "12px" }}>{e.platform} · {e.adminName || e.admin || "—"}</div>
                  </div>
                  {e.traffic > 0 && <div style={{ color: "#10b981", fontSize: "13px", fontWeight: 600, flexShrink: 0 }}>+{e.traffic}</div>}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Top performers */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
          style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "24px", transition: "background 0.3s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600 }}>Топ команды</h3>
            <ArrowUpRight size={16} style={{ color: t.textMuted }} />
          </div>
          {topAdmins.length === 0 ? (
            <div style={{ color: t.textMuted, textAlign: "center", padding: "20px" }}>Нет данных</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {topAdmins.map((u, i) => {
                const roleColor = ROLE_COLORS[u.role] || "#64748b";
                const maxTraffic = topAdmins[0]?.traffic || 1;
                const pct = Math.round((u.traffic / maxTraffic) * 100);
                return (
                  <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.07 }}
                    style={{ padding: "12px", borderRadius: "10px", background: t.bgCardHover }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: `linear-gradient(135deg, ${roleColor}, ${roleColor}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#fff" }}>
                          {(u.name || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ color: t.text, fontSize: "13px", fontWeight: 500 }}>{u.name}</div>
                          <div style={{ color: roleColor, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{ROLE_LABELS[u.role]}</div>
                        </div>
                      </div>
                      <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{u.traffic.toLocaleString()}</div>
                    </div>
                    <div style={{ height: "3px", background: t.border, borderRadius: "2px" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.5 + i * 0.07, duration: 0.6 }}
                        style={{ height: "100%", borderRadius: "2px", background: `linear-gradient(90deg, ${roleColor}, ${roleColor}88)` }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}