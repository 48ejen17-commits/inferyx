import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, orderBy } from "firebase/firestore";
import { useAuth, ROLE_COLORS, ROLE_LABELS_DISPLAY } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Clock, Users, Square, ChevronDown, ChevronUp } from "lucide-react";

function fmt(ms) {
  if (!ms || ms < 0) return "0м";
  const s = Math.floor(ms/1000), h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sc = s%60;
  return h > 0 ? `${h}ч ${m}м` : `${m}м ${sc}с`;
}
function fmtTime(iso) { return iso ? new Date(iso).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}) : "—"; }
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString("ru-RU",{day:"numeric",month:"short"}) : "—"; }

// ── Shift row with report ─────────────────────────────────────────────────────
function ShiftRow({ sh, canStop, onStop, t, i, total }) {
  const [expanded, setExpanded]   = useState(false);
  const [report, setReport]       = useState(sh.report || "");
  const [saving, setSaving]       = useState(false);
  const { db } = useAuth();
  const dur = sh.endTime ? new Date(sh.endTime).getTime() - new Date(sh.startTime).getTime() : 0;

  const saveReport = async () => {
    setSaving(true);
    await updateDoc(doc(db, "shifts", sh.id), { report });
    setSaving(false);
    setExpanded(false);
  };

  return (
    <div style={{ borderBottom: i < total-1 ? `1px solid ${t.border}` : "none" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"11px 20px" }}
        onMouseEnter={e => e.currentTarget.style.background=t.bgCardHover}
        onMouseLeave={e => e.currentTarget.style.background="transparent"}>
        <div style={{ flex:1 }}>
          <div style={{ color:t.text, fontSize:"13px", fontWeight:600 }}>{sh.userName}</div>
          <div style={{ color:t.textMuted, fontSize:"11px" }}>
            {fmtDate(sh.startTime)} · {fmtTime(sh.startTime)} — {fmtTime(sh.endTime)}
            {sh.endedBy && sh.endedBy !== sh.userId && <span style={{ color:"#f59e0b" }}> · остановил {sh.endedByName}</span>}
          </div>
        </div>
        <span style={{ background:"rgba(124,58,237,0.1)", color:"#a78bfa", fontSize:"11px", fontWeight:700, padding:"3px 8px", borderRadius:"8px" }}>
          {dur > 0 ? fmt(dur) : "—"}
        </span>
        {sh.report && <span style={{ color:"#10b981", fontSize:"11px" }}>✅ отчёт</span>}
        {canStop && sh.status === "active" && (
          <button onClick={() => onStop(sh)} style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", borderRadius:"8px", padding:"5px 10px", fontSize:"11px", fontWeight:600, cursor:"pointer" }}>
            Стоп
          </button>
        )}
        <button onClick={() => setExpanded(v=>!v)}
          style={{ background:"none", border:"none", color:t.textMuted, cursor:"pointer", padding:"2px" }}>
          {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }} exit={{ height:0, opacity:0 }}
            style={{ overflow:"hidden" }}>
            <div style={{ padding:"12px 20px 16px", background:t.bgCardHover }}>
              <label style={{ color:t.textMuted, fontSize:"11px", fontWeight:700, display:"block", marginBottom:"6px", textTransform:"uppercase" }}>
                Отчёт о смене
              </label>
              <textarea value={report} onChange={e => setReport(e.target.value)}
                placeholder="Что было сделано, сколько постов, проблемы..."
                rows={3}
                style={{ width:"100%", background:t.bgInput, color:t.text, border:`1px solid ${t.border}`, borderRadius:"10px", padding:"10px", fontSize:"13px", resize:"vertical", outline:"none", fontFamily:"inherit" }} />
              <div style={{ display:"flex", gap:"8px", marginTop:"8px" }}>
                <button onClick={saveReport} disabled={saving}
                  style={{ background:"linear-gradient(135deg,#7c3aed,#db2877)", color:"#fff", border:"none", borderRadius:"9px", padding:"8px 18px", fontSize:"13px", fontWeight:700, cursor:"pointer" }}>
                  {saving ? "Сохраняем..." : "Сохранить"}
                </button>
                <button onClick={() => setExpanded(false)}
                  style={{ background:t.bgCard, border:`1px solid ${t.border}`, color:t.textMuted, borderRadius:"9px", padding:"8px 14px", fontSize:"13px", cursor:"pointer" }}>
                  Отмена
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TeamPanel() {
  const { db, profile } = useAuth();
  const { theme: t }    = useTheme();

  const [teams,    setTeams]    = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [shifts,   setShifts]   = useState([]);
  const [elapsed,  setElapsed]  = useState({});

  const isChatter   = profile?.role === "chatter";
  const isTeamLead  = profile?.role === "team_lead";
  const isAdminPlus = ["owner","admin","project_manager"].includes(profile?.role);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "teams"),  s => setTeams(s.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(collection(db, "users"),  s => setAllUsers(s.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(query(collection(db, "shifts"), orderBy("startTime","desc")),
        s => setShifts(s.docs.map(d=>({id:d.id,...d.data()})))),
    ];
    return () => unsubs.forEach(u=>u());
  }, [db]);

  const activeShifts = shifts.filter(sh => sh.status === "active");
  useEffect(() => {
    const iv = setInterval(() => {
      const m = {};
      activeShifts.forEach(sh => { m[sh.id] = Date.now() - new Date(sh.startTime).getTime(); });
      setElapsed(m);
    }, 1000);
    return () => clearInterval(iv);
  }, [activeShifts.length]);

  const myTeams = isAdminPlus
    ? teams
    : teams.filter(tm => (tm.memberIds||[]).includes(profile?.uid));

  const myMemberIds = isAdminPlus
    ? null
    : new Set(myTeams.flatMap(tm => tm.memberIds||[]));

  const visibleActive  = myMemberIds ? activeShifts.filter(sh => myMemberIds.has(sh.userId)) : activeShifts;
  const visibleHistory = shifts.filter(sh =>
    sh.status === "ended" && (!myMemberIds || myMemberIds.has(sh.userId))
  ).slice(0, 60);

  const stopShift = async (sh) => {
    await updateDoc(doc(db, "shifts", sh.id), {
      endTime: new Date().toISOString(),
      endedBy: profile?.uid, endedByName: profile?.name||"—",
      status: "ended",
    });
  };

  const getUserColor = (uid) => ROLE_COLORS[allUsers.find(u=>u.uid===uid||u.id===uid)?.role]||"#64748b";
  const getUserEmoji = (uid) => allUsers.find(u=>u.uid===uid||u.id===uid)?.avatarEmoji;

  return (
    <div>
      <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} style={{marginBottom:"24px"}}>
        <h1 style={{fontSize:"26px",fontWeight:700,color:t.text,marginBottom:"6px"}}>
          {isAdminPlus ? "Смены команды" : "Моя команда"}
        </h1>
        <p style={{color:t.textMuted,fontSize:"14px"}}>
          {visibleActive.length} сейчас в смене
        </p>
      </motion.div>

      {/* Active shifts */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.1}}
        style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"20px",padding:"22px",marginBottom:"16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"16px"}}>
          {visibleActive.length > 0 && <div style={{width:"10px",height:"10px",borderRadius:"50%",background:"#10b981",boxShadow:"0 0 8px #10b981",animation:"pulse 1.5s infinite"}}/>}
          <h3 style={{color:t.text,fontSize:"15px",fontWeight:600}}>Сейчас в смене</h3>
          <span style={{background:"rgba(16,185,129,0.12)",color:"#10b981",fontSize:"12px",fontWeight:700,padding:"2px 8px",borderRadius:"10px"}}>{visibleActive.length}</span>
        </div>
        {visibleActive.length === 0 ? (
          <div style={{color:t.textMuted,textAlign:"center",padding:"20px",fontSize:"13px"}}>Никто не в смене</div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {visibleActive.map(sh => {
              const rc    = getUserColor(sh.userId);
              const emoji = getUserEmoji(sh.userId);
              return (
                <div key={sh.id} style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 16px",background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.18)",borderRadius:"14px"}}>
                  <div style={{position:"relative"}}>
                    <div style={{width:"38px",height:"38px",borderRadius:"10px",background:`linear-gradient(135deg,${rc},${rc}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:emoji?"17px":"13px",fontWeight:700,color:"#fff"}}>
                      {emoji||sh.userName?.[0]?.toUpperCase()}
                    </div>
                    <div style={{position:"absolute",bottom:-2,right:-2,width:"10px",height:"10px",borderRadius:"50%",background:"#10b981",border:`2px solid ${t.bg||"#09050f"}`}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{color:t.text,fontSize:"14px",fontWeight:600}}>{sh.userName}</div>
                    <div style={{color:t.textMuted,fontSize:"12px"}}>
                      С {fmtTime(sh.startTime)}
                    </div>
                  </div>
                  <div style={{color:"#34d399",fontSize:"16px",fontWeight:800,fontFamily:"monospace"}}>
                    {fmt(elapsed[sh.id]||0)}
                  </div>
                  {(isTeamLead || isAdminPlus) && (
                    <button onClick={() => stopShift(sh)}
                      style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",color:"#ef4444",borderRadius:"9px",padding:"6px 12px",fontSize:"12px",fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:"4px"}}>
                      <Square size={11}/>Стоп
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Teams overview */}
      {myTeams.length > 0 && (
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.2}}
          style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"20px",padding:"22px",marginBottom:"16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"16px"}}>
            <Users size={15} style={{color:"#7c3aed"}}/>
            <h3 style={{color:t.text,fontSize:"15px",fontWeight:600}}>{isAdminPlus?"Все команды":"Мои команды"}</h3>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"10px"}}>
            {myTeams.map(team => {
              const members  = allUsers.filter(u=>(team.memberIds||[]).includes(u.uid||u.id));
              const inShift  = visibleActive.filter(sh=>(team.memberIds||[]).includes(sh.userId)).length;
              return (
                <div key={team.id} style={{padding:"14px 16px",background:t.bgCardHover,borderRadius:"14px",border:`1px solid ${team.color||"#7c3aed"}22`}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"}}>
                    <div style={{width:"34px",height:"34px",borderRadius:"10px",background:`linear-gradient(135deg,${team.color||"#7c3aed"},${team.color||"#db2877"})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px"}}>
                      {team.emoji||"👥"}
                    </div>
                    <div style={{color:t.text,fontSize:"14px",fontWeight:700}}>{team.name}</div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:"12px"}}>
                    <span style={{color:t.textMuted}}>{members.length} участников</span>
                    {inShift > 0 && <span style={{color:"#10b981",fontWeight:700}}>🟢 {inShift} в смене</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Shift history with reports */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.3}}
        style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"20px",overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            <Clock size={15} style={{color:t.textMuted}}/>
            <span style={{color:t.text,fontSize:"14px",fontWeight:600}}>История смен</span>
          </div>
          <span style={{color:t.textFaint,fontSize:"12px"}}>{visibleHistory.length} записей</span>
        </div>
        {visibleHistory.length === 0 ? (
          <div style={{padding:"40px",textAlign:"center",color:t.textFaint,fontSize:"13px"}}>Нет истории</div>
        ) : visibleHistory.map((sh, i) => (
          <ShiftRow key={sh.id} sh={sh} i={i} total={visibleHistory.length}
            canStop={isTeamLead || isAdminPlus} onStop={stopShift} t={t} />
        ))}
      </motion.div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}
