import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, ROLE_LABELS, ROLE_COLORS, resolvePermissions } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { collection, onSnapshot, query, where, orderBy, limit, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import {
  LayoutDashboard, TrendingUp, CheckSquare, Users, BarChart3,
  Settings, LogOut, Menu, X, Bell, ChevronRight, MessageSquare,
  CalendarDays, FileText, Sun, Moon, UserCircle, Clipboard, Shield
} from "lucide-react";

// Online = lastActiveAt within 2 minutes OR isOnline flag true and lastActiveAt within 5 min
export function getOnlineStatus(user) {
  if (!user?.lastActiveAt) return "offline";
  const diff = (Date.now() - new Date(user.lastActiveAt).getTime()) / 1000;
  if (diff < 120) return "online";      // < 2 min → online
  if (diff < 600) return "away";        // < 10 min → away
  return "offline";
}

export const STATUS_COLOR = { online: "#10b981", away: "#f59e0b", offline: "#475569" };
export const STATUS_ICON  = { online: "🟢", away: "🌙", offline: "⚫" };
export const STATUS_LABEL = { online: "В сети", away: "Отошёл", offline: "Не в сети" };

const NAV = [
  { to: "/",            icon: LayoutDashboard, label: "Дашборд",    perm: "nav_dashboard"  },
  { to: "/checklist",   icon: CheckSquare,     label: "Чек-лист",   perm: "nav_checklist"  },
  { to: "/chat",        icon: MessageSquare,   label: "Чаты",       perm: "nav_chat"       },
  { to: "/schedule",    icon: CalendarDays,    label: "График",     perm: "nav_schedule"   },
  { to: "/content",     icon: FileText,        label: "Контент",    perm: "nav_content"    },
  { to: "/models",      icon: UserCircle,      label: "Модели",     perm: "nav_models"     },
  { to: "/teams",       icon: Users,           label: "Команды",    perm: "nav_team"       },
  { to: "/tasks",       icon: Clipboard,       label: "Задачи",     perm: "nav_tasks"      },
  { to: "/analytics",   icon: BarChart3,       label: "Аналитика",  perm: "nav_analytics"  },
  { to: "/team-panel",  icon: TrendingUp,      label: "Моя команда",perm: "nav_team_panel" },
];

// ── Secret Roulette ───────────────────────────────────────────────────────────
const SEG_COLORS = [
  "#7c3aed","#db2877","#0ea5e9","#10b981","#f59e0b",
  "#8b5cf6","#06b6d4","#f97316","#84cc16","#ec4899",
];

// ── Casino Roulette ────────────────────────────────────────────────────────────
const SLOTS = [
  { label: "💀 Проигрыш", mult: 0,   color: "#1e1b4b", textColor: "#ef4444", prob: 30 },
  { label: "💀 Проигрыш", mult: 0,   color: "#1e1b4b", textColor: "#ef4444", prob: 25 },
  { label: "✨ ×2",       mult: 2,   color: "#7c3aed", textColor: "#fff",    prob: 18 },
  { label: "💀 Проигрыш", mult: 0,   color: "#1e1b4b", textColor: "#ef4444", prob: 10 },
  { label: "💎 ×3",       mult: 3,   color: "#0ea5e9", textColor: "#fff",    prob: 8  },
  { label: "💀 Проигрыш", mult: 0,   color: "#1e1b4b", textColor: "#ef4444", prob: 4  },
  { label: "🔥 ×5",       mult: 5,   color: "#f97316", textColor: "#fff",    prob: 3  },
  { label: "💀 Проигрыш", mult: 0,   color: "#1e1b4b", textColor: "#ef4444", prob: 1  },
  { label: "👑 ×10",      mult: 10,  color: "#db2877", textColor: "#fff",    prob: 0.7},
  { label: "🎰 ДЖЕКПОТ",  mult: 50,  color: "#f59e0b", textColor: "#000",    prob: 0.3},
];

// Build wheel segments from probability weights
const buildWheel = () => {
  const wheel = [];
  SLOTS.forEach(slot => {
    const count = Math.max(1, Math.round(slot.prob));
    for (let i = 0; i < count; i++) wheel.push(slot);
  });
  // Shuffle
  for (let i = wheel.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wheel[i], wheel[j]] = [wheel[j], wheel[i]];
  }
  return wheel;
};

// ── CASINO SLOTS ──────────────────────────────────────────────────────────────
const SYMBOLS = [
  { id: "seven",   emoji: "7️⃣",  label: "7",       color: "#ef4444", weight: 2  },
  { id: "diamond", emoji: "💎",  label: "DIAMOND", color: "#0ea5e9", weight: 4  },
  { id: "crown",   emoji: "👑",  label: "CROWN",   color: "#f59e0b", weight: 5  },
  { id: "star",    emoji: "⭐",  label: "STAR",    color: "#a78bfa", weight: 8  },
  { id: "cherry",  emoji: "🍒",  label: "CHERRY",  color: "#db2877", weight: 10 },
  { id: "lemon",   emoji: "🍋",  label: "LEMON",   color: "#84cc16", weight: 12 },
  { id: "grape",   emoji: "🍇",  label: "GRAPE",   color: "#8b5cf6", weight: 13 },
  { id: "bell",    emoji: "🔔",  label: "BELL",    color: "#f97316", weight: 14 },
  { id: "skull",   emoji: "💀",  label: "SKULL",   color: "#475569", weight: 15 },
];

const PAYOUTS = {
  seven:   { x3: 100, x2: 10 },
  diamond: { x3: 50,  x2: 7  },
  crown:   { x3: 30,  x2: 5  },
  star:    { x3: 20,  x2: 4  },
  cherry:  { x3: 15,  x2: 3  },
  lemon:   { x3: 12,  x2: 2  },
  grape:   { x3: 10,  x2: 0  },
  bell:    { x3: 6,   x2: 0  },
  skull:   { x3: 0,   x2: 0  },
};

const POOL = [];
SYMBOLS.forEach(s => { for (let i = 0; i < s.weight; i++) POOL.push(s); });
const randSym = () => POOL[Math.floor(Math.random() * POOL.length)];

const calcResult = (reels) => {
  const ids = reels.map(r => r.id);
  if (ids[0] === ids[1] && ids[1] === ids[2]) {
    const mult = PAYOUTS[ids[0]]?.x3 || 0;
    return { mult, type: mult > 0 ? "triple" : "lose", sym: reels[0] };
  }
  if (ids[0] === ids[1] || ids[1] === ids[2]) {
    const matchId = ids[0] === ids[1] ? ids[0] : ids[1];
    const mult = PAYOUTS[matchId]?.x2 || 0;
    return { mult, type: mult > 0 ? "pair" : "lose", sym: SYMBOLS.find(s => s.id === matchId) };
  }
  return { mult: 0, type: "lose", sym: null };
};

