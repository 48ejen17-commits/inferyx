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

function SecretRoulette({ users, t }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [items, setItems] = useState([]);
  const [customInput, setCustomInput] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const canvasRef = useRef(null);
  const spinRef = useRef({ angle: 0, velocity: 0 });
  const rafRef = useRef(null);
  const confRef = useRef([]);
  const [confActive, setConfActive] = useState(false);
  const confCanvasRef = useRef(null);

  useEffect(() => {
    if (users.length > 0 && items.length === 0) {
      setItems(users.slice(0, 12).map((u, i) => ({
        id: u.id, label: u.name || "—", emoji: u.avatarEmoji || "",
        color: SEG_COLORS[i % SEG_COLORS.length],
      })));
    }
  }, [users]);

  const draw = (angle) => {
    const canvas = canvasRef.current;
    if (!canvas || items.length === 0) return;
    const ctx = canvas.getContext("2d");
    const S = 300, cx = S/2, cy = S/2, r = S/2 - 8;
    ctx.clearRect(0, 0, S, S);
    const seg = (Math.PI*2) / items.length;

    items.forEach((item, i) => {
      const start = angle + i*seg - Math.PI/2;
      const end = start + seg;
      const mid = start + seg/2;

      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end); ctx.closePath();
      ctx.fillStyle = item.color; ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth = 1.5; ctx.stroke();

      // shine
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end); ctx.closePath();
      const sh = ctx.createRadialGradient(cx+Math.cos(mid)*r*0.4, cy+Math.sin(mid)*r*0.4, 0, cx+Math.cos(mid)*r*0.4, cy+Math.sin(mid)*r*0.4, r*0.5);
      sh.addColorStop(0,"rgba(255,255,255,0.18)"); sh.addColorStop(1,"rgba(255,255,255,0)");
      ctx.fillStyle = sh; ctx.fill();

      ctx.save(); ctx.translate(cx, cy); ctx.rotate(mid); ctx.textAlign = "right";
      ctx.fillStyle = "#fff"; ctx.font = `bold ${items.length > 8 ? 10 : 12}px Inter,sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 3;
      const label = (item.emoji ? item.emoji+" " : "") + item.label;
      ctx.fillText(label.length > 13 ? label.slice(0,13)+"…" : label, r*0.8, 4);
      ctx.restore();
    });

    // center
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI*2);
    const cg = ctx.createRadialGradient(cx-4,cy-4,2,cx,cy,20);
    cg.addColorStop(0,"#a78bfa"); cg.addColorStop(1,"#6d28d9");
    ctx.fillStyle = cg; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = "14px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowBlur = 0; ctx.fillText("🎰", cx, cy);

    // pointer
    ctx.save(); ctx.translate(cx, 8);
    ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(10,0); ctx.lineTo(0,24); ctx.closePath();
    const pg = ctx.createLinearGradient(0,0,0,24);
    pg.addColorStop(0,"#f59e0b"); pg.addColorStop(1,"#ef4444");
    ctx.fillStyle = pg; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  };

  useEffect(() => { if (open) setTimeout(() => draw(spinRef.current.angle), 50); }, [open, items]);

  const spin = () => {
    if (spinning || items.length < 2) return;
    setWinner(null); setSpinning(true);
    spinRef.current.velocity = 0.22 + Math.random() * 0.18;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      spinRef.current.velocity *= 0.986;
      spinRef.current.angle += spinRef.current.velocity;
      draw(spinRef.current.angle);
      if (spinRef.current.velocity > 0.003) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        setSpinning(false);
        const seg = (Math.PI*2) / items.length;
        const norm = (((-spinRef.current.angle % (Math.PI*2)) + Math.PI/2) + Math.PI*2) % (Math.PI*2);
        const idx = Math.floor(norm / seg) % items.length;
        setWinner(items[idx]);
        // confetti
        confRef.current = Array.from({length:100}, () => ({
          x: Math.random()*window.innerWidth, y: -20-Math.random()*60,
          vx: (Math.random()-0.5)*7, vy: 2+Math.random()*5,
          w: 8+Math.random()*8, h: 4+Math.random()*5,
          color: SEG_COLORS[Math.floor(Math.random()*SEG_COLORS.length)],
          rot: Math.random()*Math.PI*2, rotV: (Math.random()-0.5)*0.18, opacity: 1,
        }));
        setConfActive(true);
        setTimeout(() => setConfActive(false), 3500);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { alive = false; };
  };

  // Confetti canvas
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
        if (p.y > canvas.height*0.75) p.opacity -= 0.025;
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

  const addItem = () => {
    if (!customInput.trim() || items.length >= 15) return;
    setItems(p => [...p, { id: Date.now()+"", label: customInput.trim(), emoji: "", color: SEG_COLORS[p.length % SEG_COLORS.length] }]);
    setCustomInput("");
  };

  const th = t || {};
  const bgCard = th.bgCard || "rgba(15,12,35,0.95)";
  const border = th.border || "rgba(124,58,237,0.25)";
  const text = th.text || "#e2e8f0";
  const textMuted = th.textMuted || "#64748b";
  const bgHover = th.bgCardHover || "rgba(255,255,255,0.06)";
  const bgInput = th.bgInput || "rgba(255,255,255,0.05)";

  return (
    <>
      {/* Confetti overlay */}
      {confActive && <canvas ref={confCanvasRef} style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9999 }} />}

      {/* Secret trigger — thin strip on right edge */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => { setOpen(true); setWinner(null); }}
        style={{
          position: "fixed", right: 0, top: "50%", transform: "translateY(-50%)",
          width: hovered ? "42px" : "6px",
          height: "80px", borderRadius: "12px 0 0 12px",
          background: hovered
            ? "linear-gradient(135deg, #7c3aed, #db2877)"
            : "rgba(124,58,237,0.25)",
          cursor: "pointer", zIndex: 500,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          boxShadow: hovered ? "0 0 20px rgba(124,58,237,0.5)" : "none",
          overflow: "hidden",
        }}>
        {hovered && <span style={{ fontSize: "20px", userSelect: "none" }}>🎰</span>}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={() => setOpen(false)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:600, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
            <motion.div initial={{ scale:0.9, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.9, opacity:0 }}
              transition={{ type:"spring", stiffness:300, damping:25 }}
              onClick={e => e.stopPropagation()}
              style={{ background:"linear-gradient(135deg, #0f0b24, #1a0f35)", border:`1px solid ${border}`, borderRadius:"24px", padding:"28px", width:"100%", maxWidth:"720px", boxShadow:"0 32px 80px rgba(0,0,0,0.7)", display:"grid", gridTemplateColumns:"320px 1fr", gap:"28px", alignItems:"start" }}>

              {/* Wheel side */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%" }}>
                  <span style={{ color:text, fontSize:"16px", fontWeight:700 }}>🎰 Рулетка</span>
                  <button onClick={() => setOpen(false)} style={{ background:"none", border:"none", color:textMuted, cursor:"pointer", fontSize:"20px", lineHeight:1 }}>×</button>
                </div>

                <canvas ref={canvasRef} width={300} height={300}
                  style={{ borderRadius:"50%", boxShadow: spinning ? "0 0 30px rgba(124,58,237,0.6)" : "0 8px 30px rgba(0,0,0,0.4)", transition:"box-shadow 0.3s" }} />

                <motion.button onClick={spin} disabled={spinning || items.length < 2}
                  whileHover={!spinning ? { scale:1.05 } : {}} whileTap={!spinning ? { scale:0.95 } : {}}
                  style={{ padding:"12px 36px", borderRadius:"50px", border:"none", cursor: spinning || items.length < 2 ? "not-allowed" : "pointer", background: spinning ? "rgba(124,58,237,0.3)" : "linear-gradient(135deg,#7c3aed,#db2877)", color:"#fff", fontSize:"16px", fontWeight:700, boxShadow: spinning ? "none" : "0 4px 20px rgba(124,58,237,0.4)" }}>
                  {spinning ? "⏳ Крутится..." : "Крутить!"}
                </motion.button>

                <AnimatePresence>
                  {winner && !spinning && (
                    <motion.div initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
                      style={{ background:`${winner.color}22`, border:`2px solid ${winner.color}55`, borderRadius:"14px", padding:"14px 20px", textAlign:"center", width:"100%" }}>
                      <div style={{ fontSize:"26px", marginBottom:"4px" }}>{winner.emoji || "🎉"}</div>
                      <div style={{ color:winner.color, fontSize:"20px", fontWeight:800 }}>{winner.label}</div>
                      <div style={{ color:textMuted, fontSize:"11px", marginTop:"3px" }}>Победитель!</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Controls side */}
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
                  <span style={{ color:textMuted, fontSize:"12px", fontWeight:600 }}>Участники ({items.length}/15)</span>
                  <button onClick={() => { setItems(users.slice(0,12).map((u,i)=>({ id:u.id, label:u.name||"—", emoji:u.avatarEmoji||"", color:SEG_COLORS[i%SEG_COLORS.length] }))); setWinner(null); }}
                    style={{ background:"none", border:`1px solid ${border}`, color:textMuted, borderRadius:"7px", padding:"4px 10px", fontSize:"11px", cursor:"pointer" }}>
                    ↺ Сброс
                  </button>
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:"5px", maxHeight:"280px", overflowY:"auto", marginBottom:"12px" }}>
                  {items.map((item) => (
                    <div key={item.id} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"7px 10px", background:bgHover, borderRadius:"9px" }}>
                      <div style={{ width:"10px", height:"10px", borderRadius:"3px", background:item.color, flexShrink:0 }} />
                      <span style={{ color:text, fontSize:"12px", flex:1 }}>{item.emoji} {item.label}</span>
                      <button onClick={() => setItems(p => p.filter(i => i.id !== item.id))}
                        style={{ background:"none", border:"none", color:textMuted, cursor:"pointer", fontSize:"16px", lineHeight:1, padding:"0 2px" }}
                        onMouseEnter={e => e.currentTarget.style.color="#ef4444"}
                        onMouseLeave={e => e.currentTarget.style.color=textMuted}>×</button>
                    </div>
                  ))}
                </div>

                {items.length < 15 && (
                  <div style={{ display:"flex", gap:"7px" }}>
                    <input value={customInput} onChange={e => setCustomInput(e.target.value)}
                      onKeyDown={e => e.key==="Enter" && addItem()}
                      placeholder="Добавить участника..."
                      style={{ flex:1, background:bgInput, color:text, border:`1px solid ${border}`, borderRadius:"9px", padding:"8px 11px", fontSize:"12px", outline:"none", fontFamily:"inherit" }} />
                    <button onClick={addItem} disabled={!customInput.trim()}
                      style={{ background: customInput.trim() ? "rgba(124,58,237,0.3)" : "rgba(124,58,237,0.1)", border:`1px solid ${border}`, color:"#a78bfa", borderRadius:"9px", padding:"8px 14px", fontSize:"12px", fontWeight:600, cursor: customInput.trim() ? "pointer" : "not-allowed" }}>
                      +
                    </button>
                  </div>
                )}

                <div style={{ marginTop:"14px", padding:"10px 12px", background:"rgba(124,58,237,0.07)", border:"1px solid rgba(124,58,237,0.15)", borderRadius:"10px" }}>
                  <div style={{ color:"#a78bfa", fontSize:"11px", lineHeight:"1.6" }}>
                    💡 Кто пишет отчёт? Кому задача? Кто выбирает музыку? Крути!
                  </div>
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
