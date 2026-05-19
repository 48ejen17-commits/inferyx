import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { collection, onSnapshot } from "firebase/firestore";
import { useAuth, ROLE_COLORS, ROLE_LABELS } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { BarChart3, TrendingUp, Users, Calendar } from "lucide-react";

export default function Analytics() {
  const { db } = useAuth();
  const { theme } = useTheme();
  const t = theme;
  const [entries, setEntries] = useState([]);
  const [users, setUsers] = useState([]);
  const [models, setModels] = useState([]);
  const [period, setPeriod] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "entries"), snap => { setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); }),
      onSnapshot(collection(db, "users"), snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "models"), snap => setModels(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  const getDays = (n) => {
    const days = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString("ru-RU"));
    }
    return days;
  };

  const days = getDays(period);
  const dailyData = days.map(date => ({
    date, shortDate: date.split(".").slice(0, 2).join("."),
    count: entries.filter(e => e.date === date).length,
    traffic: entries.filter(e => e.date === date).reduce((s, e) => s + (e.traffic || 0), 0),
  }));

  const maxCount = Math.max(...dailyData.map(d => d.count), 1);
  const maxTraffic = Math.max(...dailyData.map(d => d.traffic), 1);

  const platformStats = [...new Set(entries.map(e => e.platform))].map(p => ({
    platform: p,
    count: entries.filter(e => e.platform === p).length,
    traffic: entries.filter(e => e.platform === p).reduce((s, e) => s + (e.traffic || 0), 0),
  })).sort((a, b) => b.traffic - a.traffic).slice(0, 8);

  const maxPlatformTraffic = Math.max(...platformStats.map(p => p.traffic), 1);

  const userStats = users.map(u => ({
    ...u,
    count: entries.filter(e => e.userId === u.id || e.userId === u.uid).length,
    traffic: entries.filter(e => e.userId === u.id || e.userId === u.uid).reduce((s, e) => s + (e.traffic || 0), 0),
  })).sort((a, b) => b.traffic - a.traffic);

  const modelStats = models.map(m => ({
    ...m,
    count: entries.filter(e => e.model === m.name).length,
    traffic: entries.filter(e => e.model === m.name).reduce((s, e) => s + (e.traffic || 0), 0),
  })).sort((a, b) => b.traffic - a.traffic);

  const totalTraffic = entries.reduce((s, e) => s + (e.traffic || 0), 0);
  const periodTraffic = entries.filter(e => days.includes(e.date)).reduce((s, e) => s + (e.traffic || 0), 0);
  const periodEntries = entries.filter(e => days.includes(e.date)).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: t.text, marginBottom: "4px" }}>Аналитика</h1>
          <p style={{ color: t.textMuted, fontSize: "14px" }}>Сводная статистика агентства</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {[7, 14, 30].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ background: period === p ? "rgba(124,58,237,0.2)" : t.bgCard, border: `1px solid ${period === p ? "#7c3aed" : t.border}`, color: period === p ? "#a78bfa" : t.textMuted, borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              {p}д
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "28px" }}>
        {[
          { label: `Трафик за ${period}д`, value: periodTraffic.toLocaleString(), icon: TrendingUp, color: "#7c3aed" },
          { label: `Записей за ${period}д`, value: periodEntries, icon: BarChart3, color: "#0ea5e9" },
          { label: "Всего трафика", value: totalTraffic.toLocaleString(), icon: Calendar, color: "#10b981" },
          { label: "Всего записей", value: entries.length, icon: Users, color: "#f59e0b" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "14px", padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ color: t.textMuted, fontSize: "12px", marginBottom: "6px" }}>{s.label}</div>
                <div style={{ color: t.text, fontSize: "24px", fontWeight: 700 }}>{loading ? "—" : s.value}</div>
              </div>
              <div style={{ background: `${s.color}20`, borderRadius: "8px", padding: "8px", color: s.color }}>
                <s.icon size={18} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        {/* Daily entries chart */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
          style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "24px" }}>
          <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "20px" }}>Записей по дням</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "120px" }}>
            {dailyData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", height: "100%" }}>
                <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: `${Math.max((d.count / maxCount) * 100, d.count > 0 ? 8 : 0)}%` }}
                    transition={{ delay: 0.3 + i * 0.03, duration: 0.5 }}
                    style={{ width: "100%", background: d.count > 0 ? "linear-gradient(180deg, #7c3aed, #db2777)" : t.border, borderRadius: "4px 4px 0 0", minHeight: d.count > 0 ? "4px" : "2px" }} />
                </div>
                <div style={{ color: t.textFaint, fontSize: "9px", whiteSpace: "nowrap" }}>{d.shortDate}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Daily traffic chart */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
          style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "24px" }}>
          <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "20px" }}>Трафик по дням</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "120px" }}>
            {dailyData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", height: "100%" }}>
                <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: `${Math.max((d.traffic / maxTraffic) * 100, d.traffic > 0 ? 8 : 0)}%` }}
                    transition={{ delay: 0.3 + i * 0.03, duration: 0.5 }}
                    style={{ width: "100%", background: d.traffic > 0 ? "linear-gradient(180deg, #10b981, #0ea5e9)" : t.border, borderRadius: "4px 4px 0 0", minHeight: d.traffic > 0 ? "4px" : "2px" }} />
                </div>
                <div style={{ color: t.textFaint, fontSize: "9px", whiteSpace: "nowrap" }}>{d.shortDate}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        {/* Platform breakdown */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "24px" }}>
          <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "20px" }}>По платформам</h3>
          {platformStats.length === 0 ? (
            <div style={{ color: t.textMuted, textAlign: "center", padding: "20px" }}>Нет данных</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {platformStats.map((p, i) => (
                <div key={p.platform}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ color: t.textSecondary, fontSize: "13px" }}>{p.platform}</span>
                    <span style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{p.traffic.toLocaleString()}</span>
                  </div>
                  <div style={{ height: "4px", background: t.border, borderRadius: "2px" }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(p.traffic / maxPlatformTraffic) * 100}%` }} transition={{ delay: 0.5 + i * 0.05, duration: 0.6 }}
                      style={{ height: "100%", borderRadius: "2px", background: `hsl(${(i * 47) % 360}, 70%, 60%)` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* User leaderboard */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "24px" }}>
          <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "20px" }}>Лидерборд команды</h3>
          {userStats.length === 0 ? (
            <div style={{ color: t.textMuted, textAlign: "center", padding: "20px" }}>Нет данных</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {userStats.map((u, i) => (
                <motion.div key={u.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.06 }}
                  style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px", background: t.bgCardHover, borderRadius: "10px" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2e" : t.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: i < 3 ? "#000" : t.textMuted, flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `linear-gradient(135deg, ${ROLE_COLORS[u.role]}, ${ROLE_COLORS[u.role]}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {(u.name || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{u.name}</div>
                    <div style={{ color: ROLE_COLORS[u.role], fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{ROLE_LABELS[u.role]}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#10b981", fontSize: "14px", fontWeight: 700 }}>{u.traffic.toLocaleString()}</div>
                    <div style={{ color: t.textMuted, fontSize: "11px" }}>{u.count} записей</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Model stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
        style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "24px" }}>
        <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "20px" }}>По моделям</h3>
        {modelStats.length === 0 ? (
          <div style={{ color: t.textMuted, textAlign: "center", padding: "20px" }}>Нет данных</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
            {modelStats.map((m, i) => (
              <motion.div key={m.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 + i * 0.06 }}
                style={{ background: t.bgCardHover, borderRadius: "12px", padding: "16px", border: `1px solid ${t.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `linear-gradient(135deg, hsl(${i * 60}, 70%, 50%), hsl(${i * 60 + 40}, 70%, 40%))`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "#fff" }}>
                    {m.name[0].toUpperCase()}
                  </div>
                  <div style={{ color: t.text, fontWeight: 600, fontSize: "14px" }}>{m.name}</div>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ color: "#10b981", fontSize: "18px", fontWeight: 700 }}>{m.traffic.toLocaleString()}</div>
                    <div style={{ color: t.textMuted, fontSize: "11px" }}>трафик</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ color: "#0ea5e9", fontSize: "18px", fontWeight: 700 }}>{m.count}</div>
                    <div style={{ color: t.textMuted, fontSize: "11px" }}>записей</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}