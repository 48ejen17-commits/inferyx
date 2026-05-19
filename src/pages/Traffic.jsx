import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, orderBy, query, addDoc } from "firebase/firestore";
import { useAuth, ROLE_COLORS } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Plus, Filter, TrendingUp, X } from "lucide-react";

const PLATFORM_ICONS = {
  "Reddit": "🟠", "Twitter/X": "🐦", "TikTok": "🎵", "Instagram": "📸",
  "Telegram": "✈️", "Discord": "💬", "Facebook": "📘", "YouTube": "▶️",
  "OnlyFans": "🔞", "Snapchat": "👻",
};

const TYPE_COLORS = { post: "#0ea5e9", traffic: "#10b981", story: "#f59e0b", reels: "#db2777" };

export default function Traffic() {
  const { db, user, profile } = useAuth();
  const { theme } = useTheme();
  const t = theme;
  const [entries, setEntries] = useState([]);
  const [models, setModels] = useState([]);
  const [platforms, setPlatforms] = useState(Object.keys(PLATFORM_ICONS));
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [filterAdmin, setFilterAdmin] = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterModel, setFilterModel] = useState("all");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ platform: "Reddit", model: "", type: "post", note: "", traffic: "", newPlatform: "" });

  useEffect(() => {
    const unsubs = [
      onSnapshot(query(collection(db, "entries"), orderBy("createdAt", "desc")), snap => {
        setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }),
      onSnapshot(collection(db, "models"), snap => setModels(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "users"), snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "platforms"), snap => {
        const custom = snap.docs.map(d => d.data().name);
        setPlatforms([...Object.keys(PLATFORM_ICONS), ...custom.filter(p => !PLATFORM_ICONS[p])]);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  const addEntry = async () => {
    if (!form.note.trim() || !form.model) return;
    await addDoc(collection(db, "entries"), {
      platform: form.platform, platformIcon: PLATFORM_ICONS[form.platform] || "📌",
      model: form.model, type: form.type, note: form.note,
      traffic: Number(form.traffic) || 0,
      userId: user.uid, adminName: profile?.name || "—", admin: profile?.name || "—",
      createdAt: new Date().toISOString(),
      date: new Date().toLocaleDateString("ru-RU"),
      time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    });
    setForm({ ...form, note: "", traffic: "" });
    setShowForm(false);
  };

  const addPlatform = async () => {
    if (!form.newPlatform.trim()) return;
    await addDoc(collection(db, "platforms"), { name: form.newPlatform.trim() });
    setForm({ ...form, platform: form.newPlatform.trim(), newPlatform: "" });
  };

  const filtered = entries.filter(e =>
    (filterAdmin === "all" || e.userId === filterAdmin) &&
    (filterPlatform === "all" || e.platform === filterPlatform) &&
    (filterModel === "all" || e.model === filterModel)
  );

  const totalToday = entries.filter(e => e.date === new Date().toLocaleDateString("ru-RU")).length;

  const inputStyle = { background: t.bgInput, color: t.text, border: `1px solid ${t.borderInput}`, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", outline: "none", fontFamily: "inherit", width: "100%" };
  const selectStyle = { ...inputStyle };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: t.text, marginBottom: "4px" }}>Трафик</h1>
          <p style={{ color: t.textMuted, fontSize: "14px" }}>Записей сегодня: <span style={{ color: "#7c3aed" }}>{totalToday}</span></p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
          <Plus size={16} />Добавить запись
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "24px", marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 600 }}>Новая запись</h3>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
              <div>
                <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Платформа</label>
                <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} style={selectStyle}>
                  {platforms.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Модель</label>
                <select value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} style={selectStyle}>
                  <option value="">Выбери модель</option>
                  {models.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Тип</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={selectStyle}>
                  <option value="post">Пост</option>
                  <option value="traffic">Трафик</option>
                  <option value="story">Story</option>
                  <option value="reels">Reels</option>
                </select>
              </div>
              <div>
                <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Трафик</label>
                <input type="number" placeholder="0" value={form.traffic} onChange={e => setForm({ ...form, traffic: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Заметка</label>
                <input placeholder="Описание действия..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: "10px", alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Добавить платформу</label>
                  <input placeholder="Название новой платформы..." value={form.newPlatform} onChange={e => setForm({ ...form, newPlatform: e.target.value })} style={inputStyle} />
                </div>
                <button onClick={addPlatform} style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.text, borderRadius: "10px", padding: "10px 16px", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" }}>+ Платформа</button>
              </div>
            </div>
            <button onClick={addEntry}
              style={{ marginTop: "16px", background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "10px", padding: "12px 28px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
              Сохранить
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
        <Filter size={16} style={{ color: t.textMuted }} />
        {[
          { value: filterAdmin, onChange: setFilterAdmin, options: [{ v: "all", l: "Все пользователи" }, ...users.map(u => ({ v: u.id, l: u.name }))] },
          { value: filterPlatform, onChange: setFilterPlatform, options: [{ v: "all", l: "Все платформы" }, ...platforms.map(p => ({ v: p, l: p }))] },
          { value: filterModel, onChange: setFilterModel, options: [{ v: "all", l: "Все модели" }, ...models.map(m => ({ v: m.name, l: m.name }))] },
        ].map((f, i) => (
          <select key={i} value={f.value} onChange={e => f.onChange(e.target.value)}
            style={{ background: t.bgInput, color: t.text, border: `1px solid ${t.border}`, borderRadius: "8px", padding: "8px 14px", fontSize: "13px", outline: "none" }}>
            {f.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        ))}
      </div>

      {/* Entries */}
      {loading ? (
        <div style={{ color: t.textMuted, textAlign: "center", padding: "60px" }}>Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: t.textMuted, textAlign: "center", padding: "60px" }}>
          <TrendingUp size={40} style={{ marginBottom: "12px", opacity: 0.3 }} />
          <div>Нет записей. Добавь первую!</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map((e, i) => (
            <motion.div key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "12px", padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ fontSize: "22px", flexShrink: 0 }}>{e.platformIcon || PLATFORM_ICONS[e.platform] || "📌"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                  <span style={{ color: t.text, fontWeight: 600, fontSize: "14px" }}>{e.platform}</span>
                  <span style={{ color: t.textMuted, fontSize: "13px" }}>·</span>
                  <span style={{ color: t.textSecondary, fontSize: "13px" }}>{e.model}</span>
                  <span style={{ background: `${TYPE_COLORS[e.type] || "#475569"}20`, color: TYPE_COLORS[e.type] || "#475569", fontSize: "11px", padding: "2px 8px", borderRadius: "20px", fontWeight: 600 }}>
                    {e.type}
                  </span>
                </div>
                <div style={{ color: t.textMuted, fontSize: "13px" }}>{e.note}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ color: "#7c3aed", fontSize: "13px", fontWeight: 600 }}>{e.adminName || e.admin}</div>
                {e.traffic > 0 && <div style={{ color: "#10b981", fontSize: "14px", fontWeight: 700 }}>+{e.traffic.toLocaleString()}</div>}
                <div style={{ color: t.textFaint, fontSize: "12px" }}>{e.date} {e.time}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}