import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth, ROLES } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Plus, X, Edit3, Trash2, AlertTriangle, Check } from "lucide-react";

const MODEL_COLORS = [
  "#7c3aed", "#db2777", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316",
];

const MODEL_EMOJIS = ["👤", "⭐", "🌟", "💎", "🔥", "🎯", "👑", "🦋", "🌸", "💫"];

export default function Models() {
  const { db, profile } = useAuth();
  const { theme } = useTheme();
  const t = theme;

  const [models, setModels] = useState([]);
  const [entries, setEntries] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ name: "", note: "", color: MODEL_COLORS[0], emoji: MODEL_EMOJIS[0], status: "active" });

  const canManage = [ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER].includes(profile?.role);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "models"), snap => setModels(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "entries"), snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  const addModel = async () => {
    if (!form.name.trim()) return;
    await addDoc(collection(db, "models"), {
      name: form.name.trim(),
      note: form.note.trim(),
      color: form.color,
      emoji: form.emoji,
      status: form.status,
      createdAt: new Date().toISOString(),
    });
    setForm({ name: "", note: "", color: MODEL_COLORS[0], emoji: MODEL_EMOJIS[0], status: "active" });
    setShowForm(false);
  };

  const saveEdit = async () => {
    if (!editing || !form.name.trim()) return;
    await updateDoc(doc(db, "models", editing.id), {
      name: form.name.trim(),
      note: form.note.trim(),
      color: form.color,
      emoji: form.emoji,
      status: form.status,
    });
    setEditing(null);
    setShowForm(false);
    setForm({ name: "", note: "", color: MODEL_COLORS[0], emoji: MODEL_EMOJIS[0], status: "active" });
  };

  const startEdit = (model) => {
    setEditing(model);
    setForm({ name: model.name, note: model.note || "", color: model.color || MODEL_COLORS[0], emoji: model.emoji || MODEL_EMOJIS[0], status: model.status || "active" });
    setShowForm(true);
  };

  const deleteModel = async (model) => {
    await deleteDoc(doc(db, "models", model.id));
    setConfirmDelete(null);
  };

  const getModelStats = (name) => ({
    posts: entries.filter(e => e.model === name).length,
    traffic: entries.filter(e => e.model === name).reduce((s, e) => s + (e.traffic || 0), 0),
    today: entries.filter(e => e.model === name && e.date === new Date().toLocaleDateString("ru-RU")).length,
  });

  const inputStyle = { background: t.bgInput, color: t.text, border: `1px solid ${t.borderInput}`, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", outline: "none", fontFamily: "inherit", width: "100%" };

  const activeModels = models.filter(m => m.status !== "inactive");
  const inactiveModels = models.filter(m => m.status === "inactive");

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: t.text, marginBottom: "4px" }}>Модели</h1>
          <p style={{ color: t.textMuted, fontSize: "14px" }}>{activeModels.length} активных · {inactiveModels.length} неактивных</p>
        </div>
        {canManage && (
          <button onClick={() => { setEditing(null); setForm({ name: "", note: "", color: MODEL_COLORS[0], emoji: MODEL_EMOJIS[0], status: "active" }); setShowForm(true); }}
            style={{ display: "flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
            <Plus size={16} />Добавить модель
          </button>
        )}
      </div>

      {/* Add/Edit modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "420px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 600 }}>{editing ? "Редактировать модель" : "Новая модель"}</h3>
                <button onClick={() => { setShowForm(false); setEditing(null); }} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
              </div>

              {/* Preview */}
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: `linear-gradient(135deg, ${form.color}, ${form.color}99)`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>
                  {form.emoji}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Emoji picker */}
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "8px" }}>Иконка</label>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {MODEL_EMOJIS.map(e => (
                      <button key={e} onClick={() => setForm({ ...form, emoji: e })}
                        style={{ width: "36px", height: "36px", borderRadius: "8px", border: `1.5px solid ${form.emoji === e ? "#7c3aed" : t.border}`, background: form.emoji === e ? "rgba(124,58,237,0.15)" : t.bgCard, fontSize: "18px", cursor: "pointer" }}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color picker */}
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "8px" }}>Цвет</label>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {MODEL_COLORS.map(c => (
                      <button key={c} onClick={() => setForm({ ...form, color: c })}
                        style={{ width: "26px", height: "26px", borderRadius: "50%", background: c, border: form.color === c ? "3px solid #a78bfa" : `2px solid ${t.border}`, cursor: "pointer" }} />
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Имя модели *</label>
                  <input placeholder="Введи имя..." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} autoFocus />
                </div>

                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Заметка (необязательно)</label>
                  <textarea placeholder="Любая инфо о модели..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                    rows={2} style={{ ...inputStyle, resize: "none" }} />
                </div>

                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "8px" }}>Статус</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[{ val: "active", label: "Активна", color: "#10b981" }, { val: "inactive", label: "Неактивна", color: "#64748b" }].map(s => (
                      <button key={s.val} onClick={() => setForm({ ...form, status: s.val })}
                        style={{ flex: 1, padding: "9px", borderRadius: "10px", border: `1.5px solid ${form.status === s.val ? s.color : t.border}`, background: form.status === s.val ? `${s.color}15` : "transparent", color: form.status === s.val ? s.color : t.textMuted, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={editing ? saveEdit : addModel} disabled={!form.name.trim()}
                  style={{ background: form.name.trim() ? "linear-gradient(135deg, #7c3aed, #db2777)" : t.bgCardHover, color: form.name.trim() ? "#fff" : t.textMuted, border: "none", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 600, cursor: form.name.trim() ? "pointer" : "not-allowed" }}>
                  {editing ? "Сохранить изменения" : "Добавить модель"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm delete */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: t.bgSecondary, border: "1px solid rgba(239,68,68,0.3)", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "360px", textAlign: "center" }}>
              <AlertTriangle size={36} style={{ color: "#ef4444", marginBottom: "12px" }} />
              <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>Удалить модель?</h3>
              <p style={{ color: t.textMuted, fontSize: "14px", marginBottom: "20px", lineHeight: "1.5" }}>
                <strong style={{ color: t.text }}>{confirmDelete.name}</strong> будет удалена.<br />
                Записи трафика останутся в системе.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => deleteModel(confirmDelete)}
                  style={{ flex: 1, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: "10px", padding: "11px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                  Да, удалить
                </button>
                <button onClick={() => setConfirmDelete(null)}
                  style={{ flex: 1, background: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "10px", padding: "11px", cursor: "pointer" }}>
                  Отмена
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Models grid */}
      {models.length === 0 ? (
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "60px", textAlign: "center" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>👤</div>
          <div style={{ color: t.textMuted, marginBottom: "16px" }}>Нет моделей. Добавь первую!</div>
          {canManage && (
            <button onClick={() => setShowForm(true)}
              style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
              + Добавить модель
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Active */}
          {activeModels.length > 0 && (
            <div style={{ marginBottom: "28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
                <span style={{ color: "#10b981", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>Активные ({activeModels.length})</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
                {activeModels.map((model, i) => {
                  const stats = getModelStats(model.name);
                  const color = model.color || "#7c3aed";
                  return (
                    <motion.div key={model.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "14px", padding: "18px", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: `linear-gradient(135deg, ${color}, ${color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>
                            {model.emoji || "👤"}
                          </div>
                          <div>
                            <div style={{ color: t.text, fontWeight: 700, fontSize: "15px" }}>{model.name}</div>
                            {model.note && <div style={{ color: t.textMuted, fontSize: "12px", marginTop: "2px", maxWidth: "160px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{model.note}</div>}
                          </div>
                        </div>

                        {canManage && (
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button onClick={() => startEdit(model)}
                              style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "7px", padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                              <Edit3 size={13} />
                            </button>
                            <button onClick={() => setConfirmDelete(model)}
                              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444", borderRadius: "7px", padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Stats */}
                      <div style={{ display: "flex", gap: "8px" }}>
                        {[
                          { v: stats.posts, l: "постов" },
                          { v: stats.traffic.toLocaleString(), l: "трафик" },
                          { v: stats.today, l: "сегодня" },
                        ].map((s, i) => (
                          <div key={i} style={{ flex: 1, textAlign: "center", background: t.bgCardHover, borderRadius: "8px", padding: "8px 4px" }}>
                            <div style={{ color: t.text, fontSize: "15px", fontWeight: 700 }}>{s.v}</div>
                            <div style={{ color: t.textMuted, fontSize: "11px" }}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Inactive */}
          {inactiveModels.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#64748b" }} />
                <span style={{ color: "#64748b", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>Неактивные ({inactiveModels.length})</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
                {inactiveModels.map((model, i) => {
                  const color = model.color || "#64748b";
                  return (
                    <motion.div key={model.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                      style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "14px", padding: "18px", opacity: 0.6, position: "relative" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `${color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                            {model.emoji || "👤"}
                          </div>
                          <div>
                            <div style={{ color: t.textSecondary, fontWeight: 600, fontSize: "14px" }}>{model.name}</div>
                            {model.note && <div style={{ color: t.textMuted, fontSize: "12px" }}>{model.note}</div>}
                          </div>
                        </div>
                        {canManage && (
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button onClick={() => startEdit(model)}
                              style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "7px", padding: "5px 8px", cursor: "pointer", display: "flex" }}>
                              <Edit3 size={13} />
                            </button>
                            <button onClick={() => setConfirmDelete(model)}
                              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444", borderRadius: "7px", padding: "5px 8px", cursor: "pointer", display: "flex" }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}