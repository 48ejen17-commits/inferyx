import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, ROLE_LABELS, ROLE_COLORS } from "../context/AuthContext";
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
  { to: "/", icon: LayoutDashboard, label: "Дашборд" },
  { to: "/checklist", icon: CheckSquare, label: "Чек-лист" },
  { to: "/chat", icon: MessageSquare, label: "Чаты" },
  { to: "/schedule", icon: CalendarDays, label: "График" },
  { to: "/content", icon: FileText, label: "Контент" },
  { to: "/models", icon: UserCircle, label: "Модели" },
  { to: "/team", icon: Users, label: "Команда" },
  { to: "/tasks", icon: Clipboard, label: "Задачи" },
  { to: "/analytics", icon: BarChart3, label: "Аналитика" },
  { to: "/settings", icon: Settings, label: "Настройки" },
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

function SecretRoulette({ users, t }) {
  const [open, setOpen]         = useState(false);
  const [hovered, setHovered]   = useState(false);
  const [wheel]                  = useState(() => buildWheel());
  const [spinning, setSpinning]  = useState(false);
  const [result, setResult]      = useState(null);
  const [bet, setBet]            = useState(100);
  const [balance, setBalance]    = useState(1000);
  const [history, setHistory]    = useState([]);
  const canvasRef                = useRef(null);
  const spinRef                  = useRef({ angle: 0, velocity: 0, targetIdx: 0 });
  const rafRef                   = useRef(null);
  const confRef                  = useRef([]);
  const confCanvasRef            = useRef(null);
  const [confActive, setConfActive] = useState(false);

  // ── Draw wheel ───────────────────────────────────────────────────────────────
  const drawWheel = (angle) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const S = 320, cx = S/2, cy = S/2, r = S/2 - 10;
    ctx.clearRect(0, 0, S, S);

    const seg = (Math.PI * 2) / wheel.length;

    // outer glow
    const glowGrad = ctx.createRadialGradient(cx, cy, r*0.8, cx, cy, r+12);
    glowGrad.addColorStop(0, "rgba(124,58,237,0)");
    glowGrad.addColorStop(1, "rgba(124,58,237,0.2)");
    ctx.fillStyle = glowGrad;
    ctx.beginPath(); ctx.arc(cx, cy, r+12, 0, Math.PI*2); ctx.fill();

    wheel.forEach((slot, i) => {
      const start = angle + i * seg - Math.PI / 2;
      const end   = start + seg;
      const mid   = start + seg / 2;

      // segment fill
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end); ctx.closePath();
      ctx.fillStyle = slot.color; ctx.fill();

      // separator
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1; ctx.stroke();

      // shimmer overlay
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end); ctx.closePath();
      const sh = ctx.createLinearGradient(
        cx + Math.cos(mid)*r*0.2, cy + Math.sin(mid)*r*0.2,
        cx + Math.cos(mid)*r*0.9, cy + Math.sin(mid)*r*0.9
      );
      sh.addColorStop(0, "rgba(255,255,255,0.12)");
      sh.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sh; ctx.fill();

      // text — only show if segment wide enough
      if (seg > 0.15) {
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(mid);
        ctx.textAlign = "right";
        ctx.font = `bold ${seg < 0.25 ? 9 : 11}px Inter,system-ui,sans-serif`;
        ctx.fillStyle = slot.textColor;
        ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 4;
        ctx.fillText(slot.label, r * 0.88, 4);
        ctx.restore();
      }
    });

    // tick marks on rim
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    for (let i = 0; i < wheel.length; i++) {
      const a = angle + i * seg - Math.PI/2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r-4), cy + Math.sin(a) * (r-4));
      ctx.lineTo(cx + Math.cos(a) * (r+6), cy + Math.sin(a) * (r+6));
      ctx.stroke();
    }

    // outer ring
    ctx.beginPath(); ctx.arc(cx, cy, r+4, 0, Math.PI*2);
    ctx.strokeStyle = "rgba(124,58,237,0.5)"; ctx.lineWidth = 3; ctx.stroke();

    // center hub
    const hubGrad = ctx.createRadialGradient(cx-5, cy-5, 2, cx, cy, 28);
    hubGrad.addColorStop(0, "#a78bfa"); hubGrad.addColorStop(1, "#4c1d95");
    ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI*2);
    ctx.fillStyle = hubGrad; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = "18px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowBlur = 0; ctx.fillText("🎰", cx, cy);

    // pointer (arrow at top)
    const px = cx, py = 6;
    ctx.save(); ctx.translate(px, py);
    ctx.beginPath();
    ctx.moveTo(-14, -4); ctx.lineTo(14, -4);
    ctx.lineTo(10, 8); ctx.lineTo(0, 22); ctx.lineTo(-10, 8);
    ctx.closePath();
    const pg = ctx.createLinearGradient(0,-4,0,22);
    pg.addColorStop(0, "#fbbf24"); pg.addColorStop(1, "#ef4444");
    ctx.fillStyle = pg; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  };

  useEffect(() => {
    if (open) setTimeout(() => drawWheel(spinRef.current.angle), 60);
  }, [open]);

  // ── Spin ──────────────────────────────────────────────────────────────────────
  const spin = () => {
    if (spinning || bet > balance || bet <= 0) return;

    // Deduct bet immediately
    setBalance(b => b - bet);
    setResult(null);
    setSpinning(true);

    // Pick winner slot weighted by prob
    const rand = Math.random() * 100;
    let cumulative = 0;
    let winnerSlot = SLOTS[0];
    for (const slot of SLOTS) {
      cumulative += slot.prob;
      if (rand <= cumulative) { winnerSlot = slot; break; }
    }

    // Find a matching index on the wheel
    const candidates = wheel.reduce((acc, s, i) => s.label === winnerSlot.label ? [...acc, i] : acc, []);
    const targetIdx  = candidates[Math.floor(Math.random() * candidates.length)];

    const seg = (Math.PI * 2) / wheel.length;
    // We want targetIdx to land at top (angle = -Math.PI/2 + Math.PI/2 = 0 => pointer at top means angle offset = 0)
    // Current angle + velocity will land at some angle. We set targetAngle so that:
    // targetAngle + targetIdx * seg - Math.PI/2 ≡ -Math.PI/2 (i.e. slot middle at top)
    // => targetAngle = -targetIdx * seg
    const extraSpins    = 8 + Math.floor(Math.random() * 5); // 8-12 full spins
    const targetFinal   = -targetIdx * seg + extraSpins * Math.PI * 2;
    const current       = spinRef.current.angle % (Math.PI * 2);
    const distance      = targetFinal - (spinRef.current.angle);

    spinRef.current.targetAngle = spinRef.current.angle + distance + Math.random() * seg * 0.3;
    spinRef.current.velocity    = 0.35 + Math.random() * 0.1;
    spinRef.current.winnerSlot  = winnerSlot;

    const totalDist = spinRef.current.targetAngle - spinRef.current.angle;
    let traveled = 0;
    let alive = true;

    const loop = () => {
      if (!alive) return;

      // Ease-out based on distance remaining
      const remaining = spinRef.current.targetAngle - spinRef.current.angle;
      if (remaining <= 0 || spinRef.current.velocity < 0.002) {
        spinRef.current.angle = spinRef.current.targetAngle;
        drawWheel(spinRef.current.angle);
        setSpinning(false);

        const won = winnerSlot.mult > 0;
        const payout = won ? Math.round(bet * winnerSlot.mult) : 0;
        setBalance(b => b + payout);
        setResult({ slot: winnerSlot, payout, bet });
        setHistory(h => [{ slot: winnerSlot, payout, bet, time: new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}) }, ...h].slice(0, 8));

        // ── Result animation on canvas ──────────────────────────────────────
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          const S = 320, cx = S/2, cy = S/2;
          let frame = 0;
          const totalFrames = won ? 60 : 40;
          const isJackpot = winnerSlot.mult >= 10;

          const animLoop = () => {
            if (frame >= totalFrames) {
              // Redraw clean wheel at end
              drawWheel(spinRef.current.angle);
              return;
            }
            frame++;
            const progress = frame / totalFrames;
            const eased = Math.sin(progress * Math.PI);

            // Redraw wheel first
            drawWheel(spinRef.current.angle);

            if (won) {
              // Gold flash overlay
              const flashAlpha = eased * (isJackpot ? 0.45 : 0.28);
              const flashColor = isJackpot ? `rgba(245,158,11,${flashAlpha})` : `rgba(124,58,237,${flashAlpha})`;
              ctx.fillStyle = flashColor;
              ctx.beginPath(); ctx.arc(cx, cy, S/2 - 10, 0, Math.PI*2); ctx.fill();

              // Expanding ring
              const ringR = (S/2 - 10) * (0.3 + eased * 0.7);
              ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI*2);
              ctx.strokeStyle = isJackpot ? `rgba(245,158,11,${(1-progress)*0.8})` : `rgba(167,139,250,${(1-progress)*0.8})`;
              ctx.lineWidth = isJackpot ? 5 : 3; ctx.stroke();

              if (isJackpot) {
                // Second ring
                const ringR2 = (S/2 - 10) * (0.3 + eased * 0.5);
                ctx.beginPath(); ctx.arc(cx, cy, ringR2, 0, Math.PI*2);
                ctx.strokeStyle = `rgba(255,255,255,${(1-progress)*0.5})`;
                ctx.lineWidth = 2; ctx.stroke();
              }

              // Win text
              const textAlpha = eased;
              const textScale = 0.5 + eased * 0.5;
              ctx.save();
              ctx.translate(cx, cy);
              ctx.scale(textScale, textScale);
              ctx.textAlign = "center"; ctx.textBaseline = "middle";
              ctx.font = `bold ${isJackpot ? 28 : 22}px Inter,system-ui,sans-serif`;
              ctx.shadowColor = isJackpot ? "#f59e0b" : "#7c3aed";
              ctx.shadowBlur = 20;
              ctx.fillStyle = `rgba(255,255,255,${textAlpha})`;
              ctx.fillText(isJackpot ? "🎊 ДЖЕКПОТ!" : `✨ ×${winnerSlot.mult}`, 0, -18);
              ctx.font = `bold ${isJackpot ? 22 : 18}px Inter,system-ui,sans-serif`;
              ctx.fillStyle = isJackpot ? `rgba(245,158,11,${textAlpha})` : `rgba(167,139,250,${textAlpha})`;
              ctx.fillText(`+${payout} 🪙`, 0, 16);
              ctx.restore();

            } else {
              // Red loss flash
              const lossAlpha = eased * 0.4;
              ctx.fillStyle = `rgba(239,68,68,${lossAlpha})`;
              ctx.beginPath(); ctx.arc(cx, cy, S/2-10, 0, Math.PI*2); ctx.fill();

              // Shake-like darkening pulse
              if (frame % 6 < 3) {
                ctx.fillStyle = `rgba(0,0,0,0.2)`;
                ctx.beginPath(); ctx.arc(cx, cy, S/2-10, 0, Math.PI*2); ctx.fill();
              }

              // Skull + text
              const textAlpha = eased;
              ctx.save();
              ctx.translate(cx, cy);
              ctx.scale(0.6 + eased*0.4, 0.6 + eased*0.4);
              ctx.textAlign = "center"; ctx.textBaseline = "middle";
              ctx.font = "30px serif"; ctx.shadowBlur = 0;
              ctx.globalAlpha = textAlpha;
              ctx.fillText("💀", 0, -16);
              ctx.font = "bold 16px Inter,system-ui,sans-serif";
              ctx.fillStyle = "#ef4444";
              ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 10;
              ctx.fillText(`−${bet} 🪙`, 0, 16);
              ctx.restore();
            }

            requestAnimationFrame(animLoop);
          };
          requestAnimationFrame(animLoop);
        }

        if (won) {
          confRef.current = Array.from({length: winnerSlot.mult >= 10 ? 160 : 80}, () => ({
            x: Math.random() * window.innerWidth, y: -20 - Math.random() * 80,
            vx: (Math.random()-0.5) * (winnerSlot.mult >= 10 ? 10 : 6),
            vy: 2 + Math.random() * 5, w: 8+Math.random()*8, h: 4+Math.random()*5,
            color: ["#f59e0b","#7c3aed","#db2877","#10b981","#0ea5e9","#f97316","#fff"][Math.floor(Math.random()*7)],
            rot: Math.random()*Math.PI*2, rotV: (Math.random()-0.5)*0.2, opacity: 1,
          }));
          setConfActive(true);
          setTimeout(() => setConfActive(false), winnerSlot.mult >= 10 ? 5000 : 3000);
        }
        return;
      }

      // Decelerate smoothly
      const progress = 1 - (remaining / totalDist);
      const ease = 1 - Math.pow(progress, 2);
      spinRef.current.velocity = Math.max(0.003, 0.35 * ease * 0.5 + spinRef.current.velocity * 0.97);
      spinRef.current.angle += spinRef.current.velocity;
      drawWheel(spinRef.current.angle);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { alive = false; };
  };

  // ── Confetti ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!confActive) return;
    const canvas = confCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      confRef.current.forEach(p => {
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.1; p.rot+=p.rotV;
        if (p.y > canvas.height * 0.8) p.opacity -= 0.02;
        ctx.save(); ctx.globalAlpha = Math.max(0,p.opacity);
        ctx.translate(p.x,p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
        ctx.restore();
      });
      confRef.current = confRef.current.filter(p => p.opacity > 0);
      if (confRef.current.length > 0) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => { alive = false; };
  }, [confActive]);

  const canSpin = !spinning && bet > 0 && bet <= balance;
  const bg = "linear-gradient(135deg, #07050f, #120a28)";
  const cardBg = "rgba(255,255,255,0.04)";
  const border = "rgba(124,58,237,0.25)";

  return (
    <>
      {confActive && <canvas ref={confCanvasRef} style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9999 }} />}

      {/* Secret trigger */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => { setOpen(true); setResult(null); }}
        style={{
          position:"fixed", right:0, top:"50%", transform:"translateY(-50%)",
          width: hovered ? "44px" : "6px", height:"80px",
          borderRadius:"12px 0 0 12px",
          background: hovered ? "linear-gradient(135deg,#7c3aed,#db2877)" : "rgba(124,58,237,0.2)",
          cursor:"pointer", zIndex:500,
          display:"flex", alignItems:"center", justifyContent:"center",
          transition:"all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          boxShadow: hovered ? "0 0 24px rgba(124,58,237,0.5)" : "none",
          overflow:"hidden",
        }}>
        {hovered && <span style={{ fontSize:"22px", userSelect:"none" }}>🎰</span>}
      </div>

      {/* Casino Modal */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={() => !spinning && setOpen(false)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
            <motion.div initial={{ scale:0.88, opacity:0, y:20 }} animate={{ scale:1, opacity:1, y:0 }} exit={{ scale:0.88, opacity:0, y:20 }}
              transition={{ type:"spring", stiffness:280, damping:24 }}
              onClick={e => e.stopPropagation()}
              style={{ background:bg, border:"1px solid rgba(124,58,237,0.3)", borderRadius:"28px", padding:"28px 32px", width:"100%", maxWidth:"740px", boxShadow:"0 40px 100px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)" }}>

              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                  <div style={{ width:"44px", height:"44px", borderRadius:"14px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", boxShadow:"0 4px 14px rgba(245,158,11,0.4)" }}>🎰</div>
                  <div>
                    <div style={{ color:"#fff", fontSize:"20px", fontWeight:800, letterSpacing:"0.5px" }}>CASINO</div>
                    <div style={{ color:"rgba(167,139,250,0.7)", fontSize:"12px" }}>Исключительно для развлечения</div>
                  </div>
                </div>
                {/* Balance */}
                <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
                  <div style={{ background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.25)", borderRadius:"12px", padding:"8px 16px", textAlign:"center" }}>
                    <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"10px", fontWeight:600, textTransform:"uppercase" }}>Баланс</div>
                    <div style={{ color:"#f59e0b", fontSize:"20px", fontWeight:800 }}>🪙 {balance.toLocaleString()}</div>
                  </div>
                  <button onClick={() => !spinning && setOpen(false)} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.4)", borderRadius:"10px", width:"36px", height:"36px", cursor:"pointer", fontSize:"18px", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:"24px" }}>

                {/* Wheel */}
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"16px" }}>
                  <canvas ref={canvasRef} width={320} height={320}
                    style={{ filter: spinning ? "drop-shadow(0 0 30px rgba(124,58,237,0.7))" : "drop-shadow(0 8px 24px rgba(0,0,0,0.5))", transition:"filter 0.3s", maxWidth:"100%" }} />

                  {/* Bet controls */}
                  <div style={{ width:"100%", background:cardBg, border:`1px solid ${border}`, borderRadius:"14px", padding:"14px 16px" }}>
                    <div style={{ color:"rgba(255,255,255,0.35)", fontSize:"11px", fontWeight:600, textTransform:"uppercase", marginBottom:"8px", letterSpacing:"0.5px" }}>Ставка</div>
                    <div style={{ display:"flex", gap:"6px", marginBottom:"10px", flexWrap:"wrap" }}>
                      {[50, 100, 250, 500, 1000].map(v => (
                        <button key={v} onClick={() => setBet(Math.min(v, balance))}
                          style={{ flex:1, minWidth:"44px", padding:"6px 4px", borderRadius:"8px", border:`1px solid ${bet===v ? "rgba(124,58,237,0.6)" : "rgba(255,255,255,0.08)"}`, background: bet===v ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)", color: bet===v ? "#a78bfa" : "rgba(255,255,255,0.4)", fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
                          {v}
                        </button>
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                      <button onClick={() => setBet(Math.max(10, bet-50))} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", color:"#fff", borderRadius:"8px", width:"32px", height:"32px", cursor:"pointer", fontSize:"16px" }}>−</button>
                      <div style={{ flex:1, background:"rgba(0,0,0,0.3)", borderRadius:"8px", padding:"6px 12px", textAlign:"center", color:"#f59e0b", fontSize:"16px", fontWeight:800 }}>🪙 {bet}</div>
                      <button onClick={() => setBet(Math.min(balance, bet+50))} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", color:"#fff", borderRadius:"8px", width:"32px", height:"32px", cursor:"pointer", fontSize:"16px" }}>+</button>
                      <button onClick={() => setBet(balance)} style={{ background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.25)", color:"#f59e0b", borderRadius:"8px", padding:"6px 10px", cursor:"pointer", fontSize:"11px", fontWeight:700 }}>MAX</button>
                    </div>
                  </div>

                  {/* Spin button */}
                  <motion.button onClick={spin} disabled={!canSpin}
                    whileHover={canSpin ? { scale:1.04 } : {}} whileTap={canSpin ? { scale:0.97 } : {}}
                    style={{ width:"100%", padding:"15px", borderRadius:"14px", border:"none", cursor: canSpin ? "pointer" : "not-allowed", background: spinning ? "rgba(124,58,237,0.3)" : canSpin ? "linear-gradient(135deg,#7c3aed,#db2877)" : "rgba(255,255,255,0.05)", color:"#fff", fontSize:"18px", fontWeight:800, letterSpacing:"1px", boxShadow: canSpin && !spinning ? "0 6px 24px rgba(124,58,237,0.5)" : "none", transition:"all 0.2s" }}>
                    {spinning ? "⏳ Крутится..." : balance === 0 ? "Нет монет 💸" : "🎰 КРУТИТЬ"}
                  </motion.button>

                  {balance === 0 && (
                    <button onClick={() => { setBalance(1000); setHistory([]); setResult(null); }}
                      style={{ width:"100%", padding:"10px", borderRadius:"12px", border:"1px solid rgba(16,185,129,0.3)", background:"rgba(16,185,129,0.1)", color:"#10b981", fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
                      ↺ Начать заново (1000 монет)
                    </button>
                  )}
                </div>

                {/* Right panel */}
                <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>

                  {/* Result */}
                  <AnimatePresence mode="wait">
                    {result && !spinning && (
                      <motion.div key={result.payout + result.bet}
                        initial={{ opacity:0, y:-10, scale:0.95 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0 }}
                        style={{ background: result.slot.mult === 0 ? "rgba(239,68,68,0.08)" : "rgba(124,58,237,0.12)", border:`2px solid ${result.slot.mult === 0 ? "rgba(239,68,68,0.3)" : result.slot.mult >= 10 ? "rgba(245,158,11,0.5)" : "rgba(124,58,237,0.35)"}`, borderRadius:"16px", padding:"18px 20px", textAlign:"center" }}>
                        <div style={{ fontSize:"32px", marginBottom:"6px" }}>
                          {result.slot.mult === 0 ? "💀" : result.slot.mult >= 50 ? "🎊" : result.slot.mult >= 10 ? "🤑" : "✨"}
                        </div>
                        <div style={{ color: result.slot.mult === 0 ? "#ef4444" : result.slot.mult >= 10 ? "#f59e0b" : "#a78bfa", fontSize:"22px", fontWeight:800, marginBottom:"4px" }}>
                          {result.slot.label}
                        </div>
                        {result.slot.mult > 0 ? (
                          <div style={{ color:"#10b981", fontSize:"16px", fontWeight:700 }}>
                            + 🪙 {result.payout.toLocaleString()}
                            <span style={{ color:"rgba(255,255,255,0.3)", fontSize:"12px", fontWeight:400 }}> (ставка {result.bet})</span>
                          </div>
                        ) : (
                          <div style={{ color:"rgba(255,255,255,0.35)", fontSize:"13px" }}>
                            Потеряно 🪙 {result.bet}
                          </div>
                        )}
                      </motion.div>
                    )}
                    {!result && !spinning && (
                      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
                        style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:"16px", padding:"20px", textAlign:"center" }}>
                        <div style={{ fontSize:"28px", marginBottom:"8px" }}>🎰</div>
                        <div style={{ color:"rgba(255,255,255,0.25)", fontSize:"13px" }}>Сделай ставку и крути!</div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Paytable */}
                  <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:"14px", padding:"14px 16px" }}>
                    <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"11px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"10px" }}>Таблица выплат</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
                      {[
                        { label:"🎰 ДЖЕКПОТ", mult:50, color:"#f59e0b", chance:"~0.3%" },
                        { label:"👑 ×10",     mult:10, color:"#db2877", chance:"~0.7%" },
                        { label:"🔥 ×5",      mult:5,  color:"#f97316", chance:"~3%"   },
                        { label:"💎 ×3",      mult:3,  color:"#0ea5e9", chance:"~8%"   },
                        { label:"✨ ×2",      mult:2,  color:"#7c3aed", chance:"~18%"  },
                        { label:"💀 Проигрыш",mult:0,  color:"#ef4444", chance:"~70%"  },
                      ].map((row, i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"5px 8px", borderRadius:"7px", background: i === 0 ? "rgba(245,158,11,0.08)" : "transparent" }}>
                          <span style={{ color:row.color, fontSize:"13px", fontWeight:700, flex:1 }}>{row.label}</span>
                          {row.mult > 0 && <span style={{ color:"#10b981", fontSize:"12px", fontWeight:700 }}>×{row.mult} ставки</span>}
                          <span style={{ color:"rgba(255,255,255,0.2)", fontSize:"10px" }}>{row.chance}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* History */}
                  {history.length > 0 && (
                    <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:"14px", padding:"14px 16px" }}>
                      <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"11px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"8px" }}>История</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                        {history.map((h, i) => (
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:"12px" }}>
                            <span style={{ color:"rgba(255,255,255,0.4)" }}>{h.time}</span>
                            <span style={{ color:"rgba(255,255,255,0.6)" }}>{h.slot.label}</span>
                            <span style={{ color: h.payout > 0 ? "#10b981" : "#ef4444", fontWeight:700 }}>
                              {h.payout > 0 ? `+${h.payout}` : `-${h.bet}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
            <div style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.5px", background: "linear-gradient(135deg, #7c3aed, #db2777)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shimmer 4s linear infinite" }}>
              INFERYX
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: "4px", borderRadius: "6px", display: "flex" }}>
            {collapsed ? <ChevronRight size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" }}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === "/"}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              style={{ justifyContent: collapsed ? "center" : "flex-start" }}
              title={collapsed ? label : undefined}>
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
          {/* Admin only for owner */}
          {currentProfile?.role?.toLowerCase() === "owner" && (
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
      <SecretRoulette users={allUsers} t={t} />
    </div>
  );
}
