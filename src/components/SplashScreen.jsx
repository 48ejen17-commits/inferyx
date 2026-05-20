import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SplashScreen({ onDone }) {
  const audioRef = useRef(null);

  useEffect(() => {
    // Generate startup sound using Web Audio API (Iron Man style)
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      const play = (freq, start, dur, type = "sine", gain = 0.3) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + start + dur * 0.5);
        gainNode.gain.setValueAtTime(0, ctx.currentTime + start);
        gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur + 0.1);
      };

      // Deep hum
      play(60, 0, 0.4, "sawtooth", 0.15);
      // Power up sweep
      play(120, 0.1, 0.5, "sine", 0.2);
      play(240, 0.2, 0.4, "sine", 0.15);
      play(480, 0.35, 0.3, "sine", 0.1);
      // High ping
      play(1200, 0.5, 0.3, "sine", 0.12);
      play(2400, 0.6, 0.2, "sine", 0.08);
      // Final chord
      play(440, 0.7, 0.4, "sine", 0.1);
      play(880, 0.75, 0.35, "sine", 0.08);
    } catch (e) {
      // Audio not supported
    }

    const timer = setTimeout(onDone, 2000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        position: "fixed", inset: 0, background: "#000",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, flexDirection: "column",
      }}>

      {/* Glow effect behind logo */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 3, opacity: 0.15 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        style={{
          position: "absolute", width: "300px", height: "300px",
          borderRadius: "50%",
          background: "radial-gradient(circle, #7c3aed, #db2777, transparent)",
          filter: "blur(40px)",
        }}
      />

      {/* Logo letters */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "2px" }}>
        {"INFERYX".split("").map((letter, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: i * 0.06, duration: 0.4, ease: "easeOut" }}
            style={{
              fontSize: "52px", fontWeight: 900, letterSpacing: "-1px",
              fontFamily: "'Inter', system-ui, sans-serif",
              background: "linear-gradient(135deg, #a78bfa, #7c3aed, #db2777, #f59e0b)",
              backgroundSize: "300% auto",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
            {letter}
          </motion.span>
        ))}

        {/* Shimmer overlay */}
        <motion.div
          initial={{ left: "-100%" }}
          animate={{ left: "150%" }}
          transition={{ delay: 0.5, duration: 0.6, ease: "easeInOut" }}
          style={{
            position: "absolute", top: 0, width: "60px", height: "100%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
            transform: "skewX(-20deg)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Tagline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        style={{
          marginTop: "12px", fontSize: "13px", letterSpacing: "4px",
          textTransform: "uppercase", color: "#475569",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}>
        Management Platform
      </motion.div>

      {/* Loading bar */}
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: "200px", opacity: 1 }}
        transition={{ delay: 0.4, duration: 1.2, ease: "easeInOut" }}
        style={{
          marginTop: "40px", height: "2px",
          background: "linear-gradient(90deg, #7c3aed, #db2777)",
          borderRadius: "1px",
        }}
      />
    </motion.div>
  );
}
