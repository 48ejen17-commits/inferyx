import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, orderBy } from "firebase/firestore";
import { useAuth, ROLE_COLORS, ROLE_LABELS_DISPLAY } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Clock, Users, Square, ChevronDown, ChevronUp, CheckCircle, XCircle, FileText } from "lucide-react";

function fmt(ms) {
  if (!ms||ms<0) return "0м";
  const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;
  return h>0?`${h}ч ${m}м`:`${m}м ${sc}с`;
}
function fmtTime(iso){return iso?new Date(iso).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}):"—";}
function fmtDate(iso){return iso?new Date(iso).toLocaleDateString("ru-RU",{day:"numeric",month:"short"}):"—";}

// ── Shift Report Form (for chatter) ──────────────────────────────────────────
function ShiftReportForm({ shiftId, existing, db, t, onDone }) {
  const [form, setForm] = useState({
    sales:     existing?.sales     || "",
    messages:  existing?.messages  || "",
    newSubs:   existing?.newSubs   || "",
    problems:  existing?.problems  || "",
    note:      existing?.note      || "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await updateDoc(doc(db, "shifts", shiftId), {
      report: form,
      reportedAt: new Date().toISOString(),
      reportStatus: "pending",
    });
    setSaving(false);
    onDone();
  };

  const inp = { background: t.bgInput, color: t.text, border: `1px solid ${t.border}`, borderRadius:"9px", padding:"9px 12px", fontSize:"13px", outline:"none", fontFamily:"inherit", width:"100%" };

  return (
    <div style={{ padding:"14px 18px 18px", background:t.bgCardHover }}>
      <div style={{ color:t.text, fontSize:"13px", fontWeight:600, marginBottom:"12px" }}>📋 Отчёт о смене</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"10px" }}>
        {[
          { key:"sales",    label:"💰 Продажи ($)",      ph:"0" },
          { key:"messages", label:"📩 Рассылки (шт)",    ph:"0" },
          { key:"newSubs",  label:"🔔 Новые подписчики", ph:"0" },
          { key:"problems", label:"⚠️ Проблемы",         ph:"Нет" },
        ].map(f => (
          <div key={f.key}>
            <label style={{ color:t.textMuted, fontSize:"11px", display:"block", marginBottom:"4px" }}>{f.label}</label>
            <input value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} placeholder={f.ph} style={inp}/>
          </div>
        ))}
      </div>
      <div style={{ marginBottom:"12px" }}>
        <label style={{ color:t.textMuted, fontSize:"11px", display:"block", marginBottom:"4px" }}>💬 Заметки</label>
        <textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Что ещё важно отметить..." rows={2}
          style={{ ...inp, resize:"none" }}/>
      </div>
      <div style={{ display:"flex", gap:"8px" }}>
        <button onClick={save} disabled={saving}
          style={{ background:"linear-gradient(135deg,#7c3aed,#db2877)", color:"#fff", border:"none", borderRadius:"9px", padding:"9px 20px", fontSize:"13px", fontWeight:700, cursor:"pointer" }}>
          {saving?"Сохраняем...":"Отправить отчёт"}
        </button>
        <button onClick={onDone} style={{ background:t.bgCard, border:`1px solid ${t.border}`, color:t.textMuted, borderRadius:"9px", padding:"9px 14px", fontSize:"13px", cursor:"pointer" }}>Отмена</button>
      </div>
    </div>
  );
}

