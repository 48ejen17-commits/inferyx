import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, orderBy } from "firebase/firestore";
import { useAuth, ROLE_COLORS, ROLE_LABELS_DISPLAY } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Clock, Users, Play, Square, AlertTriangle, CheckCircle } from "lucide-react";

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м ${sc}с`;
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ── Shift Button for Chatters ──────────────────────────────────────────────────
function ShiftButton({ userId, userName, db, t }) {
  const [activeShift, setActiveShift] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false); // "start"|"stop"
  const timerRef = useRef(null);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, "shifts"), where("userId", "==", userId), where("status", "==", "active")),
      snap => {
        const shift = snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null;
        setActiveShift(shift);
      }
    );
  }, [db, userId]);

  useEffect(() => {
    if (activeShift) {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - new Date(activeShift.startTime).getTime());
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(timerRef.current);
  }, [activeShift]);

  const startShift = async () => {
    await addDoc(collection(db, "shifts"), {
      userId, userName,
      startTime: new Date().toISOString(),
      endTime: null, endedBy: null, endedByName: null,
      status: "active",
      date: new Date().toLocaleDateString("ru-RU"),
    });
    setShowConfirm(null);
  };

  const stopShift = async () => {
    if (!activeShift) return;
    await updateDoc(doc(db, "shifts", activeShift.id), {
      endTime: new Date().toISOString(),
      endedBy: userId, endedByName: userName,
      status: "ended",
    });
    setShowConfirm(null);
  };

  return (
    <div>
      {activeShift ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Active shift indicator */}
          <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "16px", padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981", animation: "pulse 1.5s infinite" }} />
              <span style={{ color: "#10b981", fontSize: "14px", fontWeight: 700 }}>Смена идёт</span>
            </div>
            <div style={{ color: "#34d399", fontSize: "32px", fontWeight: 900, fontFamily: "monospace", marginBottom: "4px" }}>
              {formatDuration(elapsed)}
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>
              Начало: {formatTime(activeShift.startTime)}
            </div>
          </div>
          <button onClick={() => setShowConfirm("stop")}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: "12px", padding: "13px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>
            <Square size={16} />Завершить смену
          </button>
        </div>
      ) : (
        <button onClick={() => setShowConfirm("start")}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: "12px", padding: "15px", fontSize: "16px", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px rgba(16,185,129,0.35)" }}>
          <Play size={18} />Выйти на смену
        </button>
      )}

      {/* Confirm modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={() => setShowConfirm(null)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
            <motion.div initial={{ scale:0.9, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.9, opacity:0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: t.bgSecondary || t.bgCard, border: `1px solid ${t.border}`, borderRadius:"20px", padding:"28px", maxWidth:"360px", width:"100%", textAlign:"center" }}>
              <div style={{ fontSize:"40px", marginBottom:"14px" }}>
                {showConfirm === "start" ? "⏱️" : "🛑"}
              </div>
              <h3 style={{ color:t.text, fontSize:"18px", fontWeight:700, marginBottom:"10px" }}>
                {showConfirm === "start" ? "Выйти на смену?" : "Завершить смену?"}
              </h3>
              <p style={{ color:t.textMuted, fontSize:"14px", marginBottom:"22px", lineHeight:"1.6" }}>
                {showConfirm === "start"
                  ? "Начнётся отсчёт времени смены. Тим-лид увидит что ты в работе."
                  : "Смена будет завершена. Время будет зафиксировано."}
              </p>
              <div style={{ display:"flex", gap:"10px" }}>
                <button onClick={showConfirm === "start" ? startShift : stopShift}
                  style={{ flex:1, background: showConfirm === "start" ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(239,68,68,0.15)", border: showConfirm === "start" ? "none" : "1px solid rgba(239,68,68,0.3)", color: showConfirm === "start" ? "#fff" : "#ef4444", borderRadius:"12px", padding:"12px", fontSize:"15px", fontWeight:700, cursor:"pointer" }}>
                  {showConfirm === "start" ? "✅ Да, выхожу" : "🛑 Завершить"}
                </button>
                <button onClick={() => setShowConfirm(null)}
                  style={{ flex:1, background:t.bgCardHover, border:`1px solid ${t.border}`, color:t.textMuted, borderRadius:"12px", padding:"12px", cursor:"pointer" }}>
                  Отмена
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

// ── Main TeamPanel ─────────────────────────────────────────────────────────────
export default function TeamPanel() {
  const { db, profile } = useAuth();
  const { theme } = useTheme();
  const t = theme;

  const [teams,       setTeams]       = useState([]);
  const [allUsers,    setAllUsers]    = useState([]);
  const [shifts,      setShifts]      = useState([]);
  const [activeShifts, setActiveShifts] = useState([]);
  const [elapsed,     setElapsed]     = useState({});

  const isChatter    = profile?.role === "chatter";
  const isTeamLead   = profile?.role === "team_lead";
  const isAdminPlus  = ["owner","admin","project_manager"].includes(profile?.role);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "teams"),  s => setTeams(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "users"),  s => setAllUsers(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, "shifts"), orderBy("startTime", "desc")),
        s => {
          const all = s.docs.map(d => ({ id: d.id, ...d.data() }));
          setShifts(all);
          setActiveShifts(all.filter(sh => sh.status === "active"));
        }),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  // Elapsed timers
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const map = {};
      activeShifts.forEach(sh => {
        map[sh.id] = now - new Date(sh.startTime).getTime();
      });
      setElapsed(map);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeShifts]);

  const stopShiftAsLead = async (shift) => {
    await updateDoc(doc(db, "shifts", shift.id), {
      endTime: new Date().toISOString(),
      endedBy: profile?.uid,
      endedByName: profile?.name || "—",
      status: "ended",
    });
  };

  // My teams (for team_lead and chatter)
  const myTeams = isAdminPlus
    ? teams
    : teams.filter(team => (team.memberIds || []).includes(profile?.uid));

  // My team members (for team_lead)
  const myTeamMemberIds = new Set(
    myTeams.flatMap(team => team.memberIds || [])
  );
  const myTeamMembers = allUsers.filter(u =>
    myTeamMemberIds.has(u.uid || u.id) && (u.uid || u.id) !== profile?.uid
  );

  // Active shifts in my scope
  const visibleActiveShifts = isAdminPlus
    ? activeShifts
    : activeShifts.filter(sh => myTeamMemberIds.has(sh.userId));

  // Shift history in my scope (last 50)
  const visibleHistory = (isAdminPlus
    ? shifts.filter(sh => sh.status === "ended")
    : shifts.filter(sh => sh.status === "ended" && myTeamMemberIds.has(sh.userId))
  ).slice(0, 50);

  const getUserName = (uid) => allUsers.find(u => u.uid === uid || u.id === uid)?.name || "—";
  const getUserEmoji = (uid) => allUsers.find(u => u.uid === uid || u.id === uid)?.avatarEmoji;
  const getUserColor = (uid) => {
    const u = allUsers.find(u => u.uid === uid || u.id === uid);
    return ROLE_COLORS[u?.role] || "#64748b";
  };

  return (
    <div>
      <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} style={{ marginBottom:"28px" }}>
        <h1 style={{ fontSize:"26px", fontWeight:700, color:t.text, marginBottom:"6px" }}>
          {isChatter ? "Моя смена" : "Панель команды"}
        </h1>
        <p style={{ color:t.textMuted, fontSize:"14px" }}>
          {isChatter ? "Управляй своей рабочей сменой" : `${visibleActiveShifts.length} сотрудников сейчас в смене`}
        </p>
      </motion.div>

      {/* Chatter: shift button */}
      {isChatter && (
        <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
          style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"20px", padding:"24px", marginBottom:"20px", maxWidth:"400px" }}>
          <h3 style={{ color:t.text, fontSize:"15px", fontWeight:600, marginBottom:"16px" }}>⏱️ Смена</h3>
          <ShiftButton userId={profile?.uid} userName={profile?.name} db={db} t={t} />
        </motion.div>
      )}

      {/* Team lead / admin: active shifts */}
      {!isChatter && (
        <>
          {/* Active shifts */}
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
            style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"20px", padding:"22px", marginBottom:"20px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"16px" }}>
              <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:"#10b981", boxShadow:"0 0 8px #10b981", animation:"pulse 1.5s infinite" }} />
              <h3 style={{ color:t.text, fontSize:"15px", fontWeight:600 }}>Сейчас в смене</h3>
              <span style={{ background:"rgba(16,185,129,0.12)", color:"#10b981", fontSize:"12px", fontWeight:700, padding:"2px 8px", borderRadius:"10px" }}>{visibleActiveShifts.length}</span>
            </div>

            {visibleActiveShifts.length === 0 ? (
              <div style={{ color:t.textMuted, textAlign:"center", padding:"20px", fontSize:"13px" }}>Никто не в смене</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {visibleActiveShifts.map(sh => {
                  const rc = getUserColor(sh.userId);
                  const emoji = getUserEmoji(sh.userId);
                  return (
                    <div key={sh.id} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", background:"rgba(16,185,129,0.05)", border:"1px solid rgba(16,185,129,0.15)", borderRadius:"14px" }}>
                      <div style={{ position:"relative" }}>
                        <div style={{ width:"38px", height:"38px", borderRadius:"10px", background:`linear-gradient(135deg,${rc},${rc}88)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:emoji?"17px":"14px", fontWeight:700, color:"#fff" }}>
                          {emoji || getUserName(sh.userId)[0]?.toUpperCase()}
                        </div>
                        <div style={{ position:"absolute", bottom:-2, right:-2, width:"10px", height:"10px", borderRadius:"50%", background:"#10b981", border:"2px solid #0a0f1a" }} />
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ color:t.text, fontSize:"14px", fontWeight:600 }}>{sh.userName}</div>
                        <div style={{ color:t.textMuted, fontSize:"12px" }}>
                          С {formatTime(sh.startTime)} · {formatDuration(elapsed[sh.id] || 0)}
                        </div>
                      </div>
                      {(isTeamLead || isAdminPlus) && (
                        <button onClick={() => stopShiftAsLead(sh)}
                          style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", color:"#ef4444", borderRadius:"9px", padding:"6px 12px", fontSize:"12px", fontWeight:600, cursor:"pointer" }}>
                          <Square size={12} style={{ display:"inline", marginRight:"4px" }} />Стоп
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* My teams overview */}
          {myTeams.length > 0 && (
            <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
              style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"20px", padding:"22px", marginBottom:"20px" }}>
              <h3 style={{ color:t.text, fontSize:"15px", fontWeight:600, marginBottom:"16px" }}>
                <Users size={16} style={{ display:"inline", marginRight:"8px", verticalAlign:"middle" }} />
                {isAdminPlus ? "Все команды" : "Мои команды"}
              </h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:"12px" }}>
                {myTeams.map(team => {
                  const members = allUsers.filter(u => (team.memberIds||[]).includes(u.uid||u.id));
                  const inShift  = visibleActiveShifts.filter(sh => (team.memberIds||[]).includes(sh.userId)).length;
                  return (
                    <div key={team.id} style={{ padding:"14px 16px", background:t.bgCardHover, borderRadius:"14px", border:`1px solid ${team.color||"#7c3aed"}25` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
                        <div style={{ width:"34px", height:"34px", borderRadius:"10px", background:`linear-gradient(135deg,${team.color||"#7c3aed"},${team.color||"#db2877"})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" }}>
                          {team.emoji||"👥"}
                        </div>
                        <div style={{ color:t.text, fontSize:"14px", fontWeight:700 }}>{team.name}</div>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px" }}>
                        <span style={{ color:t.textMuted }}>{members.length} участников</span>
                        {inShift > 0 && <span style={{ color:"#10b981", fontWeight:700 }}>🟢 {inShift} в смене</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Shift history */}
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
            style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"20px", padding:"22px" }}>
            <h3 style={{ color:t.text, fontSize:"15px", fontWeight:600, marginBottom:"16px" }}>
              <Clock size={16} style={{ display:"inline", marginRight:"8px", verticalAlign:"middle" }} />
              История смен
            </h3>
            {visibleHistory.length === 0 ? (
              <div style={{ color:t.textMuted, textAlign:"center", padding:"20px", fontSize:"13px" }}>Нет истории смен</div>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px" }}>
                  <thead>
                    <tr style={{ background:t.bgCardHover }}>
                      {["Сотрудник","Дата","Начало","Конец","Длительность","Завершил"].map((h,i) => (
                        <th key={i} style={{ padding:"10px 14px", color:t.textFaint, fontWeight:700, textAlign:"left", fontSize:"11px", textTransform:"uppercase", letterSpacing:"0.5px", borderBottom:`1px solid ${t.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleHistory.map((sh,i) => {
                      const rc    = getUserColor(sh.userId);
                      const emoji = getUserEmoji(sh.userId);
                      const dur   = sh.endTime ? new Date(sh.endTime).getTime() - new Date(sh.startTime).getTime() : 0;
                      const endedBySelf = !sh.endedBy || sh.endedBy === sh.userId;
                      return (
                        <tr key={sh.id}
                          onMouseEnter={e => e.currentTarget.style.background = t.bgCardHover}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding:"11px 14px", borderBottom:`1px solid ${t.border}` }}>
                            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                              <div style={{ width:"28px", height:"28px", borderRadius:"8px", background:`linear-gradient(135deg,${rc},${rc}88)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:emoji?"13px":"10px", fontWeight:700, color:"#fff", flexShrink:0 }}>
                                {emoji || sh.userName?.[0]?.toUpperCase()}
                              </div>
                              <span style={{ color:t.text, fontWeight:600 }}>{sh.userName}</span>
                            </div>
                          </td>
                          <td style={{ padding:"11px 14px", color:t.textMuted, borderBottom:`1px solid ${t.border}` }}>{sh.date}</td>
                          <td style={{ padding:"11px 14px", color:t.text, fontWeight:500, borderBottom:`1px solid ${t.border}` }}>{formatTime(sh.startTime)}</td>
                          <td style={{ padding:"11px 14px", color:t.text, fontWeight:500, borderBottom:`1px solid ${t.border}` }}>{formatTime(sh.endTime)}</td>
                          <td style={{ padding:"11px 14px", borderBottom:`1px solid ${t.border}` }}>
                            <span style={{ background:"rgba(124,58,237,0.1)", color:"#a78bfa", fontSize:"12px", fontWeight:700, padding:"3px 8px", borderRadius:"8px" }}>
                              {formatDuration(dur)}
                            </span>
                          </td>
                          <td style={{ padding:"11px 14px", borderBottom:`1px solid ${t.border}` }}>
                            {endedBySelf
                              ? <span style={{ color:t.textFaint, fontSize:"12px" }}>Сам завершил</span>
                              : <span style={{ color:"#f59e0b", fontSize:"12px" }}>🔴 {sh.endedByName}</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
