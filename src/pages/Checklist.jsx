import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from "firebase/firestore";
import { useAuth, ROLES } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { CheckSquare, Square, ChevronLeft, ChevronRight, Calendar, BarChart2 } from "lucide-react";

const DAYS_SHORT = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];

export default function Checklist() {
  const { db, user, profile } = useAuth();
  const { theme: t } = useTheme();

  const [models,    setModels]    = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [checks,    setChecks]    = useState([]);
  const [teams,     setTeams]     = useState([]);
  const [viewMode,  setViewMode]  = useState("day"); // "day" | "week"
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading,   setLoading]   = useState(true);

  const isChatter  = profile?.role === ROLES.CHATTER;
  const isTeamLead = profile?.role === ROLES.TEAM_LEAD;
  const canEdit    = !isChatter;

  // Week dates
  const getWeekDates = () => {
    const today = new Date();
    const day = today.getDay();
    const mon = new Date(today);
    mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  };
  const weekDates = getWeekDates();
  const dateKey = selectedDate.toLocaleDateString("ru-RU");

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "models"),    s => { setModels(s.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); }),
      onSnapshot(collection(db, "platforms"), s => setPlatforms(s.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(collection(db, "teams"),     s => setTeams(s.docs.map(d=>({id:d.id,...d.data()})))),
    ];
    return () => unsubs.forEach(u=>u());
  }, [db]);

  // Load checks for current view
  useEffect(() => {
    if (viewMode === "day") {
      const unsub = onSnapshot(query(collection(db,"checklist"), where("date","==",dateKey)),
        s => setChecks(s.docs.map(d=>({id:d.id,...d.data()}))));
      return unsub;
    } else {
      const dates = weekDates.map(d => d.toLocaleDateString("ru-RU"));
      const unsub = onSnapshot(collection(db, "checklist"), s => {
        setChecks(s.docs.map(d=>({id:d.id,...d.data()})).filter(c => dates.includes(c.date)));
      });
      return unsub;
    }
  }, [db, dateKey, viewMode, weekOffset]);

  // Scope models by team
  const myTeamModelIds = (isChatter || isTeamLead)
    ? new Set(teams.filter(tm=>(tm.memberIds||[]).includes(profile?.uid)).flatMap(tm=>tm.modelIds||[]))
    : null;
  const visibleModels = myTeamModelIds
    ? models.filter(m => myTeamModelIds.has(m.id) && m.status !== "inactive")
    : models.filter(m => m.status !== "inactive");

  const allPlatforms = [
    "Reddit","Twitter/X","TikTok","Instagram","Telegram","Discord","Facebook","YouTube","OnlyFans",
    ...platforms.map(p=>p.name).filter(p=>!["Reddit","Twitter/X","TikTok","Instagram","Telegram","Discord","Facebook","YouTube","OnlyFans"].includes(p))
  ];

  const isChecked = (modelId, platform, date) => {
    const d = date || dateKey;
    return checks.some(c => c.modelId===modelId && c.platform===platform && c.date===d && c.done);
  };

  const toggle = async (modelId, modelName, platform, date) => {
    if (!canEdit) return;
    const d = date || dateKey;
    const existing = checks.find(c=>c.modelId===modelId && c.platform===platform && c.date===d);
    if (existing) {
      await updateDoc(doc(db,"checklist",existing.id), { done:!existing.done, updatedAt: new Date().toISOString() });
    } else {
      await addDoc(collection(db,"checklist"), {
        modelId, modelName, platform, done:true, date:d,
        createdBy: profile?.name, userId: user.uid, createdAt: new Date().toISOString()
      });
    }
  };

  const getDayProgress = (modelId, date) => {
    const done  = allPlatforms.filter(p=>isChecked(modelId,p,date)).length;
    return { done, total: allPlatforms.length, pct: allPlatforms.length > 0 ? Math.round(done/allPlatforms.length*100) : 0 };
  };

  const todayStr = new Date().toLocaleDateString("ru-RU");
  const isToday  = dateKey === todayStr;

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"22px", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <h1 style={{ fontSize:"24px", fontWeight:700, color:t.text, marginBottom:"4px" }}>Чек-лист публикаций</h1>
          <p style={{ color:t.textMuted, fontSize:"14px" }}>
            {visibleModels.length} моделей · {allPlatforms.length} платформ
          </p>
        </div>
        {/* View toggle */}
        <div style={{ display:"flex", gap:"6px", background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"10px", padding:"4px" }}>
          <button onClick={() => setViewMode("day")}
            style={{ display:"flex", alignItems:"center", gap:"5px", padding:"7px 14px", borderRadius:"8px", border:"none", background:viewMode==="day"?"linear-gradient(135deg,#7c3aed,#db2877)":"transparent", color:viewMode==="day"?"#fff":t.textMuted, fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
            <Calendar size={13} />День
          </button>
          <button onClick={() => setViewMode("week")}
            style={{ display:"flex", alignItems:"center", gap:"5px", padding:"7px 14px", borderRadius:"8px", border:"none", background:viewMode==="week"?"linear-gradient(135deg,#7c3aed,#db2877)":"transparent", color:viewMode==="week"?"#fff":t.textMuted, fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
            <BarChart2 size={13} />Неделя
          </button>
        </div>
      </div>

      {/* Day nav */}
      {viewMode === "day" && (
        <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px" }}>
          <button onClick={() => { const d=new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d); }}
            style={{ background:t.bgCard, border:`1px solid ${t.border}`, color:t.textMuted, borderRadius:"8px", padding:"8px", cursor:"pointer", display:"flex" }}>
            <ChevronLeft size={16}/>
          </button>
          <div style={{ color:t.text, fontWeight:600, fontSize:"15px", minWidth:"180px", textAlign:"center" }}>
            {DAYS_SHORT[selectedDate.getDay()]}, {selectedDate.toLocaleDateString("ru-RU",{day:"numeric",month:"long"})}
            {isToday && <span style={{ color:"#7c3aed", fontSize:"12px", marginLeft:"8px" }}>Сегодня</span>}
          </div>
          <button onClick={() => { const d=new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d); }}
            style={{ background:t.bgCard, border:`1px solid ${t.border}`, color:t.textMuted, borderRadius:"8px", padding:"8px", cursor:"pointer", display:"flex" }}>
            <ChevronRight size={16}/>
          </button>
          {!isToday && (
            <button onClick={() => setSelectedDate(new Date())}
              style={{ background:"rgba(124,58,237,0.12)", border:"none", color:"#a78bfa", borderRadius:"8px", padding:"7px 14px", fontSize:"12px", cursor:"pointer" }}>
              Сегодня
            </button>
          )}
        </div>
      )}

      {/* Week nav */}
      {viewMode === "week" && (
        <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px" }}>
          <button onClick={() => setWeekOffset(w=>w-1)}
            style={{ background:t.bgCard, border:`1px solid ${t.border}`, color:t.textMuted, borderRadius:"8px", padding:"8px", cursor:"pointer", display:"flex" }}>
            <ChevronLeft size={16}/>
          </button>
          <div style={{ color:t.text, fontWeight:600, fontSize:"14px", minWidth:"200px", textAlign:"center" }}>
            {weekDates[0].toLocaleDateString("ru-RU",{day:"numeric",month:"short"})} — {weekDates[6].toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}
          </div>
          <button onClick={() => setWeekOffset(w=>w+1)}
            style={{ background:t.bgCard, border:`1px solid ${t.border}`, color:t.textMuted, borderRadius:"8px", padding:"8px", cursor:"pointer", display:"flex" }}>
            <ChevronRight size={16}/>
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)}
              style={{ background:"rgba(124,58,237,0.12)", border:"none", color:"#a78bfa", borderRadius:"8px", padding:"7px 14px", fontSize:"12px", cursor:"pointer" }}>
              Эта неделя
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ color:t.textMuted, textAlign:"center", padding:"60px" }}>Загрузка...</div>
      ) : visibleModels.length === 0 ? (
        <div style={{ color:t.textMuted, textAlign:"center", padding:"60px" }}>
          <CheckSquare size={36} style={{ marginBottom:"10px", opacity:0.3 }}/>
          <div>Нет моделей</div>
        </div>
      ) : viewMode === "day" ? (
        /* ── DAY VIEW ── */
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {visibleModels.map((model, mi) => {
            const prog = getDayProgress(model.id, dateKey);
            const color = model.color || "#7c3aed";
            return (
              <motion.div key={model.id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:mi*0.04 }}
                style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"14px", padding:"16px 18px", overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"10px" }}>
                  <div style={{ width:"36px", height:"36px", borderRadius:"10px", background:`linear-gradient(135deg,${color},${color}88)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:model.emoji?"17px":"13px", fontWeight:700, color:"#fff", flexShrink:0 }}>
                    {model.emoji || model.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:t.text, fontWeight:600, fontSize:"14px" }}>{model.name}</div>
                    <div style={{ color:t.textFaint, fontSize:"11px" }}>{prog.done}/{prog.total} платформ</div>
                  </div>
                  <div style={{ color:prog.pct===100?"#10b981":t.textMuted, fontSize:"14px", fontWeight:700 }}>
                    {prog.pct === 100 ? "✅" : `${prog.pct}%`}
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ height:"3px", background:t.border, borderRadius:"2px", marginBottom:"12px" }}>
                  <motion.div initial={{ width:0 }} animate={{ width:`${prog.pct}%` }} transition={{ duration:0.4 }}
                    style={{ height:"100%", borderRadius:"2px", background:prog.pct===100?"#10b981":`linear-gradient(90deg,${color},${color}88)` }} />
                </div>
                {/* Platform chips */}
                <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                  {allPlatforms.map(platform => {
                    const done = isChecked(model.id, platform, dateKey);
                    return (
                      <motion.button key={platform} onClick={() => toggle(model.id, model.name, platform)}
                        whileTap={{ scale:0.94 }}
                        disabled={!canEdit}
                        style={{ display:"flex", alignItems:"center", gap:"5px", padding:"5px 10px", borderRadius:"7px", border:`1px solid ${done?"#10b981":t.border}`, background:done?"rgba(16,185,129,0.1)":t.bgCardHover, color:done?"#10b981":t.textMuted, cursor:canEdit?"pointer":"default", fontSize:"12px", fontWeight:500, transition:"all 0.15s" }}>
                        {done ? <CheckSquare size={12}/> : <Square size={12}/>}
                        {platform}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* ── WEEK VIEW ── */
        <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"16px", overflow:"hidden" }}>
          {/* Header row */}
          <div style={{ display:"grid", gridTemplateColumns:"160px repeat(7,1fr)", borderBottom:`1px solid ${t.border}` }}>
            <div style={{ padding:"10px 14px", color:t.textFaint, fontSize:"11px", fontWeight:700, textTransform:"uppercase" }}>Модель</div>
            {weekDates.map((d, i) => {
              const isT = d.toLocaleDateString("ru-RU") === todayStr;
              return (
                <div key={i} style={{ padding:"10px 8px", textAlign:"center", background:isT?"rgba(124,58,237,0.08)":"transparent", borderLeft:`1px solid ${t.border}` }}>
                  <div style={{ color:isT?"#a78bfa":t.textMuted, fontSize:"11px", fontWeight:700 }}>{DAYS_SHORT[d.getDay()]}</div>
                  <div style={{ color:isT?t.text:t.textFaint, fontSize:"13px", fontWeight:isT?700:400 }}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Model rows */}
          {visibleModels.map((model, mi) => {
            const color = model.color || "#7c3aed";
            return (
              <div key={model.id} style={{ display:"grid", gridTemplateColumns:"160px repeat(7,1fr)", borderBottom: mi<visibleModels.length-1?`1px solid ${t.border}`:"none" }}
                onMouseEnter={e => e.currentTarget.style.background=t.bgCardHover}
                onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                {/* Model name */}
                <div style={{ padding:"12px 14px", display:"flex", alignItems:"center", gap:"8px" }}>
                  <div style={{ width:"28px", height:"28px", borderRadius:"8px", background:`linear-gradient(135deg,${color},${color}88)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:model.emoji?"13px":"11px", color:"#fff", fontWeight:700, flexShrink:0 }}>
                    {model.emoji||model.name[0].toUpperCase()}
                  </div>
                  <span style={{ color:t.text, fontSize:"12px", fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{model.name}</span>
                </div>

                {/* Day cells */}
                {weekDates.map((d, di) => {
                  const dk   = d.toLocaleDateString("ru-RU");
                  const prog = getDayProgress(model.id, dk);
                  const isT  = dk === todayStr;
                  return (
                    <div key={di} onClick={() => { setSelectedDate(d); setViewMode("day"); }}
                      style={{ padding:"8px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer", borderLeft:`1px solid ${t.border}`, background:isT?"rgba(124,58,237,0.04)":"transparent" }}>
                      {prog.total > 0 && (
                        <>
                          <div style={{ color:prog.pct===100?"#10b981":prog.pct>0?"#f59e0b":t.textFaint, fontSize:"12px", fontWeight:700 }}>
                            {prog.pct === 100 ? "✅" : prog.pct > 0 ? `${prog.pct}%` : "—"}
                          </div>
                          {prog.pct > 0 && prog.pct < 100 && (
                            <div style={{ width:"28px", height:"3px", background:t.border, borderRadius:"2px", marginTop:"3px" }}>
                              <div style={{ width:`${prog.pct}%`, height:"100%", background:"#f59e0b", borderRadius:"2px" }} />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Footer totals */}
          <div style={{ display:"grid", gridTemplateColumns:"160px repeat(7,1fr)", borderTop:`1px solid ${t.border}`, background:t.bgCardHover }}>
            <div style={{ padding:"8px 14px", color:t.textFaint, fontSize:"11px", fontWeight:700, display:"flex", alignItems:"center" }}>Итого</div>
            {weekDates.map((d, i) => {
              const dk = d.toLocaleDateString("ru-RU");
              const total = visibleModels.reduce((sum, m) => sum + getDayProgress(m.id, dk).done, 0);
              const max   = visibleModels.length * allPlatforms.length;
              return (
                <div key={i} style={{ padding:"8px", textAlign:"center", borderLeft:`1px solid ${t.border}` }}>
                  <span style={{ color:total===max&&max>0?"#10b981":total>0?"#a78bfa":t.textFaint, fontSize:"12px", fontWeight:600 }}>
                    {total > 0 ? total : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
