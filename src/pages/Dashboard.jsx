import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { collection, onSnapshot, orderBy, query, limit, setDoc, doc, getDoc } from "firebase/firestore";
import { useAuth, ROLE_COLORS, ROLES } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { TrendingUp, TrendingDown, Users, CheckSquare, Activity, Clock, Trophy, Zap, Info } from "lucide-react";

// ─── TOOLTIP ─────────────────────────────────────────────────────────────────
function Tooltip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}>
      <Info size={13} style={{ color: "#475569", cursor: "help" }} />
      {show && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          background: "#1e1b4b", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "8px",
          padding: "8px 12px", fontSize: "12px", color: "#e2e8f0", whiteSpace: "nowrap",
          zIndex: 999, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", maxWidth: "220px", whiteSpace: "normal",
          lineHeight: "1.5", pointerEvents: "none",
        }}>
          {text}
          <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid rgba(124,58,237,0.3)" }} />
        </div>
      )}
    </div>
  );
}

// ─── DINO GAME ───────────────────────────────────────────────────────────────
const GW = 580, GH = 200, GROUND_Y = 160;
const DW = 32, DH = 44;
const CW = 22, CH = 44;

function DinoGame({ profile, db, user }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    status: "idle", // idle | running | dead
    score: 0, speed: 4, frame: 0, best: 0,
    dino: { x: 70, y: GROUND_Y - DH, vy: 0, onGround: true },
    cacti: [],
  });
  const rafRef = useRef(null);
  const [display, setDisplay] = useState({ status: "idle", score: 0, best: 0, newBest: false });
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "game_scores"), snap => {
      setLeaderboard(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => b.score - a.score).slice(0, 8)
      );
    });
    return () => unsub();
  }, [db]);

  const saveScore = useCallback(async (s) => {
    if (!user?.uid || !db) return;
    try {
      const ref = doc(db, "game_scores", user.uid);
      const ex = await getDoc(ref);
      if (!ex.exists() || ex.data().score < s) {
        await setDoc(ref, { score: s, name: profile?.name || "—", role: profile?.role || "", updatedAt: new Date().toISOString() });
      }
    } catch (e) {}
  }, [user?.uid, db, profile]);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.status = "running"; s.score = 0; s.speed = 4; s.frame = 0;
    s.dino = { x: 70, y: GROUND_Y - DH, vy: 0, onGround: true };
    s.cacti = [];
    setDisplay(d => ({ ...d, status: "running", score: 0, newBest: false }));
  }, []);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s.status === "running" && s.dino.onGround) {
      s.dino.vy = -13;
      s.dino.onGround = false;
    }
  }, []);

  const handleInput = useCallback(() => {
    const s = stateRef.current;
    if (s.status === "idle" || s.status === "dead") startGame();
    else if (s.status === "running") jump();
  }, [startGame, jump]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); handleInput(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleInput]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let alive = true;

    const drawDino = (x, y, frame) => {
      // Body
      ctx.fillStyle = "#7c3aed";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, DW, DH, 7);
      else ctx.rect(x, y, DW, DH);
      ctx.fill();
      // Eye
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x + DW - 8, y + 9, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1e1b4b";
      ctx.beginPath(); ctx.arc(x + DW - 7, y + 9, 3, 0, Math.PI * 2); ctx.fill();
      // Tail
      ctx.fillStyle = "#6d28d9";
      ctx.fillRect(x - 8, y + DH - 14, 10, 8);
      // Legs
      const lo = stateRef.current.dino.onGround ? Math.sin(frame * 0.35) * 5 : 0;
      ctx.fillStyle = "#6d28d9";
      ctx.fillRect(x + 5, y + DH, 9, 8 + lo);
      ctx.fillRect(x + 17, y + DH, 9, 8 - lo);
    };

    const drawCactus = (x, y) => {
      ctx.fillStyle = "#10b981";
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, CW, CH, 4); ctx.fill(); }
      else ctx.fillRect(x, y, CW, CH);
      ctx.fillRect(x - 8, y + 10, 10, 12);
      ctx.fillRect(x + CW - 2, y + 10, 10, 12);
      ctx.fillRect(x - 8, y + 6, 8, 6);
      ctx.fillRect(x + CW, y + 6, 8, 6);
    };

    const loop = () => {
      if (!alive) return;
      const s = stateRef.current;
      ctx.clearRect(0, 0, GW, GH);

      // Sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, GH);
      grad.addColorStop(0, "#0a0a1a");
      grad.addColorStop(1, "#0f0f2a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, GW, GH);

      // Stars
      if (s.frame % 3 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(Math.random() * GW, Math.random() * (GROUND_Y - 40), 1, 1);
        }
      }

      // Ground
      ctx.fillStyle = "#334155";
      ctx.fillRect(0, GROUND_Y, GW, 2);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, GROUND_Y + 2, GW, GH - GROUND_Y - 2);

      // Moving ground lines
      const lineOffset = (s.frame * s.speed) % 60;
      ctx.fillStyle = "#2d3748";
      for (let x = -lineOffset; x < GW; x += 60) {
        ctx.fillRect(x, GROUND_Y + 2, 30, 2);
      }

      if (s.status === "idle") {
        drawDino(70, GROUND_Y - DH, 0);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "bold 15px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Нажми SPACE или кликни чтобы начать", GW / 2, GH / 2 - 10);
        ctx.textAlign = "left";
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (s.status === "dead") {
        drawDino(70, GROUND_Y - DH, 0);
        s.cacti.forEach(c => drawCactus(c.x, c.y));
        ctx.fillStyle = "rgba(239,68,68,0.15)";
        ctx.fillRect(0, 0, GW, GH);
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 18px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("💀 Нажми SPACE чтобы заново", GW / 2, GH / 2 - 10);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px Inter, sans-serif";
        ctx.fillText(`Счёт: ${Math.floor(s.score / 10)}  Рекорд: ${s.best}`, GW / 2, GH / 2 + 16);
        ctx.textAlign = "left";
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Running
      s.frame++;
      s.score++;
      s.speed = 4 + Math.floor(s.score / 400) * 0.6;

      // Dino physics
      s.dino.vy += 0.75;
      s.dino.y += s.dino.vy;
      if (s.dino.y >= GROUND_Y - DH) {
        s.dino.y = GROUND_Y - DH;
        s.dino.vy = 0;
        s.dino.onGround = true;
      }
      // Ceiling
      if (s.dino.y < 5) { s.dino.y = 5; s.dino.vy = 0; }

      // Spawn cactus
      const rate = Math.max(55, 110 - Math.floor(s.score / 300) * 5);
      if (s.frame % rate === 0 && (s.cacti.length === 0 || s.cacti[s.cacti.length - 1].x < GW - 150)) {
        s.cacti.push({ x: GW + 10, y: GROUND_Y - CH });
      }

      s.cacti = s.cacti.filter(c => c.x > -CW - 20);
      s.cacti.forEach(c => {
        c.x -= s.speed;
        drawCactus(c.x, c.y);
      });

      drawDino(s.dino.x, s.dino.y, s.frame);

      // Score
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 14px monospace";
      ctx.fillText(`${Math.floor(s.score / 10)}`, GW - 60, 22);
      ctx.fillStyle = "#334155";
      ctx.font = "11px monospace";
      ctx.fillText(`BEST ${s.best}`, GW - 60, 38);

      // Speed indicator
      const speedLevel = Math.floor(s.score / 400);
      if (speedLevel > 0) {
        ctx.fillStyle = "#7c3aed";
        ctx.font = "11px monospace";
        ctx.fillText(`LVL ${speedLevel + 1}`, 10, 22);
      }

      // Collision
      const db = { x: s.dino.x + 6, y: s.dino.y + 6, w: DW - 12, h: DH - 6 };
      for (const c of s.cacti) {
        const cb = { x: c.x + 4, y: c.y + 4, w: CW - 8, h: CH - 4 };
        if (db.x < cb.x + cb.w && db.x + db.w > cb.x && db.y < cb.y + cb.h && db.y + db.h > cb.y) {
          const final = Math.floor(s.score / 10);
          const isNew = final > s.best;
          if (isNew) s.best = final;
          s.status = "dead";
          saveScore(final);
          setDisplay({ status: "dead", score: final, best: s.best, newBest: isNew });
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
      }

      setDisplay(d => ({ ...d, score: Math.floor(s.score / 10) }));
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  }, [saveScore]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: "20px", alignItems: "start" }}>
      <div>
        <canvas ref={canvasRef} width={GW} height={GH} onClick={handleInput}
          style={{ width: "100%", height: "auto", borderRadius: "12px", cursor: "pointer", display: "block", border: "1px solid rgba(124,58,237,0.2)" }} />
        <div style={{ textAlign: "center", marginTop: "8px", fontSize: "12px", color: "#64748b" }}>
          {display.status === "idle" && "🦕 Space / клик — прыжок"}
          {display.status === "running" && `Счёт: ${display.score}`}
          {display.status === "dead" && (
            <span>
              Счёт: <strong style={{ color: "#ef4444" }}>{display.score}</strong>
              {display.newBest && <span style={{ color: "#f59e0b", marginLeft: "6px" }}>🏆 Новый рекорд!</span>}
            </span>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <div style={{ color: "#64748b", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>🏆 Топ</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          {leaderboard.length === 0 ? (
            <div style={{ color: "#334155", fontSize: "12px" }}>Сыграй первым!</div>
          ) : leaderboard.map((e, i) => {
            const medals = ["🥇", "🥈", "🥉"];
            const rc = ROLE_COLORS[e.role] || "#64748b";
            return (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 10px", background: i === 0 ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.03)", borderRadius: "8px", border: i === 0 ? "1px solid rgba(245,158,11,0.2)" : "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: "13px", flexShrink: 0, width: "18px" }}>{medals[i] || `${i + 1}.`}</span>
                <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: `linear-gradient(135deg, ${rc}, ${rc}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {(e.name || "?")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0, color: "#e2e8f0", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                <div style={{ color: i === 0 ? "#f59e0b" : "#64748b", fontSize: "13px", fontWeight: 700, flexShrink: 0 }}>{e.score}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const cardV = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const contV = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

const STAT_TOOLTIPS = {
  posts: "Количество публикаций добавленных сегодня всеми членами команды. Сравнивается с вчерашним днём.",
  reddit: "Сколько ячеек в контент-планнере отмечено как ✅ сегодня. Показывает активность публикаций на Reddit.",
  models: "Количество моделей со статусом Активна. Неактивные модели не участвуют в контент-планировании.",
  weekReddit: "Общее количество подтверждённых публикаций на Reddit за последние 7 дней по всем моделям.",
};

export default function Dashboard() {
  const { db, profile, user } = useAuth();
  const { theme } = useTheme();
  const t = theme;

  const [entries, setEntries] = useState([]);
  const [models, setModels] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [gridStats, setGridStats] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAdminOrOwner = [ROLES.OWNER, ROLES.ADMIN].includes(profile?.role);

  useEffect(() => {
    const unsubs = [
      onSnapshot(query(collection(db, "entries"), orderBy("createdAt", "desc"), limit(100)),
        snap => { setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); }),
      onSnapshot(collection(db, "models"), snap => setModels(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "tasks"), snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "content_grid"), snap => setGridStats(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  const today = new Date().toLocaleDateString("ru-RU");
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("ru-RU");
  const todayEntries = entries.filter(e => e.date === today);
  const yesterdayCount = entries.filter(e => e.date === yesterday).length;
  const todayCount = todayEntries.length;
  const diff = todayCount - yesterdayCount;
  const diffPct = yesterdayCount > 0 ? Math.round((diff / yesterdayCount) * 100) : 0;

  const activeModels = models.filter(m => m.status !== "inactive");
  const inactiveModels = models.filter(m => m.status === "inactive");
  const todayRedditPosted = gridStats.filter(g => g.date === today && g.status === "posted").length;
  const todayRedditProblems = gridStats.filter(g => g.date === today && g.status === "problem").length;
  const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toLocaleDateString("ru-RU"); });
  const weekReddit = gridStats.filter(g => weekDates.includes(g.date) && g.status === "posted").length;
  const openTasks = tasks.filter(t => t.column !== "done");
  const urgentTasks = tasks.filter(t => t.priority === "urgent" && t.column !== "done");

  const stats = [
    { label: "Постов сегодня", value: todayCount, sub: diff === 0 ? "Как вчера" : `${diff > 0 ? "+" : ""}${diff} (${diffPct}%)`, icon: Activity, color: "#7c3aed", trend: diff > 0 ? "up" : diff < 0 ? "down" : "same", tooltip: STAT_TOOLTIPS.posts },
    { label: "Reddit сегодня", value: todayRedditPosted, sub: todayRedditProblems > 0 ? `⚠️ ${todayRedditProblems} проблем` : "Без проблем", icon: TrendingUp, color: "#0ea5e9", tooltip: STAT_TOOLTIPS.reddit },
    { label: "Активных моделей", value: activeModels.length, sub: inactiveModels.length > 0 ? `${inactiveModels.length} неактивных` : "Все активны", icon: Users, color: "#10b981", tooltip: STAT_TOOLTIPS.models },
    { label: "Reddit за неделю", value: weekReddit, sub: "публикаций подтверждено", icon: CheckSquare, color: "#f59e0b", tooltip: STAT_TOOLTIPS.weekReddit },
  ];

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: t.text, marginBottom: "6px" }}>
          Привет, {profile?.name?.split(" ")[0] || "—"} 👋
        </h1>
        <p style={{ color: t.textMuted, fontSize: "14px" }}>
          {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })} · Inferyx
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div variants={contV} initial="hidden" animate="show"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {stats.map((s, i) => (
          <motion.div key={i} variants={cardV}
            style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "20px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "80px", height: "80px", borderRadius: "50%", background: `${s.color}15` }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <span style={{ color: t.textMuted, fontSize: "12px" }}>{s.label}</span>
                  <Tooltip text={s.tooltip} />
                </div>
                <div style={{ color: t.text, fontSize: "28px", fontWeight: 700, lineHeight: 1 }}>{loading ? "—" : s.value}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "6px" }}>
                  {s.trend === "up" && <TrendingUp size={12} style={{ color: "#10b981" }} />}
                  {s.trend === "down" && <TrendingDown size={12} style={{ color: "#ef4444" }} />}
                  <span style={{ color: s.trend === "up" ? "#10b981" : s.trend === "down" ? "#ef4444" : t.textMuted, fontSize: "12px" }}>{s.sub}</span>
                </div>
              </div>
              <div style={{ background: `${s.color}20`, borderRadius: "10px", padding: "10px", color: s.color, flexShrink: 0 }}><s.icon size={20} /></div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: isAdminOrOwner ? "1fr 1fr" : "1fr", gap: "20px", marginBottom: "20px" }}>
        {/* Recent posts */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
          style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600 }}>Публикации сегодня</h3>
              <Tooltip text="Последние записи добавленные членами команды за сегодня. Показывает платформу, модель и автора." />
            </div>
            <Clock size={15} style={{ color: t.textMuted }} />
          </div>
          {loading ? (
            <div style={{ color: t.textMuted, textAlign: "center", padding: "20px" }}>Загрузка...</div>
          ) : todayEntries.length === 0 ? (
            <div style={{ color: t.textMuted, textAlign: "center", padding: "20px", fontSize: "13px" }}>Сегодня нет публикаций</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {todayEntries.slice(0, 5).map((e, i) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "10px", background: t.bgCardHover }}>
                  <span style={{ fontSize: "18px" }}>{e.platformIcon || "📌"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: t.text, fontSize: "13px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.platform} · {e.model || "—"}</div>
                    <div style={{ color: t.textMuted, fontSize: "11px" }}>{e.adminName || e.admin} · {e.time}</div>
                  </div>
                  {e.traffic > 0 && <div style={{ color: "#10b981", fontSize: "12px", fontWeight: 600, flexShrink: 0 }}>+{e.traffic}</div>}
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Tasks */}
        {isAdminOrOwner && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
            style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600 }}>Открытые задачи</h3>
                <Tooltip text="Задачи которые ещё не выполнены. Видно только владельцам и администраторам." />
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {urgentTasks.length > 0 && <span style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px" }}>🚨 {urgentTasks.length}</span>}
                <span style={{ background: t.bgCardHover, color: t.textMuted, fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "10px" }}>{openTasks.length} всего</span>
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
                {openTasks.length > 5 && <div style={{ color: t.textFaint, fontSize: "12px", textAlign: "center" }}>+ ещё {openTasks.length - 5}</div>}
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
            <Tooltip text="Список всех моделей агентства. Зелёная метка показывает количество подтверждённых публикаций сегодня." />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <span style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "10px" }}>✅ {activeModels.length} активных</span>
            {inactiveModels.length > 0 && <span style={{ background: t.bgCardHover, color: t.textMuted, fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "10px" }}>⏸ {inactiveModels.length}</span>}
          </div>
        </div>
        {models.length === 0 ? (
          <div style={{ color: t.textMuted, fontSize: "13px" }}>Нет моделей</div>
        ) : (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {models.map(m => {
              const color = m.color || "#7c3aed";
              const isActive = m.status !== "inactive";
              const modelPosts = gridStats.filter(g => g.modelId === m.id && g.date === today && g.status === "posted").length;
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", background: t.bgCardHover, borderRadius: "10px", border: `1px solid ${isActive ? color + "30" : t.border}`, opacity: isActive ? 1 : 0.5 }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: `linear-gradient(135deg, ${color}, ${color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
                    {m.emoji || m.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{m.name}</div>
                    <div style={{ color: modelPosts > 0 ? "#10b981" : t.textFaint, fontSize: "11px" }}>
                      {modelPosts > 0 ? `✅ ${modelPosts} постов` : "Нет постов сегодня"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Dino Game */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
        style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Zap size={18} style={{ color: "#7c3aed" }} />
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600 }}>Мини-игра</h3>
            <span style={{ color: t.textFaint, fontSize: "12px" }}>для мотивации 😄</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Tooltip text="Прыгай через кактусы! Рекорды сохраняются и видны всей команде в топе справа." />
            <Trophy size={16} style={{ color: "#f59e0b" }} />
          </div>
        </div>
        <DinoGame profile={profile} db={db} user={user} />
      </motion.div>
    </div>
  );
}