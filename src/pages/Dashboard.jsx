import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, orderBy, query, limit, setDoc, doc, getDoc } from "firebase/firestore";
import { useAuth, ROLE_COLORS, ROLE_LABELS_DISPLAY, ROLES } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { TrendingUp, TrendingDown, Users, CheckSquare, Activity, ArrowUpRight, Clock, Trophy, Zap } from "lucide-react";

// ─── DINO GAME ───────────────────────────────────────────────────────────────
const GAME_W = 600, GAME_H = 150, GROUND = 110, DINO_W = 30, DINO_H = 40;
const CACTUS_W = 20, CACTUS_H = 40;

function DinoGame({ profile, db, user }) {
  const canvasRef = useRef(null);
  const gameRef = useRef({
    running: false, score: 0, speed: 4,
    dino: { x: 60, y: GROUND - DINO_H, vy: 0, jumping: false },
    cacti: [], frame: 0, best: 0,
  });
  const rafRef = useRef(null);
  const [gameState, setGameState] = useState("idle"); // idle, running, dead
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    onSnapshot(collection(db, "game_scores"), snap => {
      const scores = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => b.score - a.score).slice(0, 10);
      setLeaderboard(scores);
    });
  }, [db]);

  const saveScore = async (s) => {
    if (!user?.uid) return;
    const ref = doc(db, "game_scores", user.uid);
    const existing = await getDoc(ref);
    if (!existing.exists() || existing.data().score < s) {
      await setDoc(ref, { score: s, name: profile?.name || "—", role: profile?.role || "", updatedAt: new Date().toISOString() });
    }
  };

  const jump = useCallback(() => {
    const g = gameRef.current;
    if (!g.dino.jumping && g.running) {
      g.dino.vy = -12;
      g.dino.jumping = true;
    }
  }, []);

  const startGame = useCallback(() => {
    const g = gameRef.current;
    g.running = true; g.score = 0; g.speed = 4; g.frame = 0;
    g.dino = { x: 60, y: GROUND - DINO_H, vy: 0, jumping: false };
    g.cacti = [];
    setGameState("running"); setScore(0);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (gameRef.current.running) jump();
        else if (gameState === "idle" || gameState === "dead") startGame();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jump, startGame, gameState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const loop = () => {
      const g = gameRef.current;
      ctx.clearRect(0, 0, GAME_W, GAME_H);

      // Ground
      ctx.fillStyle = "#475569";
      ctx.fillRect(0, GROUND, GAME_W, 2);

      if (!g.running) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      g.frame++;
      g.score++;
      g.speed = 4 + Math.floor(g.score / 300) * 0.5;

      // Dino physics
      g.dino.vy += 0.7;
      g.dino.y += g.dino.vy;
      if (g.dino.y >= GROUND - DINO_H) {
        g.dino.y = GROUND - DINO_H;
        g.dino.vy = 0;
        g.dino.jumping = false;
      }

      // Spawn cactus
      if (g.frame % Math.max(60, 120 - Math.floor(g.score / 100)) === 0) {
        g.cacti.push({ x: GAME_W, y: GROUND - CACTUS_H, w: CACTUS_W, h: CACTUS_H });
      }

      // Move & draw cacti
      g.cacti = g.cacti.filter(c => c.x > -CACTUS_W);
      g.cacti.forEach(c => {
        c.x -= g.speed;
        ctx.fillStyle = "#10b981";
        ctx.beginPath();
        ctx.roundRect(c.x, c.y, c.w, c.h, 4);
        ctx.fill();
        // Cactus arms
        ctx.fillRect(c.x - 6, c.y + 8, 6, 10);
        ctx.fillRect(c.x + c.w, c.y + 8, 6, 10);
      });

      // Draw dino
      const dx = g.dino.x, dy = g.dino.y;
      ctx.fillStyle = "#7c3aed";
      ctx.beginPath();
      ctx.roundRect(dx, dy, DINO_W, DINO_H, 6);
      ctx.fill();
      // Eye
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(dx + DINO_W - 7, dy + 8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(dx + DINO_W - 6, dy + 8, 2, 0, Math.PI * 2);
      ctx.fill();
      // Legs animation
      const legOffset = g.dino.jumping ? 0 : Math.sin(g.frame * 0.3) * 4;
      ctx.fillStyle = "#6d28d9";
      ctx.fillRect(dx + 4, dy + DINO_H, 8, 6 + legOffset);
      ctx.fillRect(dx + 16, dy + DINO_H, 8, 6 - legOffset);

      // Score
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 14px monospace";
      ctx.fillText(`${Math.floor(g.score / 10)}`, GAME_W - 80, 20);

      // Collision
      const dBox = { x: dx + 4, y: dy + 4, w: DINO_W - 8, h: DINO_H - 4 };
      for (const c of g.cacti) {
        if (dBox.x < c.x + c.w && dBox.x + dBox.w > c.x && dBox.y < c.y + c.h && dBox.y + dBox.h > c.y) {
          g.running = false;
          const finalScore = Math.floor(g.score / 10);
          if (finalScore > g.best) g.best = finalScore;
          saveScore(finalScore);
          setBest(g.best);
          setScore(finalScore);
          setGameState("dead");
          return;
        }
      }

      setScore(Math.floor(g.score / 10));
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div>
      <canvas ref={canvasRef} width={GAME_W} height={GAME_H}
        onClick={() => { if (gameRef.current.running) jump(); else startGame(); }}
        style={{ width: "100%", height: "auto", borderRadius: "12px", cursor: "pointer", display: "block", background: "rgba(0,0,0,0.1)" }} />
      {gameState === "idle" && (
        <div style={{ textAlign: "center", marginTop: "10px", color: "#64748b", fontSize: "13px" }}>
          Нажми <kbd style={{ background: "rgba(255,255,255,0.1)", padding: "2px 7px", borderRadius: "4px", fontFamily: "monospace" }}>Space</kbd> или кликни чтобы начать
        </div>
      )}
      {gameState === "dead" && (
        <div style={{ textAlign: "center", marginTop: "10px" }}>
          <span style={{ color: "#ef4444", fontWeight: 700, fontSize: "14px" }}>Счёт: {score}</span>
          {score >= best && score > 0 && <span style={{ color: "#f59e0b", marginLeft: "8px", fontSize: "13px" }}>🏆 Новый рекорд!</span>}
          <span style={{ color: "#64748b", fontSize: "13px", marginLeft: "12px" }}>Нажми Space или кликни чтобы заново</span>
        </div>
      )}
      {gameState === "running" && (
        <div style={{ textAlign: "center", marginTop: "6px", color: "#64748b", fontSize: "12px" }}>
          Space / клик — прыжок
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const card = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

export default function Dashboard() {
  const { db, profile, user } = useAuth();
  const { theme } = useTheme();
  const t = theme;

  const [entries, setEntries] = useState([]);
  const [users, setUsers] = useState([]);
  const [models, setModels] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [gridStats, setGridStats] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAdminOrOwner = [ROLES.OWNER, ROLES.ADMIN].includes(profile?.role);

  useEffect(() => {
    const unsubs = [
      onSnapshot(query(collection(db, "entries"), orderBy("createdAt", "desc"), limit(100)), snap => {
        setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }),
      onSnapshot(collection(db, "users"), snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "models"), snap => setModels(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "tasks"), snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "content_grid"), snap => setGridStats(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  const today = new Date().toLocaleDateString("ru-RU");
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("ru-RU");

  const todayEntries = entries.filter(e => e.date === today);
  const yesterdayEntries = entries.filter(e => e.date === yesterday);
  const todayCount = todayEntries.length;
  const yesterdayCount = yesterdayEntries.length;
  const diff = todayCount - yesterdayCount;
  const diffPct = yesterdayCount > 0 ? Math.round((diff / yesterdayCount) * 100) : 0;

  const activeModels = models.filter(m => m.status !== "inactive");
  const inactiveModels = models.filter(m => m.status === "inactive");

  // Reddit stats from content_grid
  const todayRedditPosted = gridStats.filter(g => g.date === today && g.status === "posted").length;
  const todayRedditProblems = gridStats.filter(g => g.date === today && g.status === "problem").length;
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toLocaleDateString("ru-RU");
  });
  const weekReddit = gridStats.filter(g => weekDates.includes(g.date) && g.status === "posted").length;

  // Tasks for admins
  const openTasks = tasks.filter(t => t.column !== "done");
  const urgentTasks = tasks.filter(t => t.priority === "urgent" && t.column !== "done");

  const stats = [
    {
      label: "Постов сегодня", value: todayCount,
      sub: diff === 0 ? "Как вчера" : `${diff > 0 ? "+" : ""}${diff} к вчера (${diffPct}%)`,
      icon: Activity, color: "#7c3aed",
      trend: diff > 0 ? "up" : diff < 0 ? "down" : "same",
    },
    {
      label: "Reddit сегодня", value: todayRedditPosted,
      sub: todayRedditProblems > 0 ? `⚠️ ${todayRedditProblems} проблем` : "Без проблем",
      icon: TrendingUp, color: "#0ea5e9",
    },
    {
      label: "Активных моделей", value: activeModels.length,
      sub: inactiveModels.length > 0 ? `${inactiveModels.length} неактивных` : "Все активны",
      icon: Users, color: "#10b981",
    },
    {
      label: "Reddit за неделю", value: weekReddit,
      sub: "публикаций подтверждено",
      icon: CheckSquare, color: "#f59e0b",
    },
  ];

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: t.text, marginBottom: "6px" }}>
          Привет, {profile?.name?.split(" ")[0] || "—"} 👋
        </h1>
        <p style={{ color: t.textMuted, fontSize: "14px" }}>
          {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })} · Inferyx
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div variants={container} initial="hidden" animate="show"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        {stats.map((s, i) => (
          <motion.div key={i} variants={card}
            style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "20px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "80px", height: "80px", borderRadius: "50%", background: `${s.color}15` }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ color: t.textMuted, fontSize: "12px", marginBottom: "6px" }}>{s.label}</div>
                <div style={{ color: t.text, fontSize: "28px", fontWeight: 700, lineHeight: 1 }}>
                  {loading ? "—" : s.value}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "6px" }}>
                  {s.trend === "up" && <TrendingUp size={12} style={{ color: "#10b981" }} />}
                  {s.trend === "down" && <TrendingDown size={12} style={{ color: "#ef4444" }} />}
                  <span style={{ color: s.trend === "up" ? "#10b981" : s.trend === "down" ? "#ef4444" : t.textMuted, fontSize: "12px" }}>
                    {s.sub}
                  </span>
                </div>
              </div>
              <div style={{ background: `${s.color}20`, borderRadius: "10px", padding: "10px", color: s.color }}>
                <s.icon size={20} />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: isAdminOrOwner ? "1fr 1fr" : "1fr", gap: "20px", marginBottom: "20px" }}>
        {/* Recent posts */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
          style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600 }}>Последние публикации</h3>
            <Clock size={15} style={{ color: t.textMuted }} />
          </div>
          {loading ? (
            <div style={{ color: t.textMuted, textAlign: "center", padding: "20px" }}>Загрузка...</div>
          ) : todayEntries.length === 0 ? (
            <div style={{ color: t.textMuted, textAlign: "center", padding: "20px", fontSize: "13px" }}>Сегодня нет публикаций</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {todayEntries.slice(0, 5).map((e, i) => (
                <motion.div key={e.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "10px", background: t.bgCardHover }}>
                  <span style={{ fontSize: "18px" }}>{e.platformIcon || "📌"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: t.text, fontSize: "13px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {e.platform} · {e.model || "—"}
                    </div>
                    <div style={{ color: t.textMuted, fontSize: "11px" }}>{e.adminName || e.admin} · {e.time}</div>
                  </div>
                  {e.traffic > 0 && <div style={{ color: "#10b981", fontSize: "12px", fontWeight: 600, flexShrink: 0 }}>+{e.traffic}</div>}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Tasks preview — only admins/owners */}
        {isAdminOrOwner && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
            style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600 }}>Задачи</h3>
              <div style={{ display: "flex", gap: "6px" }}>
                {urgentTasks.length > 0 && (
                  <span style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px" }}>
                    🚨 {urgentTasks.length} срочных
                  </span>
                )}
                <span style={{ background: t.bgCardHover, color: t.textMuted, fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "10px" }}>
                  {openTasks.length} открытых
                </span>
              </div>
            </div>
            {openTasks.length === 0 ? (
              <div style={{ color: t.textMuted, textAlign: "center", padding: "20px", fontSize: "13px" }}>🎉 Все задачи выполнены!</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {openTasks.slice(0, 5).map((task, i) => {
                  const prColors = { low: "#64748b", medium: "#f59e0b", high: "#ef4444", urgent: "#7c3aed" };
                  const prIcons = { low: "🔵", medium: "🟡", high: "🔴", urgent: "🚨" };
                  const colLabels = { todo: "📋", inprogress: "⚡", review: "👀" };
                  return (
                    <motion.div key={task.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "10px", background: t.bgCardHover }}>
                      <span style={{ fontSize: "14px" }}>{prIcons[task.priority] || "🟡"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: t.text, fontSize: "13px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</div>
                        <div style={{ color: t.textMuted, fontSize: "11px" }}>
                          {colLabels[task.column]} {task.assigneeName || "Не назначен"}
                          {task.dueDate && <span style={{ color: new Date(task.dueDate) < new Date() ? "#ef4444" : t.textFaint, marginLeft: "6px" }}>· {new Date(task.dueDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {openTasks.length > 5 && (
                  <div style={{ color: t.textFaint, fontSize: "12px", textAlign: "center", paddingTop: "4px" }}>
                    + ещё {openTasks.length - 5} задач
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Models overview */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600 }}>Модели</h3>
          <div style={{ display: "flex", gap: "8px" }}>
            <span style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "10px" }}>✅ {activeModels.length} активных</span>
            {inactiveModels.length > 0 && <span style={{ background: t.bgCardHover, color: t.textMuted, fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "10px" }}>⏸ {inactiveModels.length} неактивных</span>}
          </div>
        </div>
        {models.length === 0 ? (
          <div style={{ color: t.textMuted, textAlign: "center", padding: "20px", fontSize: "13px" }}>Нет моделей</div>
        ) : (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {models.map(m => {
              const modelPosts = gridStats.filter(g => g.modelId === m.id && g.date === today && g.status === "posted").length;
              const color = m.color || "#7c3aed";
              const isActive = m.status !== "inactive";
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", background: t.bgCardHover, borderRadius: "10px", border: `1px solid ${isActive ? color + "30" : t.border}`, opacity: isActive ? 1 : 0.5 }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: `linear-gradient(135deg, ${color}, ${color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
                    {m.emoji || m.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{m.name}</div>
                    <div style={{ color: modelPosts > 0 ? "#10b981" : t.textFaint, fontSize: "11px" }}>
                      {modelPosts > 0 ? `✅ ${modelPosts} постов сегодня` : "Нет постов сегодня"}
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
          <Trophy size={16} style={{ color: "#f59e0b" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: "20px", alignItems: "start" }}>
          {/* Game canvas */}
          <DinoGame profile={profile} db={db} user={user} />

          {/* Leaderboard */}
          <div>
            <div style={{ color: t.textMuted, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
              🏆 Топ игроков
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {leaderboard.length === 0 ? (
                <div style={{ color: t.textFaint, fontSize: "12px" }}>Пока нет рекордов</div>
              ) : leaderboard.map((entry, i) => {
                const medals = ["🥇", "🥈", "🥉"];
                const roleColor = ROLE_COLORS[entry.role] || "#64748b";
                return (
                  <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "7px 10px", background: t.bgCardHover, borderRadius: "8px", border: i === 0 ? "1px solid rgba(245,158,11,0.3)" : `1px solid ${t.border}` }}>
                    <span style={{ fontSize: "14px", flexShrink: 0 }}>{medals[i] || `${i + 1}.`}</span>
                    <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: `linear-gradient(135deg, ${roleColor}, ${roleColor}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {(entry.name || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: t.text, fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.name}</div>
                    </div>
                    <div style={{ color: i === 0 ? "#f59e0b" : t.textSecondary, fontSize: "12px", fontWeight: 700, flexShrink: 0 }}>{entry.score}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}