import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SplashScreen({ onDone }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState(0); // 0=dark, 1=particles, 2=logo, 3=done

  // ── Sound ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const playSound = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.18, ctx.currentTime);
        master.connect(ctx.destination);

        const tone = (freq, start, dur, type = "sine", vol = 1) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.connect(g); g.connect(master);
          osc.type = type;
          osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
          g.gain.setValueAtTime(0, ctx.currentTime + start);
          g.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.04);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + dur + 0.05);
        };

        const sweep = (f1, f2, start, dur, type = "sine") => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.connect(g); g.connect(master);
          osc.type = type;
          osc.frequency.setValueAtTime(f1, ctx.currentTime + start);
          osc.frequency.exponentialRampToValueAtTime(f2, ctx.currentTime + start + dur);
          g.gain.setValueAtTime(0, ctx.currentTime + start);
          g.gain.linearRampToValueAtTime(0.8, ctx.currentTime + start + 0.05);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + dur + 0.05);
        };

        // Deep power hum
        tone(55, 0.05, 0.6, "sawtooth", 0.4);
        tone(110, 0.05, 0.5, "sawtooth", 0.3);

        // Power sweep up
        sweep(80, 600, 0.1, 0.7, "sawtooth");
        sweep(120, 900, 0.2, 0.6, "sine");
        sweep(200, 1400, 0.3, 0.5, "sine");

        // Mid punches
        tone(300, 0.6, 0.15, "square", 0.5);
        tone(500, 0.65, 0.12, "square", 0.4);
        tone(800, 0.7, 0.1, "sine", 0.5);

        // High sparkle
        tone(2000, 0.75, 0.2, "sine", 0.4);
        tone(3000, 0.8, 0.15, "sine", 0.3);
        tone(4500, 0.85, 0.12, "sine", 0.2);

        // Final chord (Iron Man style)
        tone(440, 0.9, 0.5, "sine", 0.6);
        tone(554, 0.92, 0.48, "sine", 0.5);
        tone(659, 0.94, 0.46, "sine", 0.4);
        tone(880, 0.96, 0.4, "sine", 0.3);

      } catch (e) {}
    };

    // Needs user gesture on some browsers — try immediately
    playSound();

    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 400);
    const t3 = setTimeout(() => setPhase(3), 1800);
    const t4 = setTimeout(() => onDone(), 2200);

    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, [onDone]);

  // ── Particle canvas ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase < 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      r: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.8 + 0.2,
      color: Math.random() > 0.5 ? "#7c3aed" : Math.random() > 0.5 ? "#db2777" : "#a78bfa",
    }));

    // Shooting stars
    const stars = Array.from({ length: 8 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.5,
      len: Math.random() * 80 + 40,
      speed: Math.random() * 8 + 4,
      alpha: 1,
    }));

    let frame = 0;
    let alive = true;

    const loop = () => {
      if (!alive) return;
      frame++;
      ctx.fillStyle = `rgba(0,0,0,${frame < 20 ? 0.3 : 0.12})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(p.alpha * 255).toString(16).padStart(2, "0");
        ctx.fill();
      });

      // Shooting stars
      stars.forEach(s => {
        s.x += s.speed;
        s.y += s.speed * 0.3;
        s.alpha -= 0.015;
        if (s.alpha <= 0 || s.x > canvas.width) {
          s.x = -s.len;
          s.y = Math.random() * canvas.height * 0.6;
          s.alpha = 1;
          s.speed = Math.random() * 8 + 4;
          s.len = Math.random() * 80 + 40;
        }
        const grad = ctx.createLinearGradient(s.x - s.len, s.y - s.len * 0.3, s.x, s.y);
        grad.addColorStop(0, `rgba(124,58,237,0)`);
        grad.addColorStop(1, `rgba(167,139,250,${s.alpha})`);
        ctx.beginPath();
        ctx.moveTo(s.x - s.len, s.y - s.len * 0.3);
        ctx.lineTo(s.x, s.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Center glow pulse
      if (phase >= 2) {
        const pulse = 0.08 + Math.sin(frame * 0.1) * 0.04;
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200);
        grd.addColorStop(0, `rgba(124,58,237,${pulse})`);
        grd.addColorStop(0.5, `rgba(219,39,119,${pulse * 0.5})`);
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
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      style={{ position: "fixed", inset: 0, background: "#000", zIndex: 9999, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>

      {/* Particle canvas */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      {/* Logo */}
      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Hex icon */}
        <motion.div
          initial={{ scale: 0, opacity: 0, rotate: -180 }}
          animate={phase >= 2 ? { scale: 1, opacity: 1, rotate: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ marginBottom: "24px", position: "relative" }}>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <defs>
              <linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#db2777" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <polygon points="36,4 66,20 66,52 36,68 6,52 6,20" fill="url(#hg)" filter="url(#glow)" opacity="0.9" />
            <polygon points="36,12 58,24 58,48 36,60 14,48 14,24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <text x="36" y="42" textAnchor="middle" fill="white" fontSize="22" fontWeight="900" fontFamily="Inter, sans-serif">I</text>
          </svg>

          {/* Orbit ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            style={{ position: "absolute", inset: -12, borderRadius: "50%", border: "1px solid rgba(124,58,237,0.4)", borderTopColor: "#a78bfa" }} />
        </motion.div>

        {/* Letters */}
        <div style={{ display: "flex", alignItems: "center", gap: "3px", marginBottom: "10px" }}>
          {"INFERYX".split("").map((letter, i) => (
            <motion.span key={i}
              initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
              animate={phase >= 2 ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              style={{ fontSize: "48px", fontWeight: 900, fontFamily: "'Inter', system-ui, sans-serif", background: "linear-gradient(135deg, #e0d7ff, #a78bfa, #db2877, #fbb6ce)", backgroundSize: "300% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>
              {letter}
            </motion.span>
          ))}
        </div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0, letterSpacing: "8px" }}
          animate={phase >= 2 ? { opacity: 0.5, letterSpacing: "5px" } : {}}
          transition={{ delay: 0.8, duration: 0.6 }}
          style={{ fontSize: "11px", textTransform: "uppercase", color: "#94a3b8", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
          Management Platform
        </motion.div>

        {/* Dots loader */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : {}}
          transition={{ delay: 1 }}
          style={{ display: "flex", gap: "6px", marginTop: "32px" }}>
          {[0, 1, 2].map(i => (
            <motion.div key={i}
              animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
              style={{ width: "6px", height: "6px", borderRadius: "50%", background: i === 0 ? "#7c3aed" : i === 1 ? "#a78bfa" : "#db2877" }} />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
