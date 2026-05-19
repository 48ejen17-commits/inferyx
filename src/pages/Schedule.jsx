import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth, ROLE_COLORS, ROLE_LABELS, ROLES } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const SHIFT_COLORS = ["#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#db2777", "#ef4444", "#06b6d4"];

export default function Schedule() {
  const { db, user, profile } = useAuth();
  const { theme } = useTheme();
  const t = theme;
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [form, setForm] = useState({ userId: "", timeStart: "09:00", timeEnd: "18:00", days: [], note: "", color: SHIFT_COLORS[0] });

  const canManage = profile?.role !== ROLES.CHATTER;

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "shifts"), snap => setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "users"), snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

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

  const toggleDay = (day) => {
    setForm(f => ({ ...f, days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day] }));
  };

  const addShift = async () => {
    if (!form.userId || form.days.length === 0) return;
    const selectedUser = users.find(u => u.id === form.userId);
    await addDoc(collection(db, "shifts"), {
      userId: form.userId, userName: selectedUser?.name || "—", userRole: selectedUser?.role || "",
      timeStart: form.timeStart, timeEnd: form.timeEnd, days: form.days, note: form.note,
      color: form.color, weekOffset, createdBy: user.uid, createdAt: new Date().toISOString(),
    });
    setForm({ userId: "", timeStart: "09:00", timeEnd: "18:00", days: [], note: "", color: SHIFT_COLORS[0] });
    setShowForm(false);
  };

  const deleteShift = async (id) => await deleteDoc(doc(db, "shifts", id));
  const getShiftsForDay = (dayIndex) => shifts.filter(s => s.weekOffset === weekOffset && s.days.includes(DAYS[dayIndex]));
  const isToday = (date) => date.toLocaleDateString("ru-RU") === new Date().toLocaleDateString("ru-RU");

  const weekShifts = shifts.filter(s => s.weekOffset === weekOffset);
  const uniqueWorkers = [...new Set(weekShifts.map(s => s.userId))].length;

  const inputStyle = { background: t.bgInput, color: t.text, border: `1px solid ${t.borderInput}`, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", outline: "none", fontFamily: "inherit", width: "100%" };
  const selectStyle = { ...inputStyle };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: t.text, marginBottom: "4px" }}>График работы</h1>
          <p style={{ color: t.textMuted, fontSize: "14px" }}>{uniqueWorkers} сотрудников · {weekShifts.length} смен на этой неделе</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(true)}
            style={{ display: "flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
            <Plus size={16} />Добавить смену
          </button>
        )}
      </div>

      {/* Week selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <button onClick={() => setWeekOffset(w => w - 1)}
          style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary, borderRadius: "8px", padding: "8px", cursor: "pointer", display: "flex" }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ color: t.text, fontWeight: 600, fontSize: "15px", minWidth: "220px", textAlign: "center" }}>
          {weekDates[0].toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} — {weekDates[6].toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)}
          style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary, borderRadius: "8px", padding: "8px", cursor: "pointer", display: "flex" }}>
          <ChevronRight size={18} />
        </button>
        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(0)}
            style={{ background: "rgba(124,58,237,0.15)", border: "none", color: "#a78bfa", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", cursor: "pointer" }}>
            Сегодня
          </button>
        )}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px", marginBottom: "32px" }}>
        {weekDates.map((date, i) => {
          const dayShifts = getShiftsForDay(i);
          const today = isToday(date);
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              style={{ background: today ? "rgba(124,58,237,0.08)" : t.bgCard, border: `1px solid ${today ? "rgba(124,58,237,0.3)" : t.border}`, borderRadius: "12px", padding: "12px", minHeight: "180px" }}>
              <div style={{ marginBottom: "10px" }}>
                <div style={{ color: today ? "#a78bfa" : t.textMuted, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{DAYS[i]}</div>
                <div style={{ color: today ? t.text : t.textSecondary, fontSize: "22px", fontWeight: 700 }}>{date.getDate()}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {dayShifts.length === 0 ? (
                  <div style={{ color: t.textFaint, fontSize: "11px", textAlign: "center", paddingTop: "8px" }}>Нет смен</div>
                ) : dayShifts.map(shift => (
                  <motion.div key={shift.id} whileHover={{ scale: 1.02 }}
                    style={{ background: `${shift.color}18`, border: `1px solid ${shift.color}35`, borderRadius: "8px", padding: "7px 8px", position: "relative" }}>
                    <div style={{ color: shift.color, fontSize: "11px", fontWeight: 700, marginBottom: "2px", paddingRight: canManage ? "16px" : "0" }}>{shift.userName}</div>
                    <div style={{ color: t.textMuted, fontSize: "10px" }}>{shift.timeStart} — {shift.timeEnd}</div>
                    {shift.note && <div style={{ color: t.textMuted, fontSize: "10px", marginTop: "2px", fontStyle: "italic" }}>{shift.note}</div>}
                    {canManage && (
                      <button onClick={() => deleteShift(shift.id)}
                        style={{ position: "absolute", top: "4px", right: "4px", background: "none", border: "none", color: t.textFaint, cursor: "pointer", padding: "2px", display: "flex" }}
                        onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                        onMouseLeave={e => e.currentTarget.style.color = t.textFaint}>
                        <X size={12} />
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Team summary */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "24px" }}>
        <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "16px" }}>Команда на этой неделе</h3>
        {weekShifts.length === 0 ? (
          <div style={{ color: t.textMuted, textAlign: "center", padding: "20px" }}>Нет назначенных смен</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
            {[...new Set(weekShifts.map(s => s.userId))].map(uid => {
              const userShifts = weekShifts.filter(s => s.userId === uid);
              const u = userShifts[0];
              const roleColor = ROLE_COLORS[u.userRole] || "#64748b";
              const daysWorking = [...new Set(userShifts.flatMap(s => s.days))];
              return (
                <div key={uid} style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, borderRadius: "12px", padding: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `linear-gradient(135deg, ${roleColor}, ${roleColor}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "#fff" }}>
                      {(u.userName || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ color: t.text, fontSize: "14px", fontWeight: 600 }}>{u.userName}</div>
                      <div style={{ color: roleColor, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{ROLE_LABELS[u.userRole]}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "8px" }}>
                    {DAYS.map(day => (
                      <div key={day} style={{ width: "28px", height: "28px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", background: daysWorking.includes(day) ? `${u.color}25` : t.bgCard, border: `1px solid ${daysWorking.includes(day) ? u.color + "50" : t.border}`, color: daysWorking.includes(day) ? u.color : t.textFaint, fontSize: "10px", fontWeight: 600 }}>
                        {day[0]}
                      </div>
                    ))}
                  </div>
                  <div style={{ color: t.textMuted, fontSize: "12px" }}>{daysWorking.length} дней · {userShifts[0].timeStart} — {userShifts[0].timeEnd}</div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Add shift modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "440px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 600 }}>Новая смена</h3>
                <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Сотрудник</label>
                  <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} style={selectStyle}>
                    <option value="">Выбери сотрудника...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name} — {ROLE_LABELS[u.role]}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Начало</label>
                    <input type="time" value={form.timeStart} onChange={e => setForm({ ...form, timeStart: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Конец</label>
                    <input type="time" value={form.timeEnd} onChange={e => setForm({ ...form, timeEnd: e.target.value })} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "8px" }}>Дни недели</label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {DAYS.map(day => {
                      const selected = form.days.includes(day);
                      return (
                        <button key={day} onClick={() => toggleDay(day)}
                          style={{ flex: 1, padding: "8px 4px", borderRadius: "8px", border: `1px solid ${selected ? "#7c3aed" : t.border}`, background: selected ? "rgba(124,58,237,0.2)" : t.bgCard, color: selected ? "#a78bfa" : t.textMuted, cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "8px" }}>Цвет смены</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {SHIFT_COLORS.map(c => (
                      <button key={c} onClick={() => setForm({ ...form, color: c })}
                        style={{ width: "28px", height: "28px", borderRadius: "50%", background: c, border: form.color === c ? "3px solid " + (t === "light" ? "#000" : "#fff") : "3px solid transparent", cursor: "pointer" }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Заметка (необязательно)</label>
                  <input placeholder="Например: ночная смена, удалённо..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={inputStyle} />
                </div>
                <button onClick={addShift} disabled={!form.userId || form.days.length === 0}
                  style={{ background: form.userId && form.days.length > 0 ? "linear-gradient(135deg, #7c3aed, #db2777)" : t.bgCardHover, color: form.userId && form.days.length > 0 ? "#fff" : t.textMuted, border: "none", borderRadius: "10px", padding: "13px", fontSize: "14px", fontWeight: 600, cursor: form.userId && form.days.length > 0 ? "pointer" : "not-allowed" }}>
                  Сохранить смену
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}