const SLOT_KEY    = "inferyx_slots_balance";
const SLOT_BONUS  = "inferyx_slots_lastbonus";
const SLOT_SCORES = "inferyx_slots_scores";
const BONUS_COINS = 50;
const BONUS_HOURS = 1;

function SecretSlots({ t }) {
  const { user, profile } = useAuth();
  const { db } = useAuth();

  const [open, setOpen]         = useState(false);
  const [hovered, setHovered]   = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult]     = useState(null);
  const [bet, setBet]           = useState(100);
  const [flash, setFlash]       = useState(null);
  const [raining, setRaining]   = useState(false);
  const [bonusMsg, setBonusMsg] = useState("");
  const [nextBonus, setNextBonus] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);

  // Balance persisted in localStorage per user
  const balanceKey = user?.uid ? `${SLOT_KEY}_${user.uid}` : SLOT_KEY;
  const bonusKey   = user?.uid ? `${SLOT_BONUS}_${user.uid}` : SLOT_BONUS;

  const [balance, setBalanceState] = useState(() => {
    const saved = localStorage.getItem(balanceKey);
    return saved ? parseInt(saved) : 1000;
  });
  const [history, setHistory] = useState([]);

  const setBalance = (fn) => {
    setBalanceState(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      localStorage.setItem(balanceKey, String(next));
      return next;
    });
  };

  // Hourly bonus
  useEffect(() => {
    const checkBonus = () => {
      const last = parseInt(localStorage.getItem(bonusKey) || "0");
      const now  = Date.now();
      const diff = now - last;
      const needed = BONUS_HOURS * 60 * 60 * 1000;
      if (diff >= needed) {
        setNextBonus(null);
      } else {
        const remaining = needed - diff;
        setNextBonus(remaining);
      }
    };
    checkBonus();
    const interval = setInterval(checkBonus, 30000);
    return () => clearInterval(interval);
  }, [bonusKey]);

  const claimBonus = () => {
    const last = parseInt(localStorage.getItem(bonusKey) || "0");
    const diff = Date.now() - last;
    if (diff < BONUS_HOURS * 60 * 60 * 1000) return;
    localStorage.setItem(bonusKey, String(Date.now()));
    setBalance(b => b + BONUS_COINS);
    setBonusMsg(`+${BONUS_COINS} 🪙 бонус получен!`);
    setNextBonus(BONUS_HOURS * 60 * 60 * 1000);
    setTimeout(() => setBonusMsg(""), 3000);
  };

  // Save score to Firestore + load leaderboard
  const saveScore = async (newBalance) => {
    if (!db || !user?.uid) return;
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "slots_scores", user.uid), {
        name: profile?.name || "—",
        role: profile?.role || "",
        avatarEmoji: profile?.avatarEmoji || "",
        avatarColor: profile?.avatarColor || "#7c3aed",
        balance: newBalance,
        updatedAt: new Date().toISOString(),
      });
    } catch {}
  };

  useEffect(() => {
    if (!db) return;
    const loadLeaderboard = async () => {
      try {
        const { collection, onSnapshot, orderBy, query } = await import("firebase/firestore");
        return onSnapshot(
          query(collection(db, "slots_scores"), orderBy("balance", "desc")),
          snap => setLeaderboard(snap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, 10))
        );
      } catch {}
    };
    loadLeaderboard().then(unsub => { if (unsub) return () => unsub(); });
  }, [db]);

  // Reel displays
  const [reelDisplays, setReelDisplays] = useState([
    [SYMBOLS[8], SYMBOLS[4], SYMBOLS[6]],
    [SYMBOLS[4], SYMBOLS[6], SYMBOLS[8]],
    [SYMBOLS[6], SYMBOLS[8], SYMBOLS[4]],
  ]);
  const animRef     = useRef(null);
  const confRef     = useRef([]);
  const confCanvasRef = useRef(null);
  const [confActive, setConfActive] = useState(false);

  const doSpin = () => {
    if (spinning || bet > balance || bet <= 0) return;
    setBalance(b => b - bet);
    setResult(null); setFlash(null);
    setSpinning(true);

    const finals  = [randSym(), randSym(), randSym()];
    const strips  = finals.map(final => {
      const strip = Array.from({ length: 32 }, () => randSym());
      strip[strip.length - 1] = final;
      return strip;
    });

    let frameCount = 0;
    const STOP_AT  = [40, 52, 64];
    const indexes  = [0, 0, 0];

    const animate = () => {
      frameCount++;
      setReelDisplays(() => {
        const next = [[], [], []];
        for (let r = 0; r < 3; r++) {
          if (frameCount < STOP_AT[r]) {
            const speed = Math.max(1, Math.floor((STOP_AT[r] - frameCount) / 10));
            if (frameCount % Math.max(1, Math.floor(speed * 0.3)) === 0) {
              indexes[r] = (indexes[r] + 1) % strips[r].length;
            }
            const i = strips[r].length;
            next[r] = [
              strips[r][(indexes[r] + strips[r].length - 1) % strips[r].length],
              strips[r][indexes[r]],
              strips[r][(indexes[r] + 1) % strips[r].length],
            ];
          } else {
            next[r] = [
              strips[r][strips[r].length - 2] || SYMBOLS[0],
              finals[r],
              strips[r][strips[r].length - 3] || SYMBOLS[1],
            ];
          }
        }
        return next;
      });

      if (frameCount < STOP_AT[2] + 6) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        const res    = calcResult(finals);
        const payout = Math.round(bet * res.mult);
        setBalance(b => {
          const newBal = b + payout;
          saveScore(newBal);
          return newBal;
        });
        setResult({ ...res, payout, bet });
        setHistory(h => [{ finals, payout, bet, type: res.type, time: new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}) }, ...h].slice(0, 10));

        if (res.type === "triple" && res.mult >= 30) {
          setFlash("jackpot"); setRaining(true);
          setTimeout(() => setRaining(false), 4000);
        } else if (res.type !== "lose") {
          setFlash("win");
        } else {
          setFlash("lose");
        }
        setTimeout(() => setFlash(null), 2000);

        if (res.type !== "lose") {
          confRef.current = Array.from({ length: res.mult >= 30 ? 200 : 80 }, () => ({
            x: Math.random() * window.innerWidth, y: -20 - Math.random() * 80,
            vx: (Math.random()-0.5)*(res.mult>=30?12:6), vy: 2+Math.random()*5,
            w: 6+Math.random()*10, h: 4+Math.random()*6,
            color: ["#f59e0b","#7c3aed","#db2877","#10b981","#0ea5e9","#fff","#fbbf24"][Math.floor(Math.random()*7)],
            rot: Math.random()*Math.PI*2, rotV: (Math.random()-0.5)*0.2, opacity: 1,
          }));
          setConfActive(true);
          setTimeout(() => setConfActive(false), res.mult>=30?5000:2500);
        }
      }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (!confActive) return;
    const canvas = confCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      confRef.current.forEach(p => {
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.1; p.rot+=p.rotV;
        if (p.y > canvas.height*0.8) p.opacity -= 0.02;
        ctx.save(); ctx.globalAlpha=Math.max(0,p.opacity);
        ctx.translate(p.x,p.y); ctx.rotate(p.rot);
        ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
        ctx.restore();
      });
      confRef.current = confRef.current.filter(p => p.opacity > 0);
      if (confRef.current.length > 0) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => { alive = false; };
  }, [confActive]);

  const canSpin = !spinning && bet > 0 && bet <= balance;
  const canBonus = nextBonus === null;

  const fmtTime = (ms) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}м ${s}с`;
  };

  const flashStyle = flash === "jackpot"
    ? { boxShadow:"0 0 60px rgba(245,158,11,0.4), inset 0 0 40px rgba(245,158,11,0.15)" }
    : flash === "win"
    ? { boxShadow:"0 0 40px rgba(124,58,237,0.3), inset 0 0 30px rgba(124,58,237,0.1)" }
    : flash === "lose"
    ? { boxShadow:"0 0 30px rgba(239,68,68,0.2), inset 0 0 20px rgba(239,68,68,0.08)" }
    : {};

  return (
    <>
      {confActive && <canvas ref={confCanvasRef} style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:9999 }} />}

      {raining && (
        <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:9998,overflow:"hidden" }}>
          {Array.from({length:16}).map((_,i) => (
            <div key={i} style={{ position:"absolute",top:"-60px",left:`${5+i*6}%`,fontSize:`${20+Math.random()*20}px`,animation:`fall ${1.5+Math.random()*2}s linear ${Math.random()*1.5}s forwards`,opacity:0.9 }}>
              {SYMBOLS[Math.floor(Math.random()*4)].emoji}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes fall { 0%{transform:translateY(0) rotate(0);opacity:.9} 100%{transform:translateY(110vh) rotate(540deg);opacity:0} }
        @keyframes slotBounce { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
        @keyframes glowPulse { 0%,100%{opacity:.7} 50%{opacity:1;filter:brightness(1.3)} }
        @keyframes shakeX { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
        @keyframes jackpotPulse { 0%,100%{box-shadow:0 0 20px rgba(245,158,11,0.4)} 50%{box-shadow:0 0 60px rgba(245,158,11,0.8),inset 0 0 30px rgba(245,158,11,0.2)} }
      `}</style>

      {/* Secret trigger */}
      <div onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
        onClick={()=>{setOpen(true);setResult(null);setFlash(null);}}
        style={{ position:"fixed",right:0,top:"50%",transform:"translateY(-50%)",width:hovered?"44px":"6px",height:"80px",borderRadius:"12px 0 0 12px",background:hovered?"linear-gradient(135deg,#f59e0b,#ef4444)":"rgba(245,158,11,0.25)",cursor:"pointer",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.25s cubic-bezier(0.34,1.56,0.64,1)",boxShadow:hovered?"0 0 24px rgba(245,158,11,0.6)":"none",overflow:"hidden" }}>
        {hovered && <span style={{fontSize:"22px",userSelect:"none"}}>🎰</span>}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            onClick={()=>!spinning&&setOpen(false)}
            style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
            <motion.div initial={{scale:0.85,opacity:0,y:30}} animate={{scale:1,opacity:1,y:0}} exit={{scale:0.85,opacity:0,y:30}}
              transition={{type:"spring",stiffness:260,damping:22}}
              onClick={e=>e.stopPropagation()}
              style={{background:"linear-gradient(160deg,#09050f,#140a2a,#09050f)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:"28px",padding:"24px 24px 20px",width:"100%",maxWidth:"700px",transition:"box-shadow 0.3s",...flashStyle,animation:flash==="lose"?"shakeX 0.4s ease":flash==="jackpot"?"jackpotPulse 0.5s ease 4":"none"}}>

              {/* Header */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"18px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                  <div style={{width:"44px",height:"44px",borderRadius:"14px",background:"linear-gradient(135deg,#f59e0b,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"24px",boxShadow:"0 4px 20px rgba(245,158,11,0.5)",animation:spinning?"slotBounce 0.3s infinite":"none"}}>🎰</div>
                  <div>
                    <div style={{color:"#fff",fontSize:"20px",fontWeight:900,letterSpacing:"3px",textShadow:"0 0 20px rgba(245,158,11,0.5)"}}>SLOTS</div>
                    <div style={{color:"rgba(245,158,11,0.4)",fontSize:"10px",letterSpacing:"1px"}}>КОМАНДА CASINO · ТОЛЬКО ДЛЯ РАЗВЛЕЧЕНИЯ</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                  {/* Balance */}
                  <div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:"12px",padding:"6px 14px",textAlign:"center"}}>
                    <div style={{color:"rgba(255,255,255,0.3)",fontSize:"9px",fontWeight:700,textTransform:"uppercase",letterSpacing:"1px"}}>БАЛАНС</div>
                    <div style={{color:"#f59e0b",fontSize:"20px",fontWeight:900}}>🪙 {balance.toLocaleString()}</div>
                  </div>
                  {/* Rating toggle */}
                  <button onClick={()=>setShowRating(r=>!r)}
                    style={{background:showRating?"rgba(124,58,237,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${showRating?"rgba(124,58,237,0.4)":"rgba(255,255,255,0.08)"}`,color:showRating?"#a78bfa":"rgba(255,255,255,0.3)",borderRadius:"10px",padding:"6px 12px",cursor:"pointer",fontSize:"12px",fontWeight:700}}>
                    🏆 Рейтинг
                  </button>
                  <button onClick={()=>!spinning&&setOpen(false)}
                    style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.3)",borderRadius:"10px",width:"34px",height:"34px",cursor:"pointer",fontSize:"18px",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                </div>
              </div>

              {/* Bonus bar */}
              <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"16px",padding:"8px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"12px"}}>
                <span style={{fontSize:"16px"}}>🎁</span>
                <span style={{color:"rgba(255,255,255,0.4)",fontSize:"12px",flex:1}}>
                  {canBonus ? "Бесплатные монеты доступны!" : `Следующий бонус через ${fmtTime(nextBonus||0)}`}
                </span>
                {bonusMsg && <span style={{color:"#10b981",fontSize:"12px",fontWeight:700}}>{bonusMsg}</span>}
                <button onClick={claimBonus} disabled={!canBonus}
                  style={{background:canBonus?"linear-gradient(135deg,#10b981,#059669)":"rgba(255,255,255,0.05)",border:"none",color:canBonus?"#fff":"rgba(255,255,255,0.2)",borderRadius:"8px",padding:"6px 14px",cursor:canBonus?"pointer":"not-allowed",fontSize:"12px",fontWeight:700,transition:"all 0.2s",boxShadow:canBonus?"0 0 12px rgba(16,185,129,0.4)":"none"}}>
                  +{BONUS_COINS} 🪙
                </button>
              </div>

              <div style={{display:"grid",gridTemplateColumns:showRating?"1fr 200px":"1fr 210px",gap:"16px"}}>
                {/* Left: machine */}
                <div>
                  {/* Reels */}
                  <div style={{background:"linear-gradient(180deg,#1a0f2e,#0f0720)",border:"2px solid rgba(245,158,11,0.25)",borderRadius:"18px",padding:"16px 12px",marginBottom:"14px",boxShadow:"inset 0 4px 20px rgba(0,0,0,0.5)"}}>
                    {/* Winline label */}
                    <div style={{display:"flex",justifyContent:"center",marginBottom:"8px"}}>
                      <div style={{background:flash==="jackpot"?"rgba(245,158,11,0.2)":flash==="win"?"rgba(124,58,237,0.12)":"rgba(255,255,255,0.04)",border:`1px solid ${flash==="jackpot"?"rgba(245,158,11,0.5)":flash==="win"?"rgba(124,58,237,0.35)":"rgba(255,255,255,0.07)"}`,borderRadius:"20px",padding:"2px 14px",fontSize:"10px",fontWeight:700,letterSpacing:"1px",color:flash==="jackpot"?"#f59e0b":flash==="win"?"#a78bfa":"rgba(255,255,255,0.2)"}}>
                        {flash==="jackpot"?"★ JACKPOT ★":flash==="win"?"▶ WIN ◀":"— WIN LINE —"}
                      </div>
                    </div>

                    {/* 3 reels */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",position:"relative"}}>
                      {/* win line highlight */}
                      <div style={{position:"absolute",top:"50%",left:"-4px",right:"-4px",height:"2px",transform:"translateY(-50%)",background:flash==="jackpot"?"rgba(245,158,11,0.7)":flash==="win"?"rgba(124,58,237,0.6)":"rgba(255,255,255,0.05)",zIndex:10,pointerEvents:"none",transition:"background 0.3s"}} />

                      {reelDisplays.map((reel, ri) => (
                        <div key={ri} style={{background:"linear-gradient(180deg,#06030f,#0d0820,#06030f)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"12px",overflow:"hidden",height:"200px",display:"flex",flexDirection:"column",position:"relative"}}>
                          {/* fade top */}
                          <div style={{position:"absolute",top:0,left:0,right:0,height:"44px",background:"linear-gradient(180deg,rgba(6,3,15,0.97),transparent)",zIndex:2,pointerEvents:"none"}} />
                          {/* fade bottom */}
                          <div style={{position:"absolute",bottom:0,left:0,right:0,height:"44px",background:"linear-gradient(0deg,rgba(6,3,15,0.97),transparent)",zIndex:2,pointerEvents:"none"}} />

                          {reel.map((sym, si) => {
                            const isCenter = si === 1;
                            const isWin = isCenter && !spinning && result?.type !== "lose" && result?.sym?.id === sym.id;
                            const isTriple = isWin && result?.type === "triple";
                            return (
                              <div key={si} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",borderBottom:si<reel.length-1?"1px solid rgba(255,255,255,0.04)":"none",background:isWin?`${sym.color}12`:"transparent",transition:"background 0.3s"}}>
                                <div style={{fontSize:"38px",lineHeight:1,filter:isWin?`drop-shadow(0 0 10px ${sym.color})`:isCenter?"none":"brightness(0.35)",transition:"all 0.3s",animation:isTriple?"glowPulse 0.7s ease-in-out infinite":"none"}}>
                                  {sym.emoji}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bet + Spin row */}
                  <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                    <div style={{display:"flex",gap:"4px",flex:1}}>
                      {[25,50,100,250,500].map(v => (
                        <button key={v} onClick={()=>setBet(Math.min(v,balance))}
                          style={{flex:1,padding:"8px 2px",borderRadius:"9px",border:`2px solid ${bet===v?"rgba(245,158,11,0.55)":"rgba(255,255,255,0.06)"}`,background:bet===v?"rgba(245,158,11,0.15)":"rgba(255,255,255,0.03)",color:bet===v?"#f59e0b":"rgba(255,255,255,0.3)",fontSize:"12px",fontWeight:800,cursor:"pointer",transition:"all 0.15s",boxShadow:bet===v?"0 0 8px rgba(245,158,11,0.2)":"none"}}>
                          {v}
                        </button>
                      ))}
                    </div>
                    <motion.button onClick={doSpin} disabled={!canSpin}
                      whileHover={canSpin?{scale:1.05}:{}} whileTap={canSpin?{scale:0.95}:{}}
                      style={{padding:"10px 24px",borderRadius:"12px",border:"none",cursor:canSpin?"pointer":"not-allowed",background:spinning?"rgba(124,58,237,0.25)":canSpin?"linear-gradient(135deg,#f59e0b,#ef4444)":"rgba(255,255,255,0.05)",color:"#fff",fontSize:"15px",fontWeight:900,letterSpacing:"1px",boxShadow:canSpin&&!spinning?"0 4px 20px rgba(245,158,11,0.4),inset 0 1px 0 rgba(255,255,255,0.2)":"none",transition:"all 0.2s",minWidth:"90px"}}>
                      {spinning?"⏳":balance===0?"💸":"SPIN"}
                    </motion.button>
                  </div>

                  {balance === 0 && (
                    <button onClick={()=>{setBalance(1000);setHistory([]);setResult(null);}}
                      style={{width:"100%",marginTop:"10px",padding:"9px",borderRadius:"10px",border:"1px solid rgba(16,185,129,0.3)",background:"rgba(16,185,129,0.08)",color:"#10b981",fontSize:"13px",fontWeight:600,cursor:"pointer"}}>
                      ↺ Начать заново · 1000 монет
                    </button>
                  )}
                </div>

                {/* Right panel */}
                {showRating ? (
                  /* Leaderboard */
                  <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"16px",padding:"14px"}}>
                    <div style={{color:"#f59e0b",fontSize:"12px",fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"10px",textAlign:"center"}}>🏆 Топ игроков</div>
                    {leaderboard.length === 0 ? (
                      <div style={{color:"rgba(255,255,255,0.2)",fontSize:"12px",textAlign:"center",padding:"20px"}}>Нет данных</div>
                    ) : leaderboard.map((e, i) => {
                      const medals = ["🥇","🥈","🥉"];
                      const rc = e.avatarColor || "#7c3aed";
                      return (
                        <div key={e.id} style={{display:"flex",alignItems:"center",gap:"7px",padding:"7px 8px",borderRadius:"9px",background:i===0?"rgba(245,158,11,0.07)":"transparent",marginBottom:"4px"}}>
                          <span style={{fontSize:"13px",width:"18px",textAlign:"center"}}>{medals[i]||`${i+1}.`}</span>
                          <div style={{width:"24px",height:"24px",borderRadius:"7px",background:`linear-gradient(135deg,${rc},${rc}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:e.avatarEmoji?"12px":"10px",fontWeight:700,color:"#fff",flexShrink:0}}>
                            {e.avatarEmoji||(e.name||"?")[0].toUpperCase()}
                          </div>
                          <div style={{flex:1,minWidth:0,color:"rgba(255,255,255,0.7)",fontSize:"12px",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.name}</div>
                          <div style={{color:i===0?"#f59e0b":"rgba(255,255,255,0.4)",fontSize:"12px",fontWeight:700,flexShrink:0}}>🪙{e.balance?.toLocaleString()}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                    {/* Result */}
                    <AnimatePresence mode="wait">
                      {result && !spinning && (
                        <motion.div key={result.payout+result.bet+result.type}
                          initial={{opacity:0,scale:0.85,y:-8}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.9}}
                          style={{background:result.type==="lose"?"rgba(239,68,68,0.07)":result.mult>=30?"rgba(245,158,11,0.1)":"rgba(124,58,237,0.09)",border:`2px solid ${result.type==="lose"?"rgba(239,68,68,0.22)":result.mult>=30?"rgba(245,158,11,0.4)":"rgba(124,58,237,0.3)"}`,borderRadius:"14px",padding:"14px",textAlign:"center"}}>
                          <div style={{fontSize:"26px",marginBottom:"5px"}}>
                            {result.type==="lose"?"💀":result.mult>=100?"🎊":result.mult>=30?"🤑":result.mult>=10?"🔥":"✨"}
                          </div>
                          <div style={{fontSize:"13px",fontWeight:800,letterSpacing:"1px",marginBottom:"4px",color:result.type==="lose"?"#ef4444":result.mult>=30?"#f59e0b":"#a78bfa"}}>
                            {result.type==="triple"?"ТРОЙКА!":result.type==="pair"?"ПАРА!":"ПРОИГРЫШ"}
                          </div>
                          {result.payout>0
                            ? <div style={{color:"#10b981",fontSize:"19px",fontWeight:900}}>+{result.payout} 🪙</div>
                            : <div style={{color:"rgba(255,255,255,0.2)",fontSize:"13px"}}>−{result.bet} 🪙</div>
                          }
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Paytable — fixed: emoji and multiplier separated */}
                    <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"14px",padding:"12px",flex:1}}>
                      <div style={{color:"rgba(255,255,255,0.25)",fontSize:"10px",fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"8px"}}>Выплаты (ставка × коэф.)</div>
                      <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
                        {SYMBOLS.map((sym) => {
                          const p = PAYOUTS[sym.id];
                          if (!p || (p.x3===0&&p.x2===0)) return null;
                          return (
                            <div key={sym.id} style={{display:"grid",gridTemplateColumns:"60px 1fr",alignItems:"center",gap:"6px",padding:"3px 4px",borderRadius:"6px"}}>
                              {/* Emoji row — separated from text */}
                              <div style={{display:"flex",gap:"1px"}}>
                                <span style={{fontSize:"14px",lineHeight:1}}>{sym.emoji}</span>
                                <span style={{fontSize:"14px",lineHeight:1}}>{sym.emoji}</span>
                                <span style={{fontSize:"14px",lineHeight:1}}>{sym.emoji}</span>
                              </div>
                              {/* Multipliers */}
                              <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                                <span style={{color:sym.color,fontSize:"11px",fontWeight:800}}>×{p.x3}</span>
                                {p.x2>0&&<span style={{color:"rgba(255,255,255,0.25)",fontSize:"10px"}}>{sym.emoji}{sym.emoji}=×{p.x2}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* History */}
                    {history.length>0&&(
                      <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:"12px",padding:"10px"}}>
                        <div style={{color:"rgba(255,255,255,0.2)",fontSize:"10px",fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"6px"}}>История</div>
                        {history.slice(0,5).map((h,i)=>(
                          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0",borderBottom:i<Math.min(history.length,5)-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
                            <div style={{display:"flex",gap:"2px"}}>
                              {h.finals.map((s,j)=><span key={j} style={{fontSize:"13px"}}>{s.emoji}</span>)}
                            </div>
                            <span style={{color:h.payout>0?"#10b981":"#ef4444",fontSize:"12px",fontWeight:700}}>
                              {h.payout>0?`+${h.payout}`:`-${h.bet}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Logo Easter Egg ───────────────────────────────────────────────────────────
function LogoEasterEgg() {
  const [horns, setHorns] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [showPhrase, setShowPhrase] = useState(false);
  const timerRef = useRef(null);
  const phraseTimerRef = useRef(null);

  const PHRASES = [
    // Иди работай
    "иди работай бро 💀",
    "серьёзно? опять сюда?",
    "это не кнопка денег",
    "ну и зачем ты это",
    "окей стоп хватит",
    "тебе норм вообще?",
    "это уже третий раз",
    "ладно не осуждаю",
    "go post something",
    "редит себя не постит",
    "модели ждут а ты тут",
    "дедлайн ближе чем кажется",
    "touch grass потом сюда",
    "твой тим лид всё видит 👁",
    "стата не растёт от этого",
    "закрой и иди работать",
    "ладно отдохнул? постить",
    "стоп. открой чеклист",
    "реально? ок понял тебя",
    "иди. работать. сейчас",
    // Мотивация
    "lets go 🔥",
    "грайндим братишка",
    "деньги сами не придут",
    "сегодня твой день fr",
    "один пост ближе к цели",
    "команда рассчитывает",
    "сделай сейчас",
    "тихий режим = деньги",
    "фокус и всё получится",
    "ещё немного — результат",
    "работаем пока спят",
    "ты ближе чем думаешь",
    "не останавливайся",
    "маленький шаг — успех",
    "не сегодня лень",
    "победа любит готовых",
    "каждый пост на счету",
    "ты справишься 💪",
    // Про сферу
    "редит не спит и ты",
    "трафик себя не нагонит",
    "подписчики ждут",
    "конкуренты уже постят",
    "rpm себя не поднимет",
    "ctr растёт от постов",
    "выручка любит активность",
    "кто постит тот ест",
    "алгоритм любит регулярность",
    "топ суб не покорится сам",
    "посты = деньги. просто",
    "апвоуты не придут сами",
    "пора в чеклист",
    "каждый апвоут = клиент",
    "трафик = деньги",
    // Про inferyx
    "inferyx: работай",
    "это для работы, не кликов",
    "инфериксу нравится труд",
    "нажми на задачи лучше",
    "логотип не даёт доход",
    "inferyx > прокрастинация",
    "система ок. ты нет",
    "инферикс смотрит 👁",
    "v3.0 а ты всё здесь?",
    "посты = деньги. не клики",
    "разраб устал от тебя",
    "inferyx говорит: постить",
    "нашёл пасхалку. иди работай",
    "секрет: иди постить",
    // Абсурд
    "404: мотивация недоступна",
    "нажми f5 на себя",
    "error: слишком много кликов",
    "загружаю мотивацию... 0%",
    "секретная кнопка. и что?",
    "это не читкод",
    "achievement: прокрастинатор",
    "я не против честно",
    "хоть не тикток листаешь",
    "окей ты победил. постить",
    "поздравляю нашёл кота 🐱",
    "рожки — это стиль",
    // Повседневные
    "как дела? теперь работай",
    "кстати как чеклист?",
    "кофе выпил? постить",
    "пятница но посты важнее",
    "ночная смена — лучшая",
    "выспался? работать",
    "телефон отложи",
    "пять минут прошло",
    "ладно ещё пять минут",
    "не забудь выйти на смену",
    "тим лид уже написал",
    "проверь уведомления",
    "чат не читал? там важное",
    // С отсылками
    "winter arc 🥶",
    "glow up с постов",
    "no days off fr",
    "stay on your grind",
    "lets get this bread 🍞",
    "we move только вперёд",
    "main character не ленится",
    "боковой персонаж — не ты?",
    "sigma не кликает дважды",
    "rizz без постов — ничто",
    "npc кликают. ты не npc",
    "speedrun дня начался",
    "achievement: нашёл пасхалку",
    // Короткие удары
    "нет.",
    "стоп.",
    "работай.",
    "серьёзно.",
    "ладно.",
    "окей бро.",
    "хм.",
    "ну...",
    "эй.",
    "постить.",
    "чеклист.",
    "деньги.",
    "трафик.",
    "вперёд.",
    "go.",
    "fr.",
    "бро.",
    "стат?",
    "посты?",
    "план?",
  ];


  const handleClick = () => {
    const random = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    setPhrase(random);
    setHorns(true);
    setShowPhrase(true);

    // Meow sound via Web Audio
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const t = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      filter.type = "bandpass";
      filter.frequency.value = 1200;
      filter.Q.value = 8;

      // Мяу — характерный подъём и спуск
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(900, t + 0.1);
      osc.frequency.exponentialRampToValueAtTime(600, t + 0.25);
      osc.frequency.exponentialRampToValueAtTime(450, t + 0.4);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.03);
      gain.gain.setValueAtTime(0.15, t + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

      osc.start(t);
      osc.stop(t + 0.5);
    } catch {}

    clearTimeout(timerRef.current);
    clearTimeout(phraseTimerRef.current);
    timerRef.current = setTimeout(() => setHorns(false), 2000);
    phraseTimerRef.current = setTimeout(() => setShowPhrase(false), 2500);
  };

  useEffect(() => () => {
    clearTimeout(timerRef.current);
    clearTimeout(phraseTimerRef.current);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <motion.div
        onClick={handleClick}
        whileTap={{ scale: 0.92 }}
        style={{ cursor: "pointer", userSelect: "none", display: "flex", alignItems: "baseline", gap: "5px" }}>

        <AnimatePresence>
          {horns && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
              style={{ position: "absolute", top: "-11px", left: "2px", display: "flex", gap: "38px", pointerEvents: "none" }}>
              <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderBottom: "10px solid #db2877", transform: "rotate(-12deg)" }} />
              <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderBottom: "10px solid #7c3aed", transform: "rotate(12deg)" }} />
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.5px", background: "linear-gradient(135deg, #7c3aed, #db2877)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shimmer 4s linear infinite" }}>
          INFERYX
        </div>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "#475569", letterSpacing: "0.5px" }}>v3.0</span>
      </motion.div>

      <AnimatePresence>
        {showPhrase && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            style={{
              position: "absolute", top: "28px", left: 0,
              color: "#6366f1", fontSize: "11px", fontWeight: 600,
              whiteSpace: "nowrap", pointerEvents: "none",
              maxWidth: "210px", overflow: "hidden",
              textOverflow: "ellipsis", lineHeight: 1.3,
            }}>
            {phrase}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Layout({ children }) {
  const { profile, logout, user, db } = useAuth();
  const { mode, toggle, theme } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [liveProfile, setLiveProfile] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastSeen, setLastSeen] = useState(null);
  const notifRef = useRef(null);

  // ── Presence heartbeat ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !db) return;

    const updatePresence = async (status = "online") => {
      try {
        const snap = await import("firebase/firestore").then(m =>
          m.getDocs(m.query(m.collection(db, "users"), m.where("uid", "==", user.uid)))
        );
        if (!snap.empty) {
          const userDoc = snap.docs[0];
          await import("firebase/firestore").then(m =>
            m.updateDoc(m.doc(db, "users", userDoc.id), {
              lastActiveAt: new Date().toISOString(),
              isOnline: status === "online",
            })
          );
        }
      } catch {}
    };

    // Set online immediately
    updatePresence("online");

    // Heartbeat every 30s
    const interval = setInterval(() => updatePresence("online"), 30000);

    // Set offline on tab close/hide
    const handleOffline = () => updatePresence("offline");
    window.addEventListener("beforeunload", handleOffline);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") updatePresence("offline");
      else updatePresence("online");
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleOffline);
      updatePresence("offline");
    };
  }, [user?.uid, db]);

  // Live profile
  useEffect(() => {
    if (!user?.uid || !db) return;
    const unsub = onSnapshot(collection(db, "users"), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllUsers(docs);
      const found = docs.find(d => d.uid === user.uid || d.id === user.uid);
      if (found) setLiveProfile(found);
    });
    return () => unsub();
  }, [db, user?.uid]);

  // Load last seen timestamp
  useEffect(() => {
    if (!user?.uid || !db) return;
    const loadLastSeen = async () => {
      try {
        const ref = doc(db, "notification_seen", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) setLastSeen(snap.data().seenAt);
        else setLastSeen(new Date(0).toISOString());
      } catch (e) { setLastSeen(new Date(0).toISOString()); }
    };
    loadLastSeen();
  }, [db, user?.uid]);

  // Watch tasks assigned to me
  useEffect(() => {
    if (!user?.uid || !db) return;
    const unsub = onSnapshot(collection(db, "tasks"), snap => {
      const myTasks = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(t => t.assigneeId === (liveProfile?.id || user.uid) || t.userId === user.uid)
        .filter(t => t.column !== "done")
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

      setNotifications(prev => {
        const chatNotifs = prev.filter(n => n.type === "chat");
        const taskNotifs = myTasks.map(t => ({
          id: `task_${t.id}`,
          type: "task",
          title: t.title,
          sub: `Приоритет: ${{ low: "Низкий", medium: "Средний", high: "Высокий", urgent: "🚨 Срочно" }[t.priority] || t.priority}`,
          icon: "📋",
          createdAt: t.createdAt,
          link: "/tasks",
        }));
        return [...taskNotifs, ...chatNotifs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      });
    });
    return () => unsub();
  }, [db, user?.uid, liveProfile]);

  // Watch chat messages in rooms I'm in
  useEffect(() => {
    if (!user?.uid || !db) return;
    const unsub = onSnapshot(collection(db, "rooms"), snap => {
      const myRooms = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => r.type === "public" || r.createdBy === user.uid || (r.members && r.members.includes(user.uid)));

      const chatNotifs = myRooms
        .filter(r => r.lastMessage && r.lastMessageUser !== (liveProfile?.name || ""))
        .map(r => ({
          id: `chat_${r.id}`,
          type: "chat",
          title: r.lastMessageUser || "—",
          sub: r.lastMessage?.slice(0, 50) + (r.lastMessage?.length > 50 ? "..." : ""),
          icon: "💬",
          roomName: r.name,
          createdAt: r.lastMessageTime || new Date(0).toISOString(),
          link: "/chat",
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

      setNotifications(prev => {
        const taskNotifs = prev.filter(n => n.type === "task");
        return [...taskNotifs, ...chatNotifs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      });
    });
    return () => unsub();
  }, [db, user?.uid, liveProfile]);

  // Count unread

  // Watch problem notifications (for owners/admins)
  useEffect(() => {
    if (!user?.uid || !db) return;
    const role = liveProfile?.role;
    if (!["owner","admin"].includes(role)) return;

    const unsub = onSnapshot(
      query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(20)),
      snap => {
        const problemNotifs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(n => n.type === "problem" && (n.forRoles || []).includes(role))
          .slice(0, 5)
          .map(n => ({
            id: `problem_${n.id}`,
            type: "problem",
            title: n.title || "⚠️ Проблема",
            sub:   n.body || "",
            icon:  "⚠️",
            createdAt: n.createdAt,
            link: "/content",
          }));

        setNotifications(prev => {
          const others = prev.filter(n => n.type !== "problem");
          return [...problemNotifs, ...others].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
        });
      }
    );
    return () => unsub();
  }, [db, user?.uid, liveProfile?.role]);
  useEffect(() => {
    if (!lastSeen) return;
    const unread = notifications.filter(n => new Date(n.createdAt) > new Date(lastSeen)).length;
    setUnreadCount(unread);
  }, [notifications, lastSeen]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    if (!user?.uid || !db) return;
    const now = new Date().toISOString();
    setLastSeen(now);
    setUnreadCount(0);
    try {
      await setDoc(doc(db, "notification_seen", user.uid), { seenAt: now });
    } catch (e) {}
  };

  const handleBellClick = () => {
    setShowNotif(v => !v);
    if (!showNotif) markAllRead();
  };

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const currentProfile = liveProfile || profile;
  const currentPerms = resolvePermissions(currentProfile?.role, currentProfile?.permissions || {});
  const roleColor = ROLE_COLORS[currentProfile?.role] || "#64748b";
  const roleLabel = ROLE_LABELS[currentProfile?.role] || currentProfile?.role || "—";
  const avatarEmoji = currentProfile?.avatarEmoji;
  const avatarColor = currentProfile?.avatarColor || roleColor;
  const isDark = mode === "dark";
  const t = theme;

  const Avatar = ({ size = 32, fontSize = 13, radius = "50%" }) => (
    <div style={{ width: size, height: size, borderRadius: radius, background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}cc)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: avatarEmoji ? Math.round(size * 0.5) : fontSize, fontWeight: 700, color: "#fff", flexShrink: 0, userSelect: "none", lineHeight: 1 }}>
      {avatarEmoji || (currentProfile?.name || "?")[0].toUpperCase()}
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: t.bg, fontFamily: "'Inter', system-ui, sans-serif", transition: "background 0.3s" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.scrollbar}; border-radius: 4px; }
        .nav-link { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; color: ${t.textMuted}; text-decoration: none; transition: all 0.2s; font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; }
        .nav-link:hover { background: ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}; color: ${t.textSecondary}; }
        .nav-link.active { background: rgba(124,58,237,0.15); color: #a78bfa; }
        .nav-link.active svg { color: #7c3aed; }
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes bellShake { 0%,100%{transform:rotate(0)} 20%{transform:rotate(-15deg)} 40%{transform:rotate(15deg)} 60%{transform:rotate(-10deg)} 80%{transform:rotate(10deg)} }
      `}</style>

      {/* Sidebar */}
      <motion.div animate={{ width: collapsed ? 70 : 240 }} transition={{ duration: 0.3, ease: "easeInOut" }}
        style={{ background: t.sidebar, borderRight: `1px solid ${t.border}`, display: "flex", flexDirection: "column", padding: "20px 12px", position: "sticky", top: 0, height: "100vh", overflow: "hidden", flexShrink: 0, backdropFilter: "blur(20px)", transition: "background 0.3s" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", marginBottom: "24px", padding: "0 4px" }}>
          {!collapsed && (
            <LogoEasterEgg />
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: "4px", borderRadius: "6px", display: "flex" }}>
            {collapsed ? <ChevronRight size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" }}>
          {NAV.filter(({ perm }) => currentPerms[perm] !== false).map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === "/"}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              style={{ justifyContent: collapsed ? "center" : "flex-start" }}
              title={collapsed ? label : undefined}>
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}

          {/* Пользователи — только owner/admin */}
          {["owner","admin"].includes(currentProfile?.role) && (
            <NavLink to="/users"
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              style={{ justifyContent: collapsed ? "center" : "flex-start" }}
              title={collapsed ? "Пользователи" : undefined}>
              <Users size={18} style={{ flexShrink: 0, color: "#0ea5e9" }} />
              {!collapsed && <span style={{ color: "#0ea5e9" }}>Пользователи</span>}
            </NavLink>
          )}

          {/* Admin panel — только owner */}
          {["owner"].includes(currentProfile?.role) && (
            <NavLink to="/admin"
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              style={{ justifyContent: collapsed ? "center" : "flex-start", marginTop: "6px", borderTop: `1px solid ${t.border}`, paddingTop: "8px" }}
              title={collapsed ? "Admin" : undefined}>
              <Shield size={18} style={{ flexShrink: 0, color: "#f59e0b" }} />
              {!collapsed && <span style={{ color: "#f59e0b", fontWeight: 700 }}>Admin Panel</span>}
            </NavLink>
          )}
        </nav>

        <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: "12px", marginTop: "12px" }}>
          <button onClick={toggle} className="nav-link" style={{ width: "100%", background: "none", border: "none", cursor: "pointer", justifyContent: collapsed ? "center" : "flex-start", marginBottom: "2px" }}>
            {isDark ? <Sun size={18} style={{ color: "#f59e0b", flexShrink: 0 }} /> : <Moon size={18} style={{ color: "#7c3aed", flexShrink: 0 }} />}
            {!collapsed && <span style={{ color: t.textMuted, fontSize: "14px", fontWeight: 500 }}>{isDark ? "Светлая тема" : "Тёмная тема"}</span>}
          </button>
          <div onClick={() => navigate("/profile")}
            style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", marginBottom: "2px", cursor: "pointer", borderRadius: "10px", justifyContent: collapsed ? "center" : "flex-start" }}
            onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <Avatar size={28} fontSize={12} radius="8px" />
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ color: t.text, fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentProfile?.name || "—"}</div>
                <div style={{ fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "20px", background: `${roleColor}20`, color: roleColor, letterSpacing: "0.5px", textTransform: "uppercase", display: "inline-block" }}>{roleLabel}</div>
              </div>
            )}
          </div>
          {/* Theme toggle + support */}
          {!collapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", marginBottom: "4px" }}>
              <button onClick={toggle}
                style={{ display: "flex", alignItems: "center", gap: "6px", background: t.bgCardHover, border: `1px solid ${t.border}`, borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", color: t.textMuted, flex: 1 }}>
                {isDark ? <Moon size={13}/> : <Sun size={13}/>}
                <span>{isDark ? "Тёмная" : "Светлая"}</span>
              </button>
              <a href="https://t.me/mars_cd" target="_blank" rel="noopener noreferrer"
                title="Нашли проблему? Пишите @mars_cd в Telegram"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "30px", height: "30px", borderRadius: "8px", background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textFaint, textDecoration: "none", flexShrink: 0, fontSize: "14px" }}>
                ?
              </a>
            </div>
          )}
          {collapsed && (
            <a href="https://t.me/mars_cd" target="_blank" rel="noopener noreferrer"
              title="Нашли проблему? Пишите @mars_cd в Telegram"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", borderRadius: "8px", background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textFaint, textDecoration: "none", margin: "4px auto", fontSize: "14px" }}>
              ?
            </a>
          )}
          <button onClick={handleLogout} className="nav-link" style={{ width: "100%", background: "none", border: "none", cursor: "pointer", justifyContent: collapsed ? "center" : "flex-start" }}>
            <LogOut size={18} style={{ flexShrink: 0 }} />
            {!collapsed && <span>Выйти</span>}
          </button>
        </div>
      </motion.div>

      {/* Main */}
      <div style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        {/* Topbar */}
        <div style={{ padding: "14px 28px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", background: t.topbar, backdropFilter: "blur(10px)", position: "relative", zIndex: 50 }}>

          {/* Bell */}
          <div ref={notifRef} style={{ position: "relative" }}>
            <button onClick={handleBellClick}
              style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", border: `1px solid ${unreadCount > 0 ? "#7c3aed" : t.border}`, borderRadius: "8px", padding: "8px", color: unreadCount > 0 ? "#a78bfa" : t.textMuted, cursor: "pointer", display: "flex", position: "relative", animation: unreadCount > 0 ? "bellShake 0.5s ease" : "none" }}>
              <Bell size={16} />
              {unreadCount > 0 && (
                <div style={{ position: "absolute", top: "-5px", right: "-5px", width: "18px", height: "18px", borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: "10px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${t.bg}` }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </div>
              )}
            </button>

            {/* Dropdown */}
            <AnimatePresence>
              {showNotif && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }} transition={{ duration: 0.15 }}
                  style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, width: "320px", background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: "14px", boxShadow: "0 16px 40px rgba(0,0,0,0.3)", overflow: "hidden", zIndex: 100 }}>

                  <div style={{ padding: "14px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: t.text, fontSize: "14px", fontWeight: 700 }}>Уведомления</span>
                    {notifications.length > 0 && (
                      <button onClick={markAllRead} style={{ background: "none", border: "none", color: "#7c3aed", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}>
                        Прочитать все
                      </button>
                    )}
                  </div>

                  <div style={{ maxHeight: "360px", overflowY: "auto" }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: "32px 16px", textAlign: "center" }}>
                        <div style={{ fontSize: "28px", marginBottom: "8px" }}>🔔</div>
                        <div style={{ color: t.textMuted, fontSize: "13px" }}>Нет уведомлений</div>
                      </div>
                    ) : notifications.map((n, i) => {
                      const isUnread = lastSeen && new Date(n.createdAt) > new Date(lastSeen);
                      return (
                        <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                          onClick={() => { navigate(n.link); setShowNotif(false); }}
                          style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px 16px", cursor: "pointer", borderBottom: `1px solid ${t.border}`, background: isUnread ? (isDark ? "rgba(124,58,237,0.06)" : "rgba(124,58,237,0.04)") : "transparent", transition: "background 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"}
                          onMouseLeave={e => e.currentTarget.style.background = isUnread ? (isDark ? "rgba(124,58,237,0.06)" : "rgba(124,58,237,0.04)") : "transparent"}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: n.type === "task" ? "rgba(124,58,237,0.15)" : "rgba(14,165,233,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
                            {n.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {n.type === "chat" && <div style={{ color: t.textMuted, fontSize: "11px", marginBottom: "2px" }}>#{n.roomName}</div>}
                            <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{n.title}</div>
                            <div style={{ color: t.textMuted, fontSize: "12px", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.sub}</div>
                          </div>
                          {isUnread && <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#7c3aed", flexShrink: 0, marginTop: "4px" }} />}
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme toggle */}
          <button onClick={toggle} style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", border: `1px solid ${t.border}`, borderRadius: "8px", padding: "8px", color: isDark ? "#f59e0b" : "#7c3aed", cursor: "pointer", display: "flex" }}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Profile */}
          <motion.div onClick={() => navigate("/profile")} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", padding: "6px 12px", borderRadius: "10px" }}
            onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ position: "relative" }}>
                <Avatar size={34} fontSize={14} radius="10px" />
                <div style={{ position: "absolute", bottom: -2, right: -2, width: "10px", height: "10px", borderRadius: "50%", background: STATUS_COLOR[getOnlineStatus(currentProfile)], border: `2px solid ${t.bg}` }} />
              </div>
            <div>
              <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{currentProfile?.name || "—"}</div>
              <div style={{ color: roleColor, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{roleLabel}</div>
            </div>
          </motion.div>
        </div>

        {/* Page */}
        <motion.div key={window.location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          style={{ padding: "32px", color: t.text, transition: "color 0.3s" }}>
          {children}
        </motion.div>
      </div>

      {/* 🎰 Secret roulette trigger */}
      <SecretSlots t={t} />
    </div>
  );
}
