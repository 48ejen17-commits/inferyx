import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LiveBackground from "../components/LiveBackground";
import {
  collection, onSnapshot, orderBy, query, limit,
  setDoc, doc, getDoc
} from "firebase/firestore";
import { useAuth, ROLE_COLORS, ROLES } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  TrendingUp, TrendingDown, Users, CheckSquare,
  Activity, Clock, Trophy, Zap, Info
} from "lucide-react";

// ─── TOOLTIP (fixed positioning, never clipped) ───────────────────────────────
function Tooltip({ text }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const iconRef = useRef(null);

  const onEnter = () => {
    if (iconRef.current) {
      const r = iconRef.current.getBoundingClientRect();
      setPos({ top: r.top, left: r.left + r.width / 2 });
    }
    setShow(true);
  };

  return (
    <>
      <span ref={iconRef} onMouseEnter={onEnter} onMouseLeave={() => setShow(false)}
        style={{ display: "inline-flex", alignItems: "center", cursor: "help" }}>
        <Info size={13} style={{ color: "#6366f1", opacity: 0.7 }} />
      </span>
      {show && (
        <div style={{
          position: "fixed",
          top: pos.top - 10,
          left: pos.left,
          transform: "translate(-50%, -100%)",
          background: "linear-gradient(135deg, #1e1b4b, #160f30)",
          border: "1px solid rgba(124,58,237,0.5)",
          borderRadius: "10px",
          padding: "10px 14px",
          fontSize: "12px",
          color: "#c4b5fd",
          zIndex: 999999,
          boxShadow: "0 12px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.1)",
          maxWidth: "240px",
          whiteSpace: "normal",
          lineHeight: "1.7",
          pointerEvents: "none",
          letterSpacing: "0.01em",
        }}>
          {text}
          <div style={{
            position: "absolute", top: "100%", left: "50%",
            transform: "translateX(-50%)", width: 0, height: 0,
            borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderTop: "6px solid #1e1b4b",
          }} />
        </div>
      )}
    </>
  );
}

// ─── GAME ─────────────────────────────────────────────────────────────────────
const GW = 900, GH = 240;
const GROUND_Y = 185;       // where the ground line is
const PW = 26, PH = 34;     // player width / height
const OW = 16;              // obstacle width

