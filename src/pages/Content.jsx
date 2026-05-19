import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection, onSnapshot, addDoc, deleteDoc, doc, setDoc, query, where
} from "firebase/firestore";
import { useAuth, ROLES } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Plus, X, ChevronLeft, ChevronRight, Clock, User } from "lucide-react";

const STATUSES_DARK = [
  { val: "none",    bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)" },
  { val: "posted",  bg: "rgba(16,185,129,0.15)",  border: "#10b981" },
  { val: "problem", bg: "rgba(245,158,11,0.15)",  border: "#f59e0b" },
  { val: "banned",  bg: "rgba(239,68,68,0.12)",   border: "#ef4444" },
];

const STATUSES_LIGHT = [
  { val: "none",    bg: "rgba(0,0,0,0.03)",       border: "rgba(0,0,0,0.1)" },
  { val: "posted",  bg: "rgba(16,185,129,0.12)",  border: "#10b981" },
  { val: "problem", bg: "rgba(245,158,11,0.12)",  border: "#f59e0b" },
  { val: "banned",  bg: "rgba(239,68,68,0.1)",    border: "#ef4444" },
];

const getStatus = (val, isDark) => {
  const list = isDark ? STATUSES_DARK : STATUSES_LIGHT;
  return list.find(s => s.val === val) || list[0];
};

const makeKey = (modelId, subId, date) =>
  `${modelId}__${subId}__${date}`.replace(/[^a-zA-Z0-9_\-]/g, "_");

