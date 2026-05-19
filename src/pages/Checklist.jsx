import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { CheckSquare, Square, Plus, ChevronLeft, ChevronRight, X } from "lucide-react";

const DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export default function Checklist() {
  const { db, user, profile } = useAuth();
  const { theme } = useTheme();
  const t = theme;
  const [models, setModels] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [checks, setChecks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddModel, setShowAddModel] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [loading, setLoading] = useState(true);

  const dateKey = selectedDate.toLocaleDateString("ru-RU");

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "models"), snap => { setModels(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); }),
      onSnapshot(collection(db, "platforms"), snap => setPlatforms(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, "checklist"), where("date", "==", dateKey)), snap => setChecks(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db, dateKey]);

  const allPlatforms = ["Reddit", "Twitter/X", "TikTok", "Instagram", "Telegram", "Discord", "Facebook", "YouTube", "OnlyFans",
    ...platforms.map(p => p.name).filter(p => !["Reddit","Twitter/X","TikTok","Instagram","Telegram","Discord","Facebook","YouTube","OnlyFans"].includes(p))
  ];

  const isChecked = (modelId, platform) => checks.some(c => c.modelId === modelId && c.platform === platform && c.done);

  const toggle = async (modelId, modelName, platform) => {
    const existing = checks.find(c => c.modelId === modelId && c.platform === platform);
    if (existing) {
      await updateDoc(doc(db, "checklist", existing.id), { done: !existing.done, updatedBy: profile?.name, updatedAt: new Date().toISOString() });
    } else {
      await addDoc(collection(db, "checklist"), { modelId, modelName, platform, done: true, date: dateKey, createdBy: profile?.name, userId: user.uid, createdAt: new Date().toISOString() });
    }
  };

  const addModel = async () => {
    if (!newModelName.trim()) return;
    await addDoc(collection(db, "models"), { name: newModelName.trim(), createdAt: new Date().toISOString() });
    setNewModelName("");
    setShowAddModel(false);
  };

  const prevDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d); };
  const nextDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d); };
  const isToday = selectedDate.toLocaleDateString("ru-RU") === new Date().toLocaleDateString("ru-RU");

  const getProgress = (modelId) => {
    const done = allPlatforms.filter(p => isChecked(modelId, p)).length;
    return { done, total: allPlatforms.length, pct: Math.round((done / allPlatforms.length) * 100) };
  };

  return (
    <div>
      {/* Add model modal */}
      <AnimatePresence>
        {showAddModel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "28px", width: "360px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 600 }}>Новая модель</h3>
                <button onClick={() => setShowAddModel(false)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
              </div>
              <input placeholder="Имя модели..." value={newModelName} onChange={e => setNewModelName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addModel()} autoFocus
                style={{ background: t.bgInput, color: t.text, border: `1px solid ${t.borderInput}`, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", outline: "none", width: "100%", fontFamily: "inherit" }} />
              <button onClick={addModel}
                style={{ marginTop: "16px", width: "100%", background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                Добавить
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: t.text, marginBottom: "4px" }}>Чек-лист публикаций</h1>
          <p style={{ color: t.textMuted, fontSize: "14px" }}>Отмечай где опубликовали по каждой модели</p>
        </div>
        <button onClick={() => setShowAddModel(true)}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
          <Plus size={16} />Добавить модель
        </button>
      </div>

      {/* Date selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "12px", padding: "14px 20px", width: "fit-content" }}>
        <button onClick={prevDay} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", display: "flex" }}><ChevronLeft size={18} /></button>
        <div style={{ textAlign: "center", minWidth: "160px" }}>
          <div style={{ color: t.text, fontWeight: 600, fontSize: "15px" }}>
            {DAYS[selectedDate.getDay()]}, {selectedDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
          </div>
          {isToday && <div style={{ color: "#7c3aed", fontSize: "12px", marginTop: "2px" }}>Сегодня</div>}
        </div>
        <button onClick={nextDay} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", display: "flex" }}><ChevronRight size={18} /></button>
        {!isToday && (
          <button onClick={() => setSelectedDate(new Date())}
            style={{ background: "rgba(124,58,237,0.15)", border: "none", color: "#a78bfa", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}>
            Сегодня
          </button>
        )}
      </div>

      {/* Models */}
      {loading ? (
        <div style={{ color: t.textMuted, textAlign: "center", padding: "60px" }}>Загрузка...</div>
      ) : models.length === 0 ? (
        <div style={{ color: t.textMuted, textAlign: "center", padding: "60px" }}>
          <CheckSquare size={40} style={{ marginBottom: "12px", opacity: 0.3 }} />
          <div>Нет моделей. Добавь первую!</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {models.map((model, mi) => {
            const progress = getProgress(model.id);
            return (
              <motion.div key={model.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: mi * 0.07 }}
                style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "20px", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg, #7c3aed, #db2777)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700, color: "#fff" }}>
                      {model.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ color: t.text, fontWeight: 600, fontSize: "15px" }}>{model.name}</div>
                      <div style={{ color: t.textMuted, fontSize: "12px" }}>{progress.done} из {progress.total} платформ</div>
                    </div>
                  </div>
                  <div style={{ color: progress.pct === 100 ? "#10b981" : t.textMuted, fontSize: "14px", fontWeight: 700 }}>{progress.pct}%</div>
                </div>

                <div style={{ height: "3px", background: t.border, borderRadius: "2px", marginBottom: "16px" }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${progress.pct}%` }} transition={{ duration: 0.5 }}
                    style={{ height: "100%", borderRadius: "2px", background: progress.pct === 100 ? "#10b981" : "linear-gradient(90deg, #7c3aed, #db2777)" }} />
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {allPlatforms.map(platform => {
                    const done = isChecked(model.id, platform);
                    return (
                      <motion.button key={platform} onClick={() => toggle(model.id, model.name, platform)}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        style={{
                          display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px",
                          borderRadius: "8px", border: `1px solid ${done ? "#10b981" : t.border}`,
                          background: done ? "rgba(16,185,129,0.12)" : t.bgCardHover,
                          color: done ? "#10b981" : t.textMuted, cursor: "pointer", fontSize: "13px", fontWeight: 500,
                        }}>
                        {done ? <CheckSquare size={14} /> : <Square size={14} />}
                        {platform}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}