function DinoGame({ profile, db, user }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [ui, setUi] = useState({ status: "idle", score: 0, best: 0, newBest: false });
  const [leaderboard, setLeaderboard] = useState([]);

  // init state once
  const makeState = () => ({
    status: "idle",   // idle | running | dead
    score: 0,
    speed: 5,
    frame: 0,
    best: 0,
    px: 90,           // player x (fixed)
    py: GROUND_Y - PH, // player y
    vy: 0,
    onGround: true,
    obstacles: [],    // [{x, h}]
    stars: Array.from({ length: 40 }, () => ({
      x: Math.random() * GW,
      y: Math.random() * (GROUND_Y - 20),
      r: Math.random() * 1.2 + 0.3,
      bright: Math.random(),
    })),
  });

  if (!stateRef.current) stateRef.current = makeState();

  // leaderboard
  useEffect(() => {
    if (!db) return;
    return onSnapshot(collection(db, "game_scores"), snap => {
      setLeaderboard(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => b.score - a.score).slice(0, 8)
      );
    });
  }, [db]);

  const saveScore = useCallback(async (score) => {
    if (!user?.uid || !db) return;
    try {
      const ref = doc(db, "game_scores", user.uid);
      const ex = await getDoc(ref);
      if (!ex.exists() || ex.data().score < score) {
        await setDoc(ref, {
          score,
          name: profile?.name || "—",
          role: profile?.role || "",
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {}
  }, [user?.uid, db, profile]);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    const best = s.best;
    Object.assign(s, makeState());
    s.best = best;
    s.status = "running";
    setUi(u => ({ ...u, status: "running", score: 0, newBest: false }));
  }, []);

  const doJump = useCallback(() => {
    const s = stateRef.current;
    if (s.onGround) {
      s.vy = -15;
      s.onGround = false;
    }
  }, []);

  const handleInput = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== "running") startGame();
    else doJump();
  }, [startGame, doJump]);

  // keyboard
  useEffect(() => {
    const fn = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        handleInput();
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [handleInput]);

  // render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // HiDPI
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = GW * dpr;
    canvas.height = GH * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;

    let alive = true;

    // ── Draw helpers ──────────────────────────────────────────────────────────

    const drawBg = (s) => {
      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      sky.addColorStop(0, "#060614");
      sky.addColorStop(1, "#0e0b22");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, GW, GROUND_Y);

      // Stars
      s.stars.forEach(st => {
        const twinkle = 0.4 + Math.sin(s.frame * 0.05 + st.bright * 10) * 0.3;
        ctx.fillStyle = `rgba(200,190,255,${twinkle})`;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Ground fill
      const grd = ctx.createLinearGradient(0, GROUND_Y, 0, GH);
      grd.addColorStop(0, "#18153a");
      grd.addColorStop(1, "#0d0b22");
      ctx.fillStyle = grd;
      ctx.fillRect(0, GROUND_Y, GW, GH - GROUND_Y);

      // Ground glow line
      ctx.shadowColor = "#7c3aed";
      ctx.shadowBlur = 10;
      const lineGrad = ctx.createLinearGradient(0, 0, GW, 0);
      lineGrad.addColorStop(0, "rgba(124,58,237,0.2)");
      lineGrad.addColorStop(0.5, "rgba(124,58,237,0.9)");
      lineGrad.addColorStop(1, "rgba(124,58,237,0.2)");
      ctx.fillStyle = lineGrad;
      ctx.fillRect(0, GROUND_Y, GW, 2);
      ctx.shadowBlur = 0;

      // Dashes
      const off = (s.frame * s.speed) % 80;
      ctx.fillStyle = "rgba(124,58,237,0.15)";
      for (let x = -off; x < GW; x += 80) {
        ctx.beginPath();
        ctx.roundRect(x, GROUND_Y + 10, 40, 2, 1);
        ctx.fill();
      }
    };

    const drawPlayer = (s) => {
      const x = s.px, y = s.py;

      // Shadow on ground
      const shadowY = GROUND_Y + 5;
      const shadowScale = Math.max(0.3, 1 - (GROUND_Y - PH - y) / (GROUND_Y * 0.6));
      ctx.fillStyle = `rgba(124,58,237,${0.12 * shadowScale})`;
      ctx.beginPath();
      ctx.ellipse(x + PW / 2, shadowY, PW * 0.7 * shadowScale, 3 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      if (s.status === "dead") {
        // Red flash body
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.roundRect(x, y, PW, PH, 7);
        ctx.fill();
        // X
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 8); ctx.lineTo(x + PW - 6, y + 22);
        ctx.moveTo(x + PW - 6, y + 8); ctx.lineTo(x + 6, y + 22);
        ctx.stroke();
        ctx.lineWidth = 1;
        return;
      }

      // Body glow
      ctx.shadowColor = "#7c3aed";
      ctx.shadowBlur = 8;

      // Body
      ctx.fillStyle = "#7c3aed";
      ctx.beginPath();
      ctx.roundRect(x, y, PW, PH, 7);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Visor glass
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 4, PW - 8, 13, 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Eyes
      ctx.fillStyle = "#e0e7ff";
      ctx.beginPath();
      ctx.arc(x + 8, y + 11, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + PW - 8, y + 11, 3, 0, Math.PI * 2);
      ctx.fill();

      // Pupils — look forward
      ctx.fillStyle = "#4c1d95";
      ctx.beginPath();
      ctx.arc(x + 9, y + 11, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + PW - 7, y + 11, 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Chest stripe
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(x + 4, y + 20, PW - 8, 1);

      // Legs
      const legSwing = s.onGround ? Math.sin(s.frame * 0.35) * 4 : 0;
      ctx.fillStyle = "#6d28d9";
      ctx.beginPath();
      ctx.roundRect(x + 4, y + PH, 9, 7 + legSwing, 3);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x + PW - 13, y + PH, 9, 7 - legSwing, 3);
      ctx.fill();
    };

    const drawObstacle = (o) => {
      const x = Math.round(o.x);
      const top = GROUND_Y - o.h;

      ctx.shadowColor = "#10b981";
      ctx.shadowBlur = 10;

      // Stem
      ctx.fillStyle = "#059669";
      ctx.beginPath();
      ctx.roundRect(x, top, OW, o.h, [4, 4, 0, 0]);
      ctx.fill();

      // Top cap
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.roundRect(x - 5, top - 7, OW + 10, 11, 4);
      ctx.fill();

      ctx.shadowBlur = 0;

      // Highlight stripe
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.beginPath();
      ctx.roundRect(x + 4, top + 4, 4, o.h - 10, 2);
      ctx.fill();
    };

    const drawHUD = (s) => {
      const sc = Math.floor(s.score / 10);

      // Score
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "700 17px Inter, system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(String(sc).padStart(5, "0"), GW - 18, 28);

      // Best
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.font = "600 11px Inter, system-ui, sans-serif";
      ctx.fillText(`HI  ${String(s.best).padStart(5, "0")}`, GW - 18, 46);

      // Level badge
      const lvl = Math.floor(s.score / 600);
      if (lvl > 0) {
        ctx.fillStyle = "rgba(124,58,237,0.85)";
        ctx.beginPath();
        ctx.roundRect(14, 12, 44, 20, 6);
        ctx.fill();
        ctx.fillStyle = "#e0d7ff";
        ctx.font = "700 11px Inter, system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`LV ${lvl + 1}`, 20, 26);
      }

      ctx.textAlign = "left";
    };

    const drawIdle = (s) => {
      drawBg(s);
      drawPlayer(s);

      // Prompt box
      ctx.fillStyle = "rgba(15,12,35,0.7)";
      ctx.beginPath();
      ctx.roundRect(GW / 2 - 130, GH / 2 - 24, 260, 48, 12);
      ctx.fill();
      ctx.strokeStyle = "rgba(124,58,237,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "600 14px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Нажми Space или кликни", GW / 2, GH / 2 + 5);
      ctx.textAlign = "left";
    };

    const drawDead = (s) => {
      drawBg(s);
      s.obstacles.forEach(drawObstacle);
      drawPlayer(s);

      // Dark overlay
      ctx.fillStyle = "rgba(6,6,20,0.65)";
      ctx.fillRect(0, 0, GW, GH);

      // Card
      ctx.fillStyle = "rgba(20,15,45,0.95)";
      ctx.beginPath();
      ctx.roundRect(GW / 2 - 140, GH / 2 - 40, 280, 80, 14);
      ctx.fill();
      ctx.strokeStyle = "rgba(239,68,68,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#f87171";
      ctx.font = "700 17px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Игра окончена", GW / 2, GH / 2 - 10);

      ctx.fillStyle = "rgba(196,181,253,0.7)";
      ctx.font = "500 13px Inter, system-ui, sans-serif";
      ctx.fillText(`Счёт: ${Math.floor(s.score / 10)}   ·   Рекорд: ${s.best}`, GW / 2, GH / 2 + 12);

      ctx.fillStyle = "rgba(124,58,237,0.6)";
      ctx.font = "500 11px Inter, system-ui, sans-serif";
      ctx.fillText("Space / клик — заново", GW / 2, GH / 2 + 32);
      ctx.textAlign = "left";
    };

    // ── Main loop ─────────────────────────────────────────────────────────────
    const loop = () => {
      if (!alive) return;
      const s = stateRef.current;

      if (s.status === "idle") {
        s.frame++;
        // idle breathing bob
        s.py = GROUND_Y - PH + Math.sin(s.frame * 0.05) * 2;
        drawIdle(s);
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (s.status === "dead") {
        drawDead(s);
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // ── Running ────────────────────────────────────────────────────────────
      s.frame++;
      s.score++;
      s.speed = 5 + Math.floor(s.score / 600) * 0.9;

      // Physics
      s.vy += 0.7;          // gravity
      s.py += s.vy;

      // Land
      if (s.py >= GROUND_Y - PH) {
        s.py = GROUND_Y - PH;
        s.vy = 0;
        s.onGround = true;
      } else {
        s.onGround = false;
      }

      // NO ceiling — player can go anywhere above ground,
      // just gently stop if somehow above canvas
      if (s.py < 0) {
        s.py = 0;
        s.vy = 0;
      }

      // Spawn obstacles — probability-based with min gap
      const last = s.obstacles[s.obstacles.length - 1];
      const minGap = Math.max(200, 380 - Math.floor(s.score / 400) * 15);
      if (!last || last.x < GW - minGap) {
        if (Math.random() < 0.018) {
          s.obstacles.push({ x: GW + 10, h: 30 + Math.floor(Math.random() * 28) });
        }
      }

      // Move obstacles
      s.obstacles = s.obstacles.filter(o => o.x > -OW - 10);
      s.obstacles.forEach(o => { o.x -= s.speed; });

      // Draw
      drawBg(s);
      s.obstacles.forEach(drawObstacle);
      drawPlayer(s);
      drawHUD(s);

      // Collision — generous hitbox (5px padding all sides)
      const pb = { x: s.px + 5, y: s.py + 5, w: PW - 10, h: PH - 5 };
      let hit = false;
      for (const o of s.obstacles) {
        const ob = { x: o.x + 3, y: GROUND_Y - o.h + 5, w: OW - 6, h: o.h - 5 };
        if (pb.x < ob.x + ob.w && pb.x + pb.w > ob.x &&
            pb.y < ob.y + ob.h && pb.y + pb.h > ob.y) {
          hit = true;
          break;
        }
      }

      if (hit) {
        const final = Math.floor(s.score / 10);
        const isNew = final > s.best;
        if (isNew) s.best = final;
        s.status = "dead";
        saveScore(final);
        setUi({ status: "dead", score: final, best: s.best, newBest: isNew });
      } else {
        setUi(u => ({ ...u, status: "running", score: Math.floor(s.score / 10) }));
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [saveScore]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: "20px", alignItems: "start" }}>
      {/* Canvas */}
      <div>
        <canvas ref={canvasRef} onClick={handleInput}
          style={{ width: "100%", borderRadius: "14px", cursor: "pointer", display: "block", border: "1px solid rgba(124,58,237,0.2)" }} />
        <div style={{ textAlign: "center", marginTop: "8px", fontSize: "12px", color: "#475569" }}>
          {ui.status === "idle" && "Space / клик — старт · прыжок"}
          {ui.status === "running" && `Счёт: ${ui.score}`}
          {ui.status === "dead" && (
            <span>Счёт: <strong style={{ color: "#f87171" }}>{ui.score}</strong>
              {ui.newBest && <span style={{ color: "#f59e0b", marginLeft: "8px" }}>🏆 Новый рекорд!</span>}
            </span>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <div style={{ color: "#6366f1", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>
          🏆 Лидерборд
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {leaderboard.length === 0 ? (
            <div style={{ color: "#334155", fontSize: "12px" }}>Сыграй первым!</div>
          ) : leaderboard.map((e, i) => {
            const medals = ["🥇", "🥈", "🥉"];
            const rc = ROLE_COLORS[e.role] || "#6366f1";
            const isTop = i === 0;
            return (
              <div key={e.id} style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 10px",
                background: isTop ? "rgba(245,158,11,0.07)" : "rgba(255,255,255,0.03)",
                borderRadius: "10px",
                border: isTop ? "1px solid rgba(245,158,11,0.25)" : "1px solid rgba(255,255,255,0.06)",
              }}>
                <span style={{ fontSize: "13px", flexShrink: 0, width: "22px", textAlign: "center" }}>
                  {medals[i] || <span style={{ color: "#475569", fontSize: "11px" }}>{i + 1}</span>}
                </span>
                <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: `linear-gradient(135deg, ${rc}, ${rc}66)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {(e.name || "?")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0, color: "#e2e8f0", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {e.name}
                </div>
                <div style={{ color: isTop ? "#f59e0b" : "#6366f1", fontSize: "13px", fontWeight: 700, flexShrink: 0 }}>
                  {e.score}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── STAT TOOLTIPS ────────────────────────────────────────────────────────────
const TIPS = {
  posts:  "Количество публикаций добавленных сегодня всеми членами команды. Сравнивается с результатом вчерашнего дня.",
  reddit: "Сколько ячеек контент-планнера отмечено ✅ сегодня. Показывает активность на Reddit.",
  models: "Число активных моделей агентства. Неактивные не участвуют в планировании.",
  week:   "Суммарное число подтверждённых Reddit-публикаций за последние 7 дней по всем моделям.",
};

// ─── ROULETTE ─────────────────────────────────────────────────────────────────
function RouletteWheel({ users, t }) {
  const canvasRef = useRef(null);
  const [items, setItems] = useState([]);
  const [customInput, setCustomInput] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const spinRef = useRef({ angle: 0, velocity: 0, target: 0, spinning: false });
  const rafRef = useRef(null);
  const confettiRef = useRef([]);

  const SEGMENT_COLORS = [
    "#7c3aed","#db2877","#0ea5e9","#10b981","#f59e0b",
    "#8b5cf6","#06b6d4","#f97316","#84cc16","#ec4899",
    "#6366f1","#14b8a6","#ef4444","#a855f7","#3b82f6",
  ];

  // Init with team members
  useEffect(() => {
    if (users.length > 0 && items.length === 0) {
      setItems(users.slice(0, 10).map((u, i) => ({
        id: u.id,
        label: u.name || "—",
        emoji: u.avatarEmoji || "",
        color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
      })));
    }
  }, [users]);

  // Draw wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || items.length === 0) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const SIZE = 320;
    canvas.width  = SIZE * dpr;
    canvas.height = SIZE * dpr;
    canvas.style.width  = SIZE + "px";
    canvas.style.height = SIZE + "px";
    ctx.scale(dpr, dpr);

    const draw = (angle) => {
      const cx = SIZE / 2, cy = SIZE / 2, r = SIZE / 2 - 10;
      ctx.clearRect(0, 0, SIZE, SIZE);

      const seg = (Math.PI * 2) / items.length;

      // Outer glow
      const glow = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r + 10);
      glow.addColorStop(0, "rgba(124,58,237,0)");
      glow.addColorStop(1, "rgba(124,58,237,0.15)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
      ctx.fill();

      // Segments
      items.forEach((item, i) => {
        const start = angle + i * seg - Math.PI / 2;
        const end   = start + seg;
        const mid   = start + seg / 2;

        // Segment
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, end);
        ctx.closePath();
        ctx.fillStyle = item.color;
        ctx.fill();

        // Segment border
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, end);
        ctx.closePath();
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Shine overlay
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, end);
        ctx.closePath();
        const shine = ctx.createRadialGradient(
          cx + Math.cos(mid) * r * 0.4, cy + Math.sin(mid) * r * 0.4, 0,
          cx + Math.cos(mid) * r * 0.4, cy + Math.sin(mid) * r * 0.4, r * 0.5
        );
        shine.addColorStop(0, "rgba(255,255,255,0.15)");
        shine.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = shine;
        ctx.fill();

        // Text
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(mid);
        ctx.textAlign = "right";
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${items.length > 8 ? 11 : 13}px Inter, sans-serif`;
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;

        const textR = r * 0.75;
        const label = item.emoji ? `${item.emoji} ${item.label}` : item.label;
        const maxLen = 12;
        const display = label.length > maxLen ? label.slice(0, maxLen) + "…" : label;
        ctx.fillText(display, textR, 5);
        ctx.restore();
      });

      // Center circle
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      const centerGrad = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, 22);
      centerGrad.addColorStop(0, "#a78bfa");
      centerGrad.addColorStop(1, "#6d28d9");
      ctx.fillStyle = centerGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Center emoji
      ctx.font = "16px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🎰", cx, cy);

      // Outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 3;
      ctx.stroke();
    };

    // Pointer
    const drawPointer = () => {
      const SIZE = 320;
      const cx = SIZE / 2;
      ctx.save();
      ctx.translate(cx, 10);
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(12, 0);
      ctx.lineTo(0, 28);
      ctx.closePath();
      const pGrad = ctx.createLinearGradient(0, 0, 0, 28);
      pGrad.addColorStop(0, "#f59e0b");
      pGrad.addColorStop(1, "#ef4444");
      ctx.fillStyle = pGrad;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    };

    if (!spinRef.current.spinning) {
      draw(spinRef.current.angle);
      drawPointer();
      return;
    }

    let alive = true;
    const loop = () => {
      if (!alive) return;
      const s = spinRef.current;
      s.velocity *= 0.985;
      s.angle += s.velocity;

      draw(s.angle);
      drawPointer();

      if (s.velocity > 0.001) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        s.spinning = false;
        setSpinning(false);

        // Find winner
        const seg = (Math.PI * 2) / items.length;
        const norm = (((-s.angle % (Math.PI * 2)) + Math.PI / 2) + Math.PI * 2) % (Math.PI * 2);
        const idx = Math.floor(norm / seg) % items.length;
        const w = items[idx];
        setWinner(w);

        // Confetti
        confettiRef.current = Array.from({ length: 80 }, () => ({
          x: Math.random() * window.innerWidth,
          y: -10 - Math.random() * 100,
          vx: (Math.random() - 0.5) * 4,
          vy: 2 + Math.random() * 4,
          r: 4 + Math.random() * 6,
          color: SEGMENT_COLORS[Math.floor(Math.random() * SEGMENT_COLORS.length)],
          rot: Math.random() * Math.PI * 2,
          rotV: (Math.random() - 0.5) * 0.2,
        }));
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3500);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  }, [items, spinning]);

  const spin = () => {
    if (spinning || items.length < 2) return;
    setWinner(null);
    spinRef.current.spinning = true;
    spinRef.current.velocity = 0.25 + Math.random() * 0.2;
    setSpinning(true);
  };

  const addItem = () => {
    if (!customInput.trim() || items.length >= 15) return;
    setItems(prev => [...prev, {
      id: Date.now().toString(),
      label: customInput.trim(),
      emoji: "",
      color: SEGMENT_COLORS[prev.length % SEGMENT_COLORS.length],
    }]);
    setCustomInput("");
  };

  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));
  const resetToTeam = () => {
    setItems(users.slice(0, 10).map((u, i) => ({
      id: u.id, label: u.name || "—", emoji: u.avatarEmoji || "",
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    })));
    setWinner(null);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "28px", alignItems: "start" }}>
      {/* Wheel */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        <div style={{ position: "relative" }}>
          <canvas ref={canvasRef} style={{ display: "block", filter: spinning ? "drop-shadow(0 0 20px rgba(124,58,237,0.5))" : "drop-shadow(0 4px 12px rgba(0,0,0,0.3))", transition: "filter 0.3s" }} />
        </div>

        <motion.button onClick={spin} disabled={spinning || items.length < 2}
          whileHover={!spinning ? { scale: 1.05 } : {}}
          whileTap={!spinning ? { scale: 0.95 } : {}}
          style={{ padding: "13px 40px", borderRadius: "50px", border: "none", cursor: spinning || items.length < 2 ? "not-allowed" : "pointer", background: spinning ? "rgba(124,58,237,0.3)" : "linear-gradient(135deg, #7c3aed, #db2877)", color: "#fff", fontSize: "16px", fontWeight: 700, boxShadow: spinning ? "none" : "0 4px 20px rgba(124,58,237,0.4)" }}>
          {spinning ? "⏳ Крутится..." : "🎰 Крутить!"}
        </motion.button>

        {/* Winner */}
        <AnimatePresence>
          {winner && !spinning && (
            <motion.div initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: `${winner.color}20`, border: `2px solid ${winner.color}60`, borderRadius: "16px", padding: "16px 24px", textAlign: "center", width: "100%" }}>
              <div style={{ fontSize: "28px", marginBottom: "6px" }}>{winner.emoji || "🎉"}</div>
              <div style={{ color: winner.color, fontSize: "20px", fontWeight: 800 }}>{winner.label}</div>
              <div style={{ color: t.textMuted, fontSize: "12px", marginTop: "4px" }}>Победитель!</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <span style={{ color: t.textMuted, fontSize: "13px", fontWeight: 600 }}>Участники ({items.length}/15)</span>
          <button onClick={resetToTeam}
            style={{ background: "none", border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "8px", padding: "5px 12px", fontSize: "12px", cursor: "pointer" }}>
            ↺ Сброс команды
          </button>
        </div>

        {/* Items list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px", maxHeight: "280px", overflowY: "auto" }}>
          {items.map((item, i) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: t.bgCardHover, borderRadius: "10px", border: `1px solid ${t.border}` }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: item.color, flexShrink: 0 }} />
              <span style={{ color: t.text, fontSize: "13px", flex: 1 }}>{item.emoji} {item.label}</span>
              <button onClick={() => removeItem(item.id)}
                style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", padding: "2px", lineHeight: 1, fontSize: "16px" }}
                onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                onMouseLeave={e => e.currentTarget.style.color = t.textFaint}>
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Add custom */}
        {items.length < 15 && (
          <div style={{ display: "flex", gap: "8px" }}>
            <input value={customInput} onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addItem()}
              placeholder="Добавить участника..."
              style={{ flex: 1, background: t.bgInput, color: t.text, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "9px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit" }} />
            <button onClick={addItem} disabled={!customInput.trim()}
              style={{ background: customInput.trim() ? "linear-gradient(135deg, #7c3aed, #db2877)" : "rgba(124,58,237,0.2)", color: "#fff", border: "none", borderRadius: "10px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, cursor: customInput.trim() ? "pointer" : "not-allowed" }}>
              + Добавить
            </button>
          </div>
        )}

        <div style={{ marginTop: "16px", padding: "12px 14px", background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: "10px" }}>
          <div style={{ color: "#a78bfa", fontSize: "12px", lineHeight: "1.6" }}>
            💡 Используй рулетку чтобы выбрать кто первый пишет отчёт, кому достаётся задача или кто сегодня выбирает музыку
          </div>
        </div>
      </div>
    </div>
  );
}

// Confetti overlay
function ConfettiOverlay({ active, items }) {
  const canvasRef = useRef(null);
  const pieces = useRef([]);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ["#7c3aed","#db2877","#f59e0b","#10b981","#0ea5e9","#f97316","#a78bfa","#fbbf24"];
    pieces.current = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 80,
      vx: (Math.random() - 0.5) * 6,
      vy: 3 + Math.random() * 5,
      w: 8 + Math.random() * 10,
      h: 4 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.15,
      opacity: 1,
    }));

    let alive = true;
    const loop = () => {
      if (!alive) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.current.forEach(p => {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.12;
        p.rot += p.rotV;
        if (p.y > canvas.height * 0.7) p.opacity -= 0.02;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      pieces.current = pieces.current.filter(p => p.opacity > 0);
      if (pieces.current.length > 0) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9000 }} />;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const cardV = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } };
const contV = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

export default function Dashboard() {
  const { db, profile, user } = useAuth();
  const { theme: t } = useTheme();

  const [entries,   setEntries]   = useState([]);
  const [models,    setModels]    = useState([]);
  const [tasks,     setTasks]     = useState([]);
  const [grid,      setGrid]      = useState([]);
  const [users,     setUsers]     = useState([]);
  const [teams,     setTeams]     = useState([]);
  const [loading,   setLoading]   = useState(true);

  const isAdmin = [ROLES.OWNER, ROLES.ADMIN].includes(profile?.role);

  useEffect(() => {
    const unsubs = [
      onSnapshot(query(collection(db, "entries"), orderBy("createdAt", "desc"), limit(100)),
        snap => { setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); }),
      onSnapshot(collection(db, "models"),       snap => setModels(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "tasks"),        snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "content_grid"), snap => setGrid(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "users"),        snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "teams"),        snap => setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  // ── Scope data by team for chatter/team_lead ──────────────────────────────
  const isChatter  = profile?.role === "chatter";
  const isTeamLead = profile?.role === "team_lead";
  const isRestricted = isChatter || isTeamLead;

  const myTeamModelIds = isRestricted
    ? new Set(teams.filter(tm => (tm.memberIds || []).includes(profile?.uid)).flatMap(tm => tm.modelIds || []))
    : null;

  const myTeamMemberIds = isRestricted
    ? new Set(teams.filter(tm => (tm.memberIds || []).includes(profile?.uid)).flatMap(tm => tm.memberIds || []))
    : null;

  // Filtered entries — chatter sees only own, team_lead sees team
  const scopedEntries = isChatter
    ? entries.filter(e => e.userId === profile?.uid)
    : isTeamLead && myTeamMemberIds
    ? entries.filter(e => myTeamMemberIds.has(e.userId))
    : entries;

  // Filtered models
  const scopedModels = isRestricted && myTeamModelIds
    ? models.filter(m => myTeamModelIds.has(m.id))
    : models;

  // ── Derived stats ────────────────────────────────────────────────────────
  const todayStr     = new Date().toLocaleDateString("ru-RU");
  const ystrdayStr   = new Date(Date.now() - 86400000).toLocaleDateString("ru-RU");
  const todayEntries = scopedEntries.filter(e => e.date === todayStr);
  const todayCount   = todayEntries.length;
  const ystrdayCount = scopedEntries.filter(e => e.date === ystrdayStr).length;
  const diff         = todayCount - ystrdayCount;
  const diffPct      = ystrdayCount > 0 ? Math.round((diff / ystrdayCount) * 100) : 0;

  const activeModels   = scopedModels.filter(m => m.status !== "inactive");
  const inactiveModels = scopedModels.filter(m => m.status === "inactive");

  const todayPosted   = grid.filter(g => g.date === todayStr && g.status === "posted" && (!myTeamModelIds || myTeamModelIds.has(g.modelId))).length;
  const todayProblems = grid.filter(g => g.date === todayStr && g.status === "problem" && (!myTeamModelIds || myTeamModelIds.has(g.modelId))).length;
  const weekDates     = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i); return d.toLocaleDateString("ru-RU");
  });
  const weekPosted = grid.filter(g => weekDates.includes(g.date) && g.status === "posted" && (!myTeamModelIds || myTeamModelIds.has(g.modelId))).length;

  // Tasks scoped
  const openTasks   = tasks.filter(tk => {
    if (tk.column === "done") return false;
    if (isChatter) return tk.assigneeId === profile?.uid || tk.createdBy === profile?.uid;
    if (isTeamLead && myTeamMemberIds) return myTeamMemberIds.has(tk.assigneeId) || myTeamMemberIds.has(tk.createdBy);
    return true;
  });
  const urgentTasks = openTasks.filter(tk => tk.priority === "urgent");

  const stats = [
    {
      label: "Постов сегодня", value: todayCount, icon: Activity, color: "#7c3aed",
      trend: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
      sub: diff === 0 ? "Как вчера" : `${diff > 0 ? "+" : ""}${diff} (${diffPct}%)`,
      tip: TIPS.posts,
    },
    {
      label: "Reddit сегодня", value: todayPosted, icon: TrendingUp, color: "#0ea5e9",
      sub: todayProblems > 0 ? `⚠️ ${todayProblems} проблем` : "Без проблем",
      tip: TIPS.reddit,
    },
    {
      label: "Активных моделей", value: activeModels.length, icon: Users, color: "#10b981",
      sub: inactiveModels.length > 0 ? `${inactiveModels.length} неактивных` : "Все активны",
      tip: TIPS.models,
    },
    {
      label: "Reddit за неделю", value: weekPosted, icon: CheckSquare, color: "#f59e0b",
      sub: "публикаций подтверждено",
      tip: TIPS.week,
    },
  ];

  return (
    <div style={{ position: "relative" }}>
      <LiveBackground />
      <ConfettiOverlay active={false} />
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: t.text, marginBottom: "6px" }}>
          {(() => {
            const h = new Date().getHours();
            const greet = h < 5 ? "Ночная смена 🌙" : h < 12 ? "Доброе утро ☀️" : h < 17 ? "Добрый день 👋" : h < 22 ? "Добрый вечер 🌆" : "Ночная смена 🌙";
            return `${greet}, ${profile?.name?.split(" ")[0] || "—"}`;
          })()}
        </h1>
        <p style={{ color: t.textMuted, fontSize: "14px" }}>
          {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })} · Inferyx
        </p>
      </motion.div>

      {/* Stat cards */}
      <motion.div variants={contV} initial="hidden" animate="show"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {stats.map((s, i) => (
          <motion.div key={i} variants={cardV}
            style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "20px", position: "relative", overflow: "hidden" }}>
            {/* bg circle */}
            <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `${s.color}12`, pointerEvents: "none" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                {/* Label + tooltip */}
                <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "8px" }}>
                  <span style={{ color: t.textMuted, fontSize: "12px" }}>{s.label}</span>
                  <Tooltip text={s.tip} />
                </div>
                <div style={{ color: t.text, fontSize: "30px", fontWeight: 700, lineHeight: 1, marginBottom: "6px" }}>
                  {loading ? "—" : s.value}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {s.trend === "up"   && <TrendingUp   size={12} style={{ color: "#10b981" }} />}
                  {s.trend === "down" && <TrendingDown  size={12} style={{ color: "#ef4444" }} />}
                  <span style={{ color: s.trend === "up" ? "#10b981" : s.trend === "down" ? "#ef4444" : t.textMuted, fontSize: "12px" }}>
                    {s.sub}
                  </span>
                </div>
              </div>
              <div style={{ background: `${s.color}18`, borderRadius: "10px", padding: "10px", color: s.color, flexShrink: 0 }}>
                <s.icon size={20} />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Posts + Tasks row */}
      <div style={{ display: "grid", gridTemplateColumns: isAdmin ? "1fr 1fr" : "1fr", gap: "20px", marginBottom: "20px" }}>

        {/* Today's posts */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
          style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600 }}>Публикации сегодня</h3>
              <Tooltip text="Последние записи добавленные членами команды за сегодня. Платформа, модель, автор." />
            </div>
            <Clock size={15} style={{ color: t.textMuted }} />
          </div>
          {loading ? (
            <div style={{ color: t.textMuted, textAlign: "center", padding: "20px", fontSize: "13px" }}>Загрузка...</div>
          ) : todayEntries.length === 0 ? (
            <div style={{ color: t.textMuted, textAlign: "center", padding: "20px", fontSize: "13px" }}>Сегодня нет публикаций</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {todayEntries.slice(0, 5).map(e => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "10px", background: t.bgCardHover }}>
                  <span style={{ fontSize: "18px" }}>{e.platformIcon || "📌"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: t.text, fontSize: "13px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {e.platform} · {e.model || "—"}
                    </div>
                    <div style={{ color: t.textMuted, fontSize: "11px" }}>{e.adminName || e.admin} · {e.time}</div>
                  </div>
                  {e.traffic > 0 && <div style={{ color: "#10b981", fontSize: "12px", fontWeight: 600 }}>+{e.traffic}</div>}
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Tasks (admin only) */}
        {isAdmin && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
            style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600 }}>Открытые задачи</h3>
                <Tooltip text="Задачи ещё не завершённые. Видно только владельцам и администраторам." />
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {urgentTasks.length > 0 && (
                  <span style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px" }}>
                    🚨 {urgentTasks.length}
                  </span>
                )}
                <span style={{ background: t.bgCardHover, color: t.textMuted, fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "10px" }}>
                  {openTasks.length} всего
                </span>
              </div>
            </div>
            {openTasks.length === 0 ? (
              <div style={{ color: t.textMuted, textAlign: "center", padding: "20px", fontSize: "13px" }}>🎉 Все задачи выполнены!</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {openTasks.slice(0, 5).map(task => {
                  const prIcons = { low: "🔵", medium: "🟡", high: "🔴", urgent: "🚨" };
                  const colLabels = { todo: "📋", inprogress: "⚡", review: "👀" };
                  return (
                    <div key={task.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "10px", background: t.bgCardHover }}>
                      <span style={{ fontSize: "14px" }}>{prIcons[task.priority] || "🟡"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: t.text, fontSize: "13px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</div>
                        <div style={{ color: t.textMuted, fontSize: "11px" }}>{colLabels[task.column]} {task.assigneeName || "Не назначен"}</div>
                      </div>
                    </div>
                  );
                })}
                {openTasks.length > 5 && (
                  <div style={{ color: t.textFaint, fontSize: "12px", textAlign: "center" }}>+ ещё {openTasks.length - 5}</div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Models */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600 }}>Модели</h3>
            <Tooltip text="Все модели агентства. Зелёная метка — подтверждённые публикации сегодня." />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <span style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "10px" }}>
              ✅ {activeModels.length} активных
            </span>
            {inactiveModels.length > 0 && (
              <span style={{ background: t.bgCardHover, color: t.textMuted, fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "10px" }}>
                ⏸ {inactiveModels.length}
              </span>
            )}
          </div>
        </div>
        {models.length === 0 ? (
          <div style={{ color: t.textMuted, fontSize: "13px" }}>Нет моделей</div>
        ) : (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {models.map(m => {
              const color = m.color || "#7c3aed";
              const isActive = m.status !== "inactive";
              const posts = grid.filter(g => g.modelId === m.id && g.date === todayStr && g.status === "posted").length;
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", background: t.bgCardHover, borderRadius: "10px", border: `1px solid ${isActive ? color + "30" : t.border}`, opacity: isActive ? 1 : 0.5 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "8px", background: `linear-gradient(135deg, ${color}, ${color}77)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
                    {m.emoji || m.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{m.name}</div>
                    <div style={{ color: posts > 0 ? "#10b981" : t.textFaint, fontSize: "11px" }}>
                      {posts > 0 ? `✅ ${posts} постов` : "Нет постов сегодня"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Mini-game */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
        style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Zap size={18} style={{ color: "#7c3aed" }} />
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600 }}>Мини-игра</h3>
            <span style={{ color: t.textFaint, fontSize: "12px" }}>для мотивации 😄</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Tooltip text="Прыгай через препятствия! Рекорды сохраняются и видны всей команде в топе справа." />
            <Trophy size={16} style={{ color: "#f59e0b" }} />
          </div>
        </div>
        <DinoGame profile={profile} db={db} user={user} />
      </motion.div>

    </div>
  );
}