// ── Shift Row ─────────────────────────────────────────────────────────────────
function ShiftRow({ sh, canStop, canReview, isOwn, onStop, t, i, total }) {
  const [expanded, setExpanded] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [leaderNote, setLeaderNote] = useState(sh.leaderNote || "");
  const [saving, setSaving] = useState(false);
  const { db } = useAuth();

  const dur = sh.endTime ? new Date(sh.endTime).getTime()-new Date(sh.startTime).getTime() : 0;
  const r   = sh.report;

  const approve = async (approved) => {
    setSaving(true);
    await updateDoc(doc(db,"shifts",sh.id), {
      reportStatus: approved?"approved":"rejected",
      leaderNote, reviewedAt: new Date().toISOString(),
    });
    setSaving(false);
    setExpanded(false);
  };

  const statusBadge = !r ? null : sh.reportStatus === "approved"
    ? <span style={{ color:"#10b981", fontSize:"11px", fontWeight:700 }}>✅ одобрен</span>
    : sh.reportStatus === "rejected"
    ? <span style={{ color:"#ef4444", fontSize:"11px", fontWeight:700 }}>❌ отклонён</span>
    : <span style={{ color:"#f59e0b", fontSize:"11px", fontWeight:700 }}>⏳ на проверке</span>;

  return (
    <div style={{ borderBottom: i<total-1?`1px solid ${t.border}`:"none" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"11px 20px" }}
        onMouseEnter={e=>e.currentTarget.style.background=t.bgCardHover}
        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:t.text, fontSize:"13px", fontWeight:600 }}>{sh.userName}</div>
          <div style={{ color:t.textMuted, fontSize:"11px" }}>
            {fmtDate(sh.startTime)} · {fmtTime(sh.startTime)}—{fmtTime(sh.endTime)}
            {sh.endedBy&&sh.endedBy!==sh.userId&&<span style={{ color:"#f59e0b" }}> · стоп: {sh.endedByName}</span>}
          </div>
        </div>
        <span style={{ background:"rgba(124,58,237,0.1)", color:"#a78bfa", fontSize:"11px", fontWeight:700, padding:"3px 8px", borderRadius:"8px", flexShrink:0 }}>
          {dur>0?fmt(dur):"—"}
        </span>
        {statusBadge}
        {canStop&&sh.status==="active"&&(
          <button onClick={()=>onStop(sh)} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", color:"#ef4444", borderRadius:"8px", padding:"5px 10px", fontSize:"11px", cursor:"pointer" }}>Стоп</button>
        )}
        {isOwn&&sh.status==="ended"&&!r&&(
          <button onClick={()=>setShowReport(v=>!v)} style={{ background:"rgba(124,58,237,0.1)", border:"1px solid rgba(124,58,237,0.25)", color:"#a78bfa", borderRadius:"8px", padding:"5px 10px", fontSize:"11px", cursor:"pointer", display:"flex", alignItems:"center", gap:"4px" }}>
            <FileText size={11}/>Отчёт
          </button>
        )}
        {(r||(canReview&&r))&&(
          <button onClick={()=>setExpanded(v=>!v)} style={{ background:"none", border:"none", color:t.textMuted, cursor:"pointer", padding:"2px" }}>
            {expanded?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
          </button>
        )}
      </div>

      {/* Report form for chatter */}
      <AnimatePresence>
        {showReport&&(
          <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}>
            <ShiftReportForm shiftId={sh.id} existing={r} db={db} t={t} onDone={()=>setShowReport(false)}/>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report view / review */}
      <AnimatePresence>
        {expanded&&r&&(
          <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} style={{overflow:"hidden"}}>
            <div style={{ padding:"12px 20px 16px", background:t.bgCardHover }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"10px" }}>
                {[
                  {label:"💰 Продажи", val:r.sales||"—"},
                  {label:"📩 Рассылки", val:r.messages||"—"},
                  {label:"🔔 Новые подписчики", val:r.newSubs||"—"},
                  {label:"⚠️ Проблемы", val:r.problems||"—"},
                ].map((f,i)=>(
                  <div key={i} style={{ padding:"8px 10px", background:t.bgCard, borderRadius:"8px" }}>
                    <div style={{ color:t.textFaint, fontSize:"10px", marginBottom:"2px" }}>{f.label}</div>
                    <div style={{ color:t.text, fontSize:"13px", fontWeight:600 }}>{f.val}</div>
                  </div>
                ))}
              </div>
              {r.note&&<div style={{ color:t.textMuted, fontSize:"12px", marginBottom:"10px" }}>💬 {r.note}</div>}

              {canReview&&sh.reportStatus==="pending"&&(
                <div>
                  <textarea value={leaderNote} onChange={e=>setLeaderNote(e.target.value)} placeholder="Пометка тим-лида (необязательно)..." rows={2}
                    style={{ width:"100%", background:t.bgInput, color:t.text, border:`1px solid ${t.border}`, borderRadius:"9px", padding:"9px", fontSize:"12px", resize:"none", outline:"none", fontFamily:"inherit", marginBottom:"8px" }}/>
                  <div style={{ display:"flex", gap:"8px" }}>
                    <button onClick={()=>approve(true)} disabled={saving} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:"5px", background:"rgba(16,185,129,0.12)", border:"1px solid rgba(16,185,129,0.3)", color:"#10b981", borderRadius:"9px", padding:"9px", fontSize:"13px", fontWeight:700, cursor:"pointer" }}>
                      <CheckCircle size={13}/>Одобрить
                    </button>
                    <button onClick={()=>approve(false)} disabled={saving} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:"5px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", color:"#ef4444", borderRadius:"9px", padding:"9px", fontSize:"13px", fontWeight:700, cursor:"pointer" }}>
                      <XCircle size={13}/>Отклонить
                    </button>
                  </div>
                </div>
              )}
              {sh.leaderNote&&<div style={{ color:"#a78bfa", fontSize:"12px", marginTop:"8px" }}>📝 Тим-лид: {sh.leaderNote}</div>}
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
  const [allModels,setAllModels]= useState([]);
  const [shifts,   setShifts]   = useState([]);
  const [elapsed,  setElapsed]  = useState({});

  const isChatter   = profile?.role === "chatter";
  const isTeamLead  = profile?.role === "team_lead";
  const isAdminPlus = ["owner","admin","project_manager"].includes(profile?.role);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db,"teams"),   s=>setTeams(s.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(collection(db,"users"),   s=>setAllUsers(s.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(collection(db,"models"),  s=>setAllModels(s.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(query(collection(db,"shifts"),orderBy("startTime","desc")),
        s=>setShifts(s.docs.map(d=>({id:d.id,...d.data()})))),
    ];
    return ()=>unsubs.forEach(u=>u());
  }, [db]);

  const activeShifts = shifts.filter(sh=>sh.status==="active");
  useEffect(() => {
    const iv = setInterval(()=>{
      const m={};
      activeShifts.forEach(sh=>{m[sh.id]=Date.now()-new Date(sh.startTime).getTime();});
      setElapsed(m);
    },1000);
    return ()=>clearInterval(iv);
  },[activeShifts.length]);

  const myTeams     = isAdminPlus ? teams : teams.filter(tm=>(tm.memberIds||[]).includes(profile?.uid));
  const myMemberIds = isAdminPlus ? null : new Set(myTeams.flatMap(tm=>tm.memberIds||[]));
  const myModelIds  = isAdminPlus ? null : new Set(myTeams.flatMap(tm=>tm.modelIds||[]));

  const visibleActive  = myMemberIds ? activeShifts.filter(sh=>myMemberIds.has(sh.userId)) : activeShifts;
  const visibleHistory = shifts.filter(sh=>sh.status==="ended"&&(!myMemberIds||myMemberIds.has(sh.userId))).slice(0,80);
  const pendingReviews = visibleHistory.filter(sh=>sh.report&&sh.reportStatus==="pending");

  const stopShift = async (sh) => {
    await updateDoc(doc(db,"shifts",sh.id),{
      endTime:new Date().toISOString(), endedBy:profile?.uid, endedByName:profile?.name||"—", status:"ended"
    });
  };

  const myTeamModels  = myModelIds  ? allModels.filter(m=>myModelIds.has(m.id)&&m.status!=="inactive") : allModels.filter(m=>m.status!=="inactive");
  const myTeamMembers = myMemberIds ? allUsers.filter(u=>myMemberIds.has(u.uid||u.id)&&u.uid!==profile?.uid) : allUsers;

  return (
    <div>
      <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} style={{marginBottom:"22px"}}>
        <h1 style={{fontSize:"26px",fontWeight:700,color:t.text,marginBottom:"6px"}}>Моя команда</h1>
        <p style={{color:t.textMuted,fontSize:"14px"}}>
          {visibleActive.length} сейчас в смене · {myTeamMembers.length} участников · {myTeamModels.length} моделей
        </p>
      </motion.div>

      {/* Pending reviews badge */}
      {(isTeamLead||isAdminPlus)&&pendingReviews.length>0&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}}
          style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:"12px",padding:"12px 16px",marginBottom:"16px",display:"flex",alignItems:"center",gap:"10px"}}>
          <span style={{fontSize:"18px"}}>⏳</span>
          <span style={{color:"#f59e0b",fontSize:"13px",fontWeight:600}}>{pendingReviews.length} отчётов ждут проверки</span>
        </motion.div>
      )}

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"12px",marginBottom:"16px"}}>
        {[
          {icon:"🟢",label:"В смене",     val:visibleActive.length,  color:"#10b981"},
          {icon:"👥",label:"Участников",  val:myTeamMembers.length,  color:"#7c3aed"},
          {icon:"📊",label:"Моделей",     val:myTeamModels.length,   color:"#0ea5e9"},
          {icon:"⏳",label:"Отчётов",     val:pendingReviews.length, color:"#f59e0b"},
        ].map((c,i)=>(
          <div key={i} style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"14px",padding:"16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{color:t.textMuted,fontSize:"11px",marginBottom:"5px"}}>{c.label}</div>
                <div style={{color:c.color,fontSize:"26px",fontWeight:800}}>{c.val}</div>
              </div>
              <span style={{fontSize:"20px"}}>{c.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Active shifts */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.1}}
        style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"18px",padding:"22px",marginBottom:"16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px"}}>
          {visibleActive.length>0&&<div style={{width:"8px",height:"8px",borderRadius:"50%",background:"#10b981",boxShadow:"0 0 7px #10b981",animation:"pulse 1.5s infinite"}}/>}
          <h3 style={{color:t.text,fontSize:"15px",fontWeight:600}}>Сейчас в смене</h3>
          <span style={{background:"rgba(16,185,129,0.12)",color:"#10b981",fontSize:"11px",fontWeight:700,padding:"2px 8px",borderRadius:"10px"}}>{visibleActive.length}</span>
        </div>
        {visibleActive.length===0 ? (
          <div style={{color:t.textMuted,textAlign:"center",padding:"16px",fontSize:"13px"}}>Никто не в смене</div>
        ) : visibleActive.map(sh=>{
          const rc=ROLE_COLORS[allUsers.find(u=>u.uid===sh.userId||u.id===sh.userId)?.role]||"#64748b";
          const em=allUsers.find(u=>u.uid===sh.userId||u.id===sh.userId)?.avatarEmoji;
          return (
            <div key={sh.id} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 14px",background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.15)",borderRadius:"12px",marginBottom:"6px"}}>
              <div style={{width:"34px",height:"34px",borderRadius:"10px",background:`linear-gradient(135deg,${rc},${rc}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:em?"16px":"12px",fontWeight:700,color:"#fff",flexShrink:0}}>
                {em||sh.userName?.[0]?.toUpperCase()}
              </div>
              <div style={{flex:1}}>
                <div style={{color:t.text,fontSize:"13px",fontWeight:600}}>{sh.userName}</div>
                <div style={{color:t.textMuted,fontSize:"11px"}}>С {fmtTime(sh.startTime)}</div>
              </div>
              <div style={{color:"#34d399",fontSize:"15px",fontWeight:800,fontFamily:"monospace"}}>{fmt(elapsed[sh.id]||0)}</div>
              {(isTeamLead||isAdminPlus)&&(
                <button onClick={()=>stopShift(sh)} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",color:"#ef4444",borderRadius:"8px",padding:"5px 10px",fontSize:"11px",fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:"4px"}}>
                  <Square size={11}/>Стоп
                </button>
              )}
            </div>
          );
        })}
      </motion.div>

      {/* Teams overview */}
      {myTeams.length>0&&(
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.15}}
          style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"18px",padding:"22px",marginBottom:"16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px"}}>
            <Users size={14} style={{color:"#7c3aed"}}/>
            <h3 style={{color:t.text,fontSize:"15px",fontWeight:600}}>{isAdminPlus?"Все команды":"Команды"}</h3>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"10px"}}>
            {myTeams.map(team=>{
              const members =allUsers.filter(u=>(team.memberIds||[]).includes(u.uid||u.id));
              const models  =allModels.filter(m=>(team.modelIds||[]).includes(m.id)&&m.status!=="inactive");
              const inShift =visibleActive.filter(sh=>(team.memberIds||[]).includes(sh.userId)).length;
              return (
                <div key={team.id} style={{padding:"14px 16px",background:t.bgCardHover,borderRadius:"14px",border:`1px solid ${team.color||"#7c3aed"}22`}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}>
                    <div style={{width:"34px",height:"34px",borderRadius:"10px",background:`linear-gradient(135deg,${team.color||"#7c3aed"},${team.color||"#db2877"})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px"}}>{team.emoji||"👥"}</div>
                    <div style={{color:t.text,fontSize:"14px",fontWeight:700}}>{team.name}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:"4px",fontSize:"12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{color:t.textMuted}}>👥 Участников</span>
                      <span style={{color:t.text,fontWeight:600}}>{members.length}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{color:t.textMuted}}>📊 Моделей</span>
                      <span style={{color:t.text,fontWeight:600}}>{models.length}</span>
                    </div>
                    {inShift>0&&(
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <span style={{color:"#10b981"}}>🟢 В смене</span>
                        <span style={{color:"#10b981",fontWeight:600}}>{inShift}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Shift history */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.2}}
        style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"18px",overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            <Clock size={14} style={{color:t.textMuted}}/>
            <span style={{color:t.text,fontSize:"14px",fontWeight:600}}>История смен</span>
            {pendingReviews.length>0&&(isTeamLead||isAdminPlus)&&(
              <span style={{background:"rgba(245,158,11,0.15)",color:"#f59e0b",fontSize:"11px",fontWeight:700,padding:"2px 8px",borderRadius:"8px"}}>{pendingReviews.length} ждут</span>
            )}
          </div>
          <span style={{color:t.textFaint,fontSize:"12px"}}>{visibleHistory.length} смен</span>
        </div>
        {visibleHistory.length===0?(
          <div style={{padding:"40px",textAlign:"center",color:t.textFaint,fontSize:"13px"}}>Нет истории</div>
        ):visibleHistory.map((sh,i)=>(
          <ShiftRow key={sh.id} sh={sh} i={i} total={visibleHistory.length}
            canStop={false}
            canReview={(isTeamLead||isAdminPlus)&&sh.report&&sh.reportStatus==="pending"}
            isOwn={sh.userId===profile?.uid}
            onStop={stopShift} t={t}/>
        ))}
      </motion.div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}