export default function Content() {
  const { db, user, profile } = useAuth();
  const { theme, mode } = useTheme();
  const t = theme;
  const isDark = mode === "dark";

  const [models, setModels] = useState([]);
  const [subreddits, setSubreddits] = useState([]); // все сабреддиты всех моделей
  const [statuses, setStatuses] = useState({});
  const [activeModel, setActiveModel] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAddSub, setShowAddSub] = useState(false);
  const [problemModal, setProblemModal] = useState(null);
  const [problemText, setProblemText] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [newSub, setNewSub] = useState({ name: "", members: "", nsfw: true });
  const canManage = profile?.role !== ROLES.CHATTER;

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "models"), snap => {
        const ms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const active = ms.filter(m => m.status !== "inactive");
        setModels(active);
        if (!activeModel && active.length > 0) setActiveModel(active[0]);
      }),
      onSnapshot(collection(db, "model_subreddits"), snap =>
        setSubreddits(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "content_grid"), snap => {
        const map = {};
        snap.docs.forEach(d => { map[d.id] = d.data(); });
        setStatuses(map);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  // Сабреддиты только для активной модели
  const modelSubs = subreddits.filter(s => s.modelId === activeModel?.id);

  const getWeekDates = () => {
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  };

  const weekDates = getWeekDates();
  const DAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const isToday = (d) => d.toLocaleDateString("ru-RU") === new Date().toLocaleDateString("ru-RU");

  const getCell = (subId, date) => {
    const key = makeKey(activeModel?.id || "", subId, date.toLocaleDateString("ru-RU"));
    return { ...statuses[key] || { status: "none" }, key };
  };

  const saveCell = async (key, modelId, subId, dateStr, status, note = "") => {
    const now = new Date();
    await setDoc(doc(db, "content_grid", key), {
      modelId, subId, date: dateStr, status, note,
      updatedBy: profile?.name || "—",
      updatedAt: now.toISOString(),
      updatedTime: now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    });
  };

  const handleCellClick = (subId, date) => {
    if (!activeModel || !canManage) return;
    const dateStr = date.toLocaleDateString("ru-RU");
    const key = makeKey(activeModel.id, subId, dateStr);
    const cur = statuses[key]?.status || "none";
    if (cur === "posted") { setConfirmCancel({ key, subId, dateStr, modelId: activeModel.id }); return; }
    if (cur === "none" || cur === "banned") { saveCell(key, activeModel.id, subId, dateStr, "posted"); return; }
    if (cur === "problem") { saveCell(key, activeModel.id, subId, dateStr, "banned"); return; }
  };

  const handleRightClick = (e, subId, date) => {
    e.preventDefault();
    if (!activeModel || !canManage) return;
    const dateStr = date.toLocaleDateString("ru-RU");
    const key = makeKey(activeModel.id, subId, dateStr);
    setProblemModal({ key, subId, dateStr, modelId: activeModel.id });
    setProblemText(statuses[key]?.note || "");
  };

  const saveProblem = async () => {
    if (!problemModal) return;
    await saveCell(problemModal.key, problemModal.modelId, problemModal.subId, problemModal.dateStr, "problem", problemText);
    setProblemModal(null); setProblemText("");
  };

  const confirmCancelPost = async () => {
    if (!confirmCancel) return;
    await saveCell(confirmCancel.key, confirmCancel.modelId, confirmCancel.subId, confirmCancel.dateStr, "none");
    setConfirmCancel(null);
  };

  const addSubreddit = async () => {
    if (!newSub.name.trim() || !activeModel) return;
    const name = newSub.name.trim().replace(/^r\//, "");
    await addDoc(collection(db, "model_subreddits"), {
      name, displayName: `r/${name}`,
      members: newSub.members, nsfw: newSub.nsfw,
      modelId: activeModel.id,
      modelName: activeModel.name,
      createdAt: new Date().toISOString(),
    });
    setNewSub({ name: "", members: "", nsfw: true });
    setShowAddSub(false);
  };

  const deleteSub = async (id) => await deleteDoc(doc(db, "model_subreddits", id));

  const totalPosted = modelSubs.reduce((sum, sub) =>
    sum + weekDates.filter(d => getCell(sub.id, d).status === "posted").length, 0);
  const totalPossible = modelSubs.length * 7;
  const pct = totalPossible > 0 ? Math.round((totalPosted / totalPossible) * 100) : 0;

  const inputStyle = { background: t.bgInput, color: t.text, border: `1px solid ${t.borderInput}`, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", outline: "none", fontFamily: "inherit" };

  return (
    <div style={{ position: "relative" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: t.text, marginBottom: "4px" }}>Контент Планнер</h1>
          <p style={{ color: t.textMuted, fontSize: "14px" }}>{totalPosted}/{totalPossible} опубликовано · {pct}% выполнено</p>
        </div>
        {canManage && activeModel && (
          <button onClick={() => setShowAddSub(true)}
            style={{ display: "flex", alignItems: "center", gap: "8px", background: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary, borderRadius: "10px", padding: "10px 16px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
            <Plus size={15} />r/сабреддит для {activeModel.name}
          </button>
        )}
      </div>

      {/* Model switcher */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {models.map(m => (
          <motion.button key={m.id} onClick={() => setActiveModel(m)}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            style={{
              padding: "8px 20px", borderRadius: "20px",
              border: `1px solid ${activeModel?.id === m.id ? (m.color || "#7c3aed") : t.border}`,
              background: activeModel?.id === m.id ? `${m.color || "#7c3aed"}20` : t.bgCard,
              color: activeModel?.id === m.id ? (m.color || "#a78bfa") : t.textMuted,
              fontSize: "14px", fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: "6px"
            }}>
            {m.emoji && <span>{m.emoji}</span>}
            {m.name}
            <span style={{ background: activeModel?.id === m.id ? `${m.color || "#7c3aed"}30` : t.bgCardHover, color: activeModel?.id === m.id ? (m.color || "#a78bfa") : t.textFaint, fontSize: "11px", fontWeight: 700, padding: "1px 6px", borderRadius: "10px" }}>
              {subreddits.filter(s => s.modelId === m.id).length}
            </span>
          </motion.button>
        ))}
        {models.length === 0 && <div style={{ color: t.textFaint, fontSize: "13px" }}>Добавь модели в разделе Модели</div>}
      </div>

      {/* Week nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary, borderRadius: "8px", padding: "7px", cursor: "pointer", display: "flex" }}><ChevronLeft size={16} /></button>
          <span style={{ color: t.text, fontWeight: 600, fontSize: "14px" }}>
            {weekDates[0].toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} — {weekDates[6].toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary, borderRadius: "8px", padding: "7px", cursor: "pointer", display: "flex" }}><ChevronRight size={16} /></button>
          {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} style={{ background: "rgba(124,58,237,0.15)", border: "none", color: "#a78bfa", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", cursor: "pointer" }}>Сегодня</button>}
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {[{ emoji: "✅", label: "Клик — опубликован" }, { emoji: "⚠️", label: "Правый клик — проблема" }, { emoji: "🚫", label: "Удалён" }].map(l => (
            <div key={l.emoji} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ fontSize: "13px" }}>{l.emoji}</span>
              <span style={{ color: t.textFaint, fontSize: "12px" }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      {!activeModel ? (
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "60px", textAlign: "center", color: t.textFaint }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>📋</div>
          <div style={{ color: t.textMuted }}>Выбери модель выше</div>
        </div>
      ) : modelSubs.length === 0 ? (
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "60px", textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>📋</div>
          <div style={{ color: t.textMuted, marginBottom: "16px" }}>Нет сабреддитов для <strong>{activeModel.name}</strong></div>
          {canManage && (
            <button onClick={() => setShowAddSub(true)}
              style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
              + Добавить r/сабреддит
            </button>
          )}
        </div>
      ) : (
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", overflow: "visible" }}>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "180px repeat(7, 1fr)", borderBottom: `1px solid ${t.border}`, background: t.bgCardHover, borderRadius: "16px 16px 0 0" }}>
            <div style={{ padding: "12px 16px", color: t.textFaint, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Сабреддит</div>
            {weekDates.map((d, i) => (
              <div key={i} style={{ padding: "10px 8px", textAlign: "center", borderLeft: `1px solid ${t.border}` }}>
                <div style={{ color: isToday(d) ? "#a78bfa" : t.textMuted, fontSize: "11px", fontWeight: 700 }}>{DAYS_SHORT[i]}</div>
                <div style={{ color: isToday(d) ? t.text : t.textSecondary, fontSize: "17px", fontWeight: 700 }}>{d.getDate()}</div>
              </div>
            ))}
          </div>

          {modelSubs.map((sub, si) => (
            <div key={sub.id} style={{ display: "grid", gridTemplateColumns: "180px repeat(7, 1fr)", borderBottom: si < modelSubs.length - 1 ? `1px solid ${t.border}` : "none" }}>
              <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ color: "#ff4500", fontSize: "13px", fontWeight: 700 }}>{sub.displayName}</div>
                  {sub.members && <div style={{ color: t.textFaint, fontSize: "10px" }}>{sub.members}</div>}
                </div>
                {canManage && (
                  <button onClick={() => deleteSub(sub.id)} style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", padding: "2px" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                    onMouseLeave={e => e.currentTarget.style.color = t.textFaint}>
                    <X size={12} />
                  </button>
                )}
              </div>

              {weekDates.map((date, di) => {
                const cell = getCell(sub.id, date);
                const st = getStatus(cell.status, isDark);
                const today = isToday(date);
                const isHovered = hoveredCell === cell.key;

                return (
                  <div key={di} style={{ borderLeft: `1px solid ${t.border}`, position: "relative" }}>
                    <motion.div
                      onClick={() => handleCellClick(sub.id, date)}
                      onContextMenu={(e) => handleRightClick(e, sub.id, date)}
                      onMouseEnter={() => setHoveredCell(cell.key)}
                      onMouseLeave={() => setHoveredCell(null)}
                      whileHover={canManage ? { scale: 0.93 } : {}}
                      whileTap={canManage ? { scale: 0.85 } : {}}
                      style={{ padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: canManage ? "pointer" : "default", background: today ? "rgba(124,58,237,0.04)" : "transparent", minHeight: "52px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: st.bg, border: `1.5px solid ${st.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
                        {cell.status === "posted" && "✅"}
                        {cell.status === "problem" && "⚠️"}
                        {cell.status === "banned" && "🚫"}
                        {cell.status === "none" && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: t.textFaint }} />}
                      </div>
                    </motion.div>

                    {/* Tooltip */}
                    <AnimatePresence>
                      {isHovered && cell.status === "posted" && cell.updatedBy && (
                        <motion.div initial={{ opacity: 0, y: 4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.95 }} transition={{ duration: 0.15 }}
                          style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: t.bgSecondary, border: "1px solid rgba(16,185,129,0.3)", borderRadius: "10px", padding: "10px 12px", zIndex: 100, pointerEvents: "none", minWidth: "150px", whiteSpace: "nowrap", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
                          <div style={{ position: "absolute", bottom: "-5px", left: "50%", width: "10px", height: "10px", background: t.bgSecondary, border: "1px solid rgba(16,185,129,0.3)", borderTop: "none", borderLeft: "none", transform: "translateX(-50%) rotate(45deg)" }} />
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
                            <span style={{ color: "#10b981", fontSize: "12px", fontWeight: 700 }}>Опубликовано</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                            <User size={11} style={{ color: t.textMuted }} />
                            <span style={{ color: t.text, fontSize: "12px", fontWeight: 600 }}>{cell.updatedBy}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Clock size={11} style={{ color: t.textMuted }} />
                            <span style={{ color: t.textMuted, fontSize: "12px" }}>{cell.updatedTime || "—"}</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Totals */}
          <div style={{ display: "grid", gridTemplateColumns: "180px repeat(7, 1fr)", borderTop: `1px solid ${t.border}`, background: t.bgCardHover, borderRadius: "0 0 16px 16px" }}>
            <div style={{ padding: "10px 16px", color: t.textFaint, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center" }}>Итого</div>
            {weekDates.map((date, di) => {
              const dayPosted = modelSubs.filter(s => getCell(s.id, date).status === "posted").length;
              const dayProblems = modelSubs.filter(s => getCell(s.id, date).status === "problem").length;
              const total = modelSubs.length;
              const pctDay = total > 0 ? Math.round((dayPosted / total) * 100) : 0;
              return (
                <div key={di} style={{ borderLeft: `1px solid ${t.border}`, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ color: dayPosted === total && total > 0 ? "#10b981" : t.text, fontSize: "14px", fontWeight: 700 }}>{dayPosted}/{total}</div>
                  <div style={{ height: "3px", background: t.border, borderRadius: "2px", margin: "4px 4px 0" }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pctDay}%` }} transition={{ duration: 0.5 }}
                      style={{ height: "100%", borderRadius: "2px", background: dayPosted === total && total > 0 ? "#10b981" : "linear-gradient(90deg, #7c3aed, #db2777)" }} />
                  </div>
                  {dayProblems > 0 && <div style={{ color: "#f59e0b", fontSize: "10px", marginTop: "3px" }}>⚠️ {dayProblems}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active problems */}
      {modelSubs.some(sub => weekDates.some(d => getCell(sub.id, d).status === "problem" && getCell(sub.id, d).note)) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: "16px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "12px", padding: "16px" }}>
          <div style={{ color: "#f59e0b", fontSize: "13px", fontWeight: 700, marginBottom: "10px" }}>⚠️ Активные проблемы</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {modelSubs.flatMap(sub => weekDates.map(d => {
              const cell = getCell(sub.id, d);
              if (cell.status !== "problem" || !cell.note) return null;
              return (
                <div key={cell.key} style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "8px 10px", background: "rgba(245,158,11,0.06)", borderRadius: "8px" }}>
                  <span style={{ color: "#ff4500", fontSize: "12px", fontWeight: 700, flexShrink: 0 }}>{sub.displayName}</span>
                  <span style={{ color: t.textMuted, fontSize: "12px", flexShrink: 0 }}>{d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
                  <span style={{ color: "#f59e0b", fontSize: "12px" }}>{cell.note}</span>
                  {cell.updatedBy && <span style={{ color: t.textFaint, fontSize: "11px", marginLeft: "auto", flexShrink: 0 }}>— {cell.updatedBy}</span>}
                </div>
              );
            }).filter(Boolean))}
          </div>
        </motion.div>
      )}

      {/* Confirm cancel */}
      <AnimatePresence>
        {confirmCancel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: t.bgSecondary, border: "1px solid rgba(239,68,68,0.3)", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "380px" }}>
              <div style={{ fontSize: "28px", marginBottom: "12px", textAlign: "center" }}>🔴</div>
              <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 600, marginBottom: "8px", textAlign: "center" }}>Отменить публикацию?</h3>
              <p style={{ color: t.textMuted, fontSize: "13px", textAlign: "center", marginBottom: "20px", lineHeight: "1.5" }}>
                {confirmCancel.dateStr}<br />Статус вернётся к «не отмечено»
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={confirmCancelPost} style={{ flex: 1, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: "10px", padding: "11px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Да, отменить</button>
                <button onClick={() => setConfirmCancel(null)} style={{ flex: 1, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", borderRadius: "10px", padding: "11px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Нет, оставить ✅</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Problem modal */}
      <AnimatePresence>
        {problemModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: t.bgSecondary, border: "1px solid rgba(245,158,11,0.3)", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "400px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 600 }}>⚠️ Описать проблему</h3>
                <button onClick={() => setProblemModal(null)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
              </div>
              <textarea placeholder="Например: удалён модератором, бан аккаунта..." value={problemText} onChange={e => setProblemText(e.target.value)}
                rows={3} autoFocus style={{ ...inputStyle, width: "100%", marginBottom: "14px", resize: "none" }} />
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={saveProblem} style={{ flex: 1, background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.4)", color: "#f59e0b", borderRadius: "10px", padding: "11px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Сохранить</button>
                <button onClick={() => setProblemModal(null)} style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "10px", padding: "11px 16px", cursor: "pointer" }}>Отмена</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add subreddit modal */}
      <AnimatePresence>
        {showAddSub && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "380px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 600 }}>Добавить сабреддит</h3>
                  <div style={{ color: t.textMuted, fontSize: "12px", marginTop: "3px" }}>для модели <strong style={{ color: activeModel?.color || "#7c3aed" }}>{activeModel?.name}</strong></div>
                </div>
                <button onClick={() => setShowAddSub(false)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Название (без r/)</label>
                  <input placeholder="OnlyFansPromos" value={newSub.name} onChange={e => setNewSub({ ...newSub, name: e.target.value })} onKeyDown={e => e.key === "Enter" && addSubreddit()} autoFocus style={{ ...inputStyle, width: "100%" }} />
                </div>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Участников (необязательно)</label>
                  <input placeholder="500k" value={newSub.members} onChange={e => setNewSub({ ...newSub, members: e.target.value })} style={{ ...inputStyle, width: "100%" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button onClick={() => setNewSub({ ...newSub, nsfw: !newSub.nsfw })}
                    style={{ width: "40px", height: "22px", borderRadius: "11px", background: newSub.nsfw ? "#7c3aed" : t.border, border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                    <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#fff", position: "absolute", top: "3px", left: newSub.nsfw ? "21px" : "3px", transition: "left 0.2s" }} />
                  </button>
                  <span style={{ color: t.textSecondary, fontSize: "13px" }}>NSFW</span>
                </div>
                <button onClick={addSubreddit} style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                  Добавить r/{newSub.name || "..."}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}