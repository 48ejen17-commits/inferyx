import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

function playStartupSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    const tone = (freq, start, dur, type = "sine", vol = 1) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      g.gain.setValueAtTime(0, ctx.currentTime + start);
      g.gain.linearRampToValueAtTime(vol * 0.15, ctx.currentTime + start + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    };

    const sweep = (f1, f2, start, dur, type = "sine", vol = 0.15) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(f1, ctx.currentTime + start);
      osc.frequency.exponentialRampToValueAtTime(f2, ctx.currentTime + start + dur);
      g.gain.setValueAtTime(0, ctx.currentTime + start);
      g.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    };

    // Deep hum
    tone(55, 0, 0.7, "sawtooth", 0.8);
    tone(110, 0, 0.6, "sawtooth", 0.5);
    // Power sweep
    sweep(80, 800, 0.05, 0.7, "sawtooth", 0.18);
    sweep(150, 1200, 0.15, 0.6, "sine", 0.14);
    sweep(250, 1800, 0.25, 0.5, "sine", 0.1);
    // Punches
    tone(400, 0.6, 0.1, "square", 0.6);
    tone(600, 0.65, 0.1, "square", 0.5);
    tone(900, 0.7, 0.08, "sine", 0.6);
    // Sparkle
    tone(2200, 0.75, 0.18, "sine", 0.5);
    tone(3300, 0.8, 0.14, "sine", 0.4);
    // Final chord
    tone(440, 0.88, 0.55, "sine", 0.7);
    tone(554, 0.9, 0.5, "sine", 0.6);
    tone(659, 0.92, 0.45, "sine", 0.5);
    tone(880, 0.94, 0.38, "sine", 0.4);
  } catch (e) {
    console.log("Audio error:", e);
  }
}

export default function SplashScreen({ onDone }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState(0);
  const [clicked, setClicked] = useState(false);
  const soundPlayed = useRef(false);

  // Try autoplay first, fallback to click
  useEffect(() => {
    const tryAutoplay = async () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === "running") {
          playStartupSound();
          soundPlayed.current = true;
        } else {
          await ctx.resume();
          if (ctx.state === "running") {
            playStartupSound();
            soundPlayed.current = true;
          }
        }
      } catch (e) {}
    };
    tryAutoplay();

    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 400);
    const t3 = setTimeout(() => setPhase(3), 1900);
    const t4 = setTimeout(() => onDone(), 2300);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, [onDone]);

  const handleClick = () => {
    if (!soundPlayed.current) {
      playStartupSound();
      soundPlayed.current = true;
      setClicked(true);
    }
  };

  // Particle canvas
  useEffect(() => {
    if (phase < 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      r: Math.random() * 2 + 0.5,
      color: ["#7c3aed", "#a78bfa", "#db2877", "#f9a8d4"][Math.floor(Math.random() * 4)],
    }));

    const stars = Array.from({ length: 6 }, () => ({
      x: -100, y: Math.random() * canvas.height * 0.6,
      speed: Math.random() * 10 + 5, len: Math.random() * 80 + 40, alpha: 1,
    }));

    let frame = 0;
    let alive = true;

    const loop = () => {
      if (!alive) return;
      frame++;
      ctx.fillStyle = frame < 15 ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + "99";
        ctx.fill();
      });

      stars.forEach(s => {
        s.x += s.speed; s.y += s.speed * 0.25; s.alpha -= 0.012;
        if (s.alpha <= 0 || s.x > canvas.width) {
          s.x = -s.len; s.y = Math.random() * canvas.height * 0.7;
          s.alpha = 0.9; s.speed = Math.random() * 10 + 5;
          s.len = Math.random() * 80 + 40;
        }
        const g = ctx.createLinearGradient(s.x - s.len, s.y - s.len * 0.25, s.x, s.y);
        g.addColorStop(0, "rgba(124,58,237,0)");
        g.addColorStop(1, `rgba(167,139,250,${s.alpha})`);
        ctx.beginPath();
        ctx.moveTo(s.x - s.len, s.y - s.len * 0.25);
        ctx.lineTo(s.x, s.y);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      if (phase >= 2) {
        const pulse = 0.07 + Math.sin(frame * 0.12) * 0.035;
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 220);
        grd.addColorStop(0, `rgba(124,58,237,${pulse})`);
        grd.addColorStop(0.5, `rgba(219,39,119,${pulse * 0.4})`);
        grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      requestAnimationFrame(loop);
    };
    loop();
    return () => { alive = false; };
  }, [phase]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.45, ease: "easeInOut" }}
      onClick={handleClick}
      style={{ position: "fixed", inset: 0, background: "#000", zIndex: 9999, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>

      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Hex icon */}
        <motion.div
          initial={{ scale: 0, opacity: 0, rotate: -180 }}
          animate={phase >= 2 ? { scale: 1, opacity: 1, rotate: 0 } : {}}
          transition={{ duration: 0.65, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ marginBottom: "24px", position: "relative" }}>
          <svg width="76" height="76" viewBox="0 0 76 76">
            <defs>
              <linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#db2877" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <polygon points="38,4 70,21 70,55 38,72 6,55 6,21" fill="url(#hg)" filter="url(#glow)" />
            <polygon points="38,13 62,26 62,52 38,65 14,52 14,26" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
            <text x="38" y="45" textAnchor="middle" fill="white" fontSize="24" fontWeight="900" fontFamily="Inter, sans-serif">I</text>
          </svg>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            style={{ position: "absolute", inset: -14, borderRadius: "50%", border: "1.5px solid rgba(124,58,237,0.35)", borderTopColor: "#a78bfa", borderRightColor: "transparent" }} />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            style={{ position: "absolute", inset: -22, borderRadius: "50%", border: "1px solid rgba(219,39,119,0.2)", borderBottomColor: "#db2877", borderLeftColor: "transparent" }} />
        </motion.div>

        {/* Letters */}
        <div style={{ display: "flex", alignItems: "center", gap: "3px", marginBottom: "12px" }}>
          {"INFERYX".split("").map((letter, i) => (
            <motion.span key={i}
              initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
              animate={phase >= 2 ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              style={{ fontSize: "50px", fontWeight: 900, fontFamily: "'Inter', system-ui, sans-serif", background: "linear-gradient(135deg, #e0d7ff, #a78bfa, #db2877)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>
              {letter}
            </motion.span>
          ))}
        </div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 0.45 } : {}}
          transition={{ delay: 0.9, duration: 0.5 }}
          style={{ fontSize: "11px", textTransform: "uppercase", color: "#94a3b8", fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: "4px", marginBottom: "32px" }}>
          Management Platform
        </motion.div>

        {/* Sound hint if not played */}
        {!soundPlayed.current && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 0.4 } : {}}
            transition={{ delay: 1.2 }}
            style={{ fontSize: "11px", color: "#475569", marginBottom: "16px" }}>
            🔊 Кликни для звука
          </motion.div>
        )}

        {/* Dots */}
        <motion.div initial={{ opacity: 0 }} animate={phase >= 2 ? { opacity: 1 } : {}} transition={{ delay: 1 }}
          style={{ display: "flex", gap: "7px" }}>
          {[0, 1, 2].map(i => (
            <motion.div key={i}
              animate={{ scale: [1, 1.6, 1], opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.22 }}
              style={{ width: "7px", height: "7px", borderRadius: "50%", background: i === 0 ? "#7c3aed" : i === 1 ? "#a78bfa" : "#db2877" }} />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
