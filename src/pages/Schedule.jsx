import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth, ROLE_COLORS, ROLE_LABELS, ROLES } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Plus, X, ChevronLeft, ChevronRight, Users } from "lucide-react";

const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const SHIFT_COLORS = ["#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#db2877", "#ef4444", "#06b6d4"];

export default function Schedule() {
  const { db, user, profile } = useAuth();
  const { theme, mode } = useTheme();
  const t = theme;
  const isDark = mode === "dark";

  const [shifts,   setShifts]   = useState([]);
  const [users,    setUsers]    = useState([]);
  const [teams,    setTeams]    = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [form, setForm] = useState({
    userId: "", timeStart: "09:00", timeEnd: "18:00",
    days: [], note: "", color: SHIFT_COLORS[0],
  });

  const isChatter   = profile?.role === ROLES.CHATTER;
  const isTeamLead  = profile?.role === ROLES.TEAM_LEAD;
  const canManage   = !isChatter;

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "shifts"), s => setShifts(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "users"),  s => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "teams"),  s => setTeams(s.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  // My teams (for chatter/team_lead)
  const myTeams = ["owner","admin","project_manager"].includes(profile?.role)
    ? teams
    : teams.filter(team => (team.memberIds || []).includes(profile?.uid));

  // Members visible to current user
  const visibleMemberIds = (isChatter || isTeamLead)
    ? new Set(myTeams.flatMap(t => t.memberIds || []))
    : null; // null = see all

  const getTeamForUser = (uid) => {
    const found = myTeams.find(t => (t.memberIds || []).includes(uid));
    return found || null;
  };

  const getWeekDates = () => {
    const today = new Date();
    const day   = today.getDay();
    const mon   = new Date(today);
    mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon); d.setDate(mon.getDate() + i); return d;
    });
  };
  const weekDates = getWeekDates();

  const toggleDay = (day) =>
    setForm(f => ({ ...f, days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day] }));

  const addShift = async () => {
    if (!form.userId || form.days.length === 0) return;
    const sel = users.find(u => u.id === form.userId);
    const team = getTeamForUser(form.userId);
    await addDoc(collection(db, "shifts"), {
      userId: form.userId, userName: sel?.name || "—", userRole: sel?.role || "",
      teamId: team?.id || "", teamName: team?.name || "",
      timeStart: form.timeStart, timeEnd: form.timeEnd,
      days: form.days, note: form.note, color: form.color,
      weekOffset, createdBy: user.uid, createdAt: new Date().toISOString(),
    });
    setForm({ userId: "", timeStart: "09:00", timeEnd: "18:00", days: [], note: "", color: SHIFT_COLORS[0] });
    setShowForm(false);
  };

  const deleteShift = async (id) => await deleteDoc(doc(db, "shifts", id));

  const getShiftsForDay = (dayIndex) => {
    let dayShifts = shifts.filter(s => s.weekOffset === weekOffset && s.days.includes(DAYS[dayIndex]));
    // Filter by visibility
    if (visibleMemberIds) dayShifts = dayShifts.filter(s => visibleMemberIds.has(s.userId));
    // Filter by selected team tab
    if (selectedTeam !== "all") dayShifts = dayShifts.filter(s => s.teamId === selectedTeam);
    return dayShifts;
  };

  const isToday = (date) => date.toLocaleDateString("ru-RU") === new Date().toLocaleDateString("ru-RU");

  const weekShifts = shifts.filter(s => {
    if (s.weekOffset !== weekOffset) return false;
    if (visibleMemberIds && !visibleMemberIds.has(s.userId)) return false;
    if (selectedTeam !== "all" && s.teamId !== selectedTeam) return false;
    return true;
  });

  // Users available to assign shifts to
  const assignableUsers = visibleMemberIds
    ? users.filter(u => visibleMemberIds.has(u.uid || u.id))
    : users;

  const inputStyle  = { background: t.bgInput, color: t.text, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", outline: "none", fontFamily: "inherit", width: "100%" };
  const selectStyle = { ...inputStyle, colorScheme: isDark ? "dark" : "light" };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: t.text, marginBottom: "4px" }}>График работы</h1>
          <p style={{ color: t.textMuted, fontSize: "14px" }}>
            {[...new Set(weekShifts.map(s => s.userId))].length} сотрудников · {weekShifts.length} смен
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(true)}
            style={{ display: "flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg,#7c3aed,#db2877)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
            <Plus size={16} />Добавить смену
          </button>
        )}
      </div>

      {/* Team filter tabs — visible to all */}
      {myTeams.length > 1 && (
        <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
          <button onClick={() => setSelectedTeam("all")}
            style={{ padding: "7px 14px", borderRadius: "20px", border: `1px solid ${selectedTeam === "all" ? "#7c3aed" : t.border}`, background: selectedTeam === "all" ? "rgba(124,58,237,0.15)" : t.bgCard, color: selectedTeam === "all" ? "#a78bfa" : t.textMuted, fontSize: "13px", fontWeight: selectedTeam === "all" ? 700 : 400, cursor: "pointer" }}>
            Все команды
          </button>
          {myTeams.map(team => (
            <button key={team.id} onClick={() => setSelectedTeam(team.id)}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "20px", border: `1px solid ${selectedTeam === team.id ? team.color || "#7c3aed" : t.border}`, background: selectedTeam === team.id ? `${team.color || "#7c3aed"}18` : t.bgCard, color: selectedTeam === team.id ? team.color || "#a78bfa" : t.textMuted, fontSize: "13px", fontWeight: selectedTeam === team.id ? 700 : 400, cursor: "pointer" }}>
              <span>{team.emoji || "👥"}</span>
              {team.name}
            </button>
          ))}
        </div>
      )}

      {/* Week selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button onClick={() => setWeekOffset(w => w - 1)}
          style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "8px", padding: "8px", cursor: "pointer", display: "flex" }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ color: t.text, fontWeight: 600, fontSize: "15px", minWidth: "220px", textAlign: "center" }}>
          {weekDates[0].toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} — {weekDates[6].toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)}
          style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "8px", padding: "8px", cursor: "pointer", display: "flex" }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px", marginBottom: "28px" }}>
        {weekDates.map((date, i) => {
          const dayShifts = getShiftsForDay(i);
          const today = isToday(date);
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              style={{ background: today ? "rgba(124,58,237,0.08)" : t.bgCard, border: `1px solid ${today ? "rgba(124,58,237,0.3)" : t.border}`, borderRadius: "12px", padding: "10px", minHeight: "160px" }}>
              <div style={{ marginBottom: "8px" }}>
                <div style={{ color: today ? "#a78bfa" : t.textMuted, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{DAYS[i]}</div>
                <div style={{ color: today ? t.text : t.textSecondary, fontSize: "20px", fontWeight: 700 }}>{date.getDate()}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {dayShifts.length === 0 ? (
                  <div style={{ color: t.textFaint, fontSize: "11px", textAlign: "center", paddingTop: "6px" }}>—</div>
                ) : dayShifts.map(shift => {
                  const team = teams.find(tm => tm.id === shift.teamId);
                  return (
                    <motion.div key={shift.id} whileHover={{ scale: 1.02 }}
                      style={{ background: `${shift.color}18`, border: `1px solid ${shift.color}35`, borderRadius: "8px", padding: "6px 8px", position: "relative" }}>
                      {/* Team name badge — shown when multiple teams or chatter */}
                      {(isChatter || myTeams.length > 1) && team && (
                        <div style={{ display: "flex", alignItems: "center", gap: "3px", marginBottom: "2px" }}>
                          <span style={{ fontSize: "9px" }}>{team.emoji || "👥"}</span>
                          <span style={{ color: team.color || "#a78bfa", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px" }}>{team.name}</span>
                        </div>
                      )}
                      <div style={{ color: shift.color, fontSize: "11px", fontWeight: 700, marginBottom: "2px", paddingRight: canManage ? "14px" : "0" }}>
                        {shift.userName}
                      </div>
                      <div style={{ color: t.textMuted, fontSize: "10px" }}>{shift.timeStart} — {shift.timeEnd}</div>
                      {shift.note && <div style={{ color: t.textFaint, fontSize: "10px", marginTop: "1px", fontStyle: "italic" }}>{shift.note}</div>}
                      {canManage && (
                        <button onClick={() => deleteShift(shift.id)}
                          style={{ position: "absolute", top: "3px", right: "3px", background: "none", border: "none", color: t.textFaint, cursor: "pointer", padding: "2px" }}
                          onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                          onMouseLeave={e => e.currentTarget.style.color = t.textFaint}>
                          <X size={11} />
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Team summary */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
        <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "16px" }}>
          <Users size={15} style={{ display: "inline", marginRight: "7px", verticalAlign: "middle" }} />
          Команда на этой неделе
        </h3>
        {weekShifts.length === 0 ? (
          <div style={{ color: t.textMuted, textAlign: "center", padding: "20px" }}>Нет назначенных смен</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
            {[...new Set(weekShifts.map(s => s.userId))].map(uid => {
              const userShifts = weekShifts.filter(s => s.userId === uid);
              const s = userShifts[0];
              const rc = ROLE_COLORS[s.userRole] || "#64748b";
              const daysWorking = [...new Set(userShifts.flatMap(s => s.days))];
              const userObj = users.find(u => u.id === uid || u.uid === uid);
              const team = getTeamForUser(uid);
              return (
                <div key={uid} style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, borderRadius: "12px", padding: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `linear-gradient(135deg,${rc},${rc}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: userObj?.avatarEmoji ? "16px" : "14px", fontWeight: 700, color: "#fff" }}>
                      {userObj?.avatarEmoji || (s.userName || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ color: t.text, fontSize: "14px", fontWeight: 600 }}>{s.userName}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ color: rc, fontSize: "10px", textTransform: "uppercase" }}>{ROLE_LABELS[s.userRole] || s.userRole}</span>
                        {team && <span style={{ color: team.color || "#a78bfa", fontSize: "10px" }}>· {team.emoji || "👥"} {team.name}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "3px", marginBottom: "8px" }}>
                    {DAYS.map(day => (
                      <div key={day} style={{ width: "26px", height: "26px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", background: daysWorking.includes(day) ? `${s.color}22` : t.bgCard, border: `1px solid ${daysWorking.includes(day) ? s.color + "50" : t.border}`, color: daysWorking.includes(day) ? s.color : t.textFaint, fontSize: "9px", fontWeight: 600 }}>
                        {day[0]}
                      </div>
                    ))}
                  </div>
                  <div style={{ color: t.textMuted, fontSize: "11px" }}>{daysWorking.length} дней · {userShifts[0].timeStart} — {userShifts[0].timeEnd}</div>
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
            onClick={() => setShowForm(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: t.bgSecondary || t.bgCard, border: `1px solid ${t.border}`, borderRadius: "18px", padding: "28px", width: "100%", maxWidth: "440px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
                <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 700 }}>Новая смена</h3>
                <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase" }}>Сотрудник</label>
                  <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} style={selectStyle}>
                    <option value="">Выбери сотрудника...</option>
                    {assignableUsers.map(u => {
                      const team = getTeamForUser(u.uid || u.id);
                      return <option key={u.id} value={u.id}>{u.name}{team ? ` (${team.name})` : ""} — {ROLE_LABELS[u.role] || u.role}</option>;
                    })}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase" }}>Начало</label>
                    <input type="time" value={form.timeStart} onChange={e => setForm({ ...form, timeStart: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase" }}>Конец</label>
                    <input type="time" value={form.timeEnd} onChange={e => setForm({ ...form, timeEnd: e.target.value })} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "8px", textTransform: "uppercase" }}>Дни недели</label>
                  <div style={{ display: "flex", gap: "5px" }}>
                    {DAYS.map(day => {
                      const sel = form.days.includes(day);
                      return (
                        <button key={day} onClick={() => toggleDay(day)}
                          style={{ flex: 1, padding: "8px 2px", borderRadius: "8px", border: `1px solid ${sel ? "#7c3aed" : t.border}`, background: sel ? "rgba(124,58,237,0.2)" : t.bgCard, color: sel ? "#a78bfa" : t.textMuted, cursor: "pointer", fontSize: "11px", fontWeight: 600 }}>
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "8px", textTransform: "uppercase" }}>Цвет</label>
                  <div style={{ display: "flex", gap: "7px" }}>
                    {SHIFT_COLORS.map(c => (
                      <button key={c} onClick={() => setForm({ ...form, color: c })}
                        style={{ width: "26px", height: "26px", borderRadius: "50%", background: c, border: form.color === c ? "3px solid #fff" : "2px solid transparent", cursor: "pointer" }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase" }}>Заметка</label>
                  <input placeholder="Ночная смена, удалённо..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={inputStyle} />
                </div>
                <button onClick={addShift} disabled={!form.userId || form.days.length === 0}
                  style={{ background: form.userId && form.days.length > 0 ? "linear-gradient(135deg,#7c3aed,#db2877)" : "rgba(124,58,237,0.3)", color: "#fff", border: "none", borderRadius: "12px", padding: "13px", fontSize: "14px", fontWeight: 700, cursor: form.userId && form.days.length > 0 ? "pointer" : "not-allowed" }}>
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
