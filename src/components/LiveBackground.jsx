import { useEffect, useRef, memo } from "react";

// Фазы дня по часам
const getPhase = (hour) => {
  if (hour >= 0  && hour < 5)  return "night";
  if (hour >= 5  && hour < 7)  return "dawn";
  if (hour >= 7  && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "sunset";
  if (hour >= 20 && hour < 22) return "dusk";
  return "night";
};

const getPhaseProgress = (hour, min) => {
  const phaseBounds = {
    night:   [0,   5],
    dawn:    [5,   7],
    morning: [7,   11],
    day:     [11,  17],
    sunset:  [17,  20],
    dusk:    [20,  22],
  };
  const phase = getPhase(hour);
  const [start, end] = phaseBounds[phase] || [hour, hour + 1];
  const totalMins = (end - start) * 60;
  const elapsed   = (hour - start) * 60 + min;
  return Math.min(Math.max(elapsed / totalMins, 0), 1);
};

// Цвета неба для каждой фазы
const SKY = {
  night:   { top: "#020510", mid: "#060c1f", bottom: "#0a0f28" },
  dawn:    { top: "#0d0a1e", mid: "#2d1b4e", bottom: "#7c3069" },
  morning: { top: "#1a1035", mid: "#c2410c", bottom: "#f97316" },
  day:     { top: "#1e3a5f", mid: "#2563eb", bottom: "#60a5fa" },
  sunset:  { top: "#1a0a2e", mid: "#7c2d12", bottom: "#f97316" },
  dusk:    { top: "#0f0720", mid: "#4c1d95", bottom: "#7c3aed" },
};

// Плавная интерполяция между цветами
const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return [r, g, b];
};
const lerpColor = (a, b, t) => {
  const [r1,g1,b1] = hexToRgb(a);
  const [r2,g2,b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2-r1)*t);
  const g = Math.round(g1 + (g2-g1)*t);
  const bl = Math.round(b1 + (b2-b1)*t);
  return `rgb(${r},${g},${bl})`;
};

const PHASE_ORDER = ["night","dawn","morning","day","sunset","dusk"];
const getBlendedSky = (hour, min) => {
  const phase = getPhase(hour);
  const progress = getPhaseProgress(hour, min);
  const nextPhase = PHASE_ORDER[(PHASE_ORDER.indexOf(phase) + 1) % PHASE_ORDER.length];
  const cur  = SKY[phase];
  const next = SKY[nextPhase];
  const t = Math.pow(progress, 1.5); // ease
  return {
    top:    lerpColor(cur.top,    next.top,    t),
    mid:    lerpColor(cur.mid,    next.mid,    t),
    bottom: lerpColor(cur.bottom, next.bottom, t),
  };
};

const LiveBackground = memo(function LiveBackground() {
  const canvasRef = useRef(null);
  const frameRef  = useRef(null);
  const starsRef  = useRef([]);
  const cloudsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * (window.devicePixelRatio || 1);
      canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    };
    resize();
    window.addEventListener("resize", resize);

    const W = () => canvas.offsetWidth;
    const H = () => canvas.offsetHeight;

    // Generate stars
    starsRef.current = Array.from({ length: 180 }, () => ({
      x: Math.random(), y: Math.random() * 0.7,
      r: Math.random() * 1.4 + 0.3,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinkleOffset: Math.random() * Math.PI * 2,
      brightness: Math.random() * 0.5 + 0.5,
    }));

    // Generate clouds
    cloudsRef.current = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random(),
      y: 0.15 + Math.random() * 0.35,
      w: 0.15 + Math.random() * 0.25,
      h: 0.04 + Math.random() * 0.06,
      speed: 0.00002 + Math.random() * 0.00003,
      opacity: 0.03 + Math.random() * 0.07,
      layer: i < 3 ? "far" : "near",
    }));

    let frame = 0;

    const drawSky = (sky) => {
      const w = W(), h = H();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0,    sky.top);
      grad.addColorStop(0.45, sky.mid);
      grad.addColorStop(1,    sky.bottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    };

    const drawStars = (hour, frame) => {
      const w = W(), h = H();
      const phase = getPhase(hour);
      const starAlpha = { night: 1, dawn: 0.6, morning: 0.1, day: 0, sunset: 0.05, dusk: 0.4 }[phase] || 0;
      if (starAlpha <= 0) return;

      starsRef.current.forEach(s => {
        const twinkle = 0.5 + 0.5 * Math.sin(frame * s.twinkleSpeed + s.twinkleOffset);
        const alpha   = starAlpha * s.brightness * (0.6 + 0.4 * twinkle);
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,230,255,${alpha})`;
        ctx.fill();

        // Shooting star occasionally
        if (phase === "night" && Math.random() < 0.0003) {
          const sx = Math.random() * w * 0.7;
          const sy = Math.random() * h * 0.4;
          const len = 80 + Math.random() * 120;
          const grad = ctx.createLinearGradient(sx, sy, sx + len, sy + len * 0.3);
          grad.addColorStop(0, "rgba(255,255,255,0)");
          grad.addColorStop(0.7, "rgba(200,220,255,0.8)");
          grad.addColorStop(1, "rgba(255,255,255,0)");
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + len, sy + len * 0.3);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });
    };

    const drawMoon = (hour, frame) => {
      const w = W(), h = H();
      const phase = getPhase(hour);
      const moonAlpha = { night: 0.9, dawn: 0.4, morning: 0, day: 0, sunset: 0, dusk: 0.3 }[phase] || 0;
      if (moonAlpha <= 0) return;

      const mx = w * 0.78, my = h * 0.16;
      const r = Math.min(w, h) * 0.038;

      // Moon glow
      const glow = ctx.createRadialGradient(mx, my, 0, mx, my, r * 3.5);
      glow.addColorStop(0, `rgba(200,220,255,${moonAlpha * 0.15})`);
      glow.addColorStop(1, "rgba(200,220,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(mx, my, r * 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Moon body
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(235,245,255,${moonAlpha})`;
      ctx.fill();

      // Crescent shadow
      ctx.beginPath();
      ctx.arc(mx + r * 0.35, my, r * 0.82, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(10,12,35,${moonAlpha * 0.88})`;
      ctx.fill();

      // Craters
      [[mx - r*0.3, my - r*0.2, r*0.08], [mx - r*0.5, my + r*0.3, r*0.05], [mx - r*0.15, my + r*0.1, r*0.04]].forEach(([cx,cy,cr]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,200,240,${moonAlpha * 0.25})`;
        ctx.fill();
      });
    };

    const drawSun = (hour, min) => {
      const w = W(), h = H();
      const phase = getPhase(hour);
      if (phase === "night") return;

      const progress = getPhaseProgress(hour, min);
      let sx, sy, r, alpha;

      if (phase === "dawn" || phase === "morning") {
        sx = w * (0.15 + progress * 0.25);
        sy = h * (0.75 - progress * 0.45);
        r  = Math.min(w,h) * 0.04;
        alpha = 0.3 + progress * 0.7;
      } else if (phase === "day") {
        sx = w * (0.4 + progress * 0.25);
        sy = h * (0.1 + Math.sin(progress * Math.PI) * 0.05);
        r  = Math.min(w,h) * 0.035;
        alpha = 0.95;
      } else if (phase === "sunset") {
        sx = w * (0.65 + progress * 0.2);
        sy = h * (0.12 + progress * 0.55);
        r  = Math.min(w,h) * 0.045;
        alpha = 1 - progress * 0.5;
      } else if (phase === "dusk") {
        return;
      } else return;

      // Sun rays
      const rayAlpha = alpha * 0.08;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const innerR = r * 1.4;
        const outerR = r * 2.5 + Math.sin(frame * 0.05 + i) * r * 0.3;
        const grad = ctx.createLinearGradient(
          sx + Math.cos(angle) * innerR, sy + Math.sin(angle) * innerR,
          sx + Math.cos(angle) * outerR, sy + Math.sin(angle) * outerR
        );
        grad.addColorStop(0, `rgba(255,200,80,${rayAlpha * 1.5})`);
        grad.addColorStop(1, "rgba(255,200,80,0)");
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(angle) * innerR, sy + Math.sin(angle) * innerR);
        ctx.lineTo(sx + Math.cos(angle) * outerR, sy + Math.sin(angle) * outerR);
        ctx.strokeStyle = grad;
        ctx.lineWidth = r * 0.6;
        ctx.stroke();
      }

      // Sun glow outer
      const glowOuter = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 5);
      glowOuter.addColorStop(0, `rgba(255,180,50,${alpha * 0.2})`);
      glowOuter.addColorStop(0.4, `rgba(255,120,30,${alpha * 0.08})`);
      glowOuter.addColorStop(1, "rgba(255,100,0,0)");
      ctx.fillStyle = glowOuter;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 5, 0, Math.PI * 2);
      ctx.fill();

      // Sun glow inner
      const glowInner = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.8);
      glowInner.addColorStop(0, `rgba(255,240,180,${alpha})`);
      glowInner.addColorStop(0.5, `rgba(255,180,50,${alpha * 0.6})`);
      glowInner.addColorStop(1, "rgba(255,120,0,0)");
      ctx.fillStyle = glowInner;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Sun body
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      const sunBody = ctx.createRadialGradient(sx - r*0.2, sy - r*0.2, 0, sx, sy, r);
      sunBody.addColorStop(0, `rgba(255,255,220,${alpha})`);
      sunBody.addColorStop(1, `rgba(255,180,40,${alpha})`);
      ctx.fillStyle = sunBody;
      ctx.fill();
    };

    const drawHorizonGlow = (hour, min) => {
      const w = W(), h = H();
      const phase = getPhase(hour);
      const progress = getPhaseProgress(hour, min);

      let color, alpha, yPos;
      if (phase === "dawn") {
        color = "255,120,60"; alpha = 0.15 + progress * 0.2; yPos = 0.72;
      } else if (phase === "morning") {
        color = "255,140,40"; alpha = 0.2 - progress * 0.15; yPos = 0.65 - progress * 0.1;
      } else if (phase === "sunset") {
        color = "255,80,20"; alpha = 0.1 + progress * 0.25; yPos = 0.65;
      } else if (phase === "dusk") {
        color = "120,30,180"; alpha = 0.15 - progress * 0.1; yPos = 0.7;
      } else return;

      const grad = ctx.createRadialGradient(w * 0.5, h * yPos, 0, w * 0.5, h * yPos, w * 0.6);
      grad.addColorStop(0, `rgba(${color},${alpha})`);
      grad.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    };

    const drawAurora = (frame) => {
      const w = W(), h = H();
      const phase = getPhase(new Date().getHours());
      if (phase !== "night") return;

      ctx.save();
      ctx.globalAlpha = 0.04 + Math.sin(frame * 0.008) * 0.02;

      for (let i = 0; i < 3; i++) {
        const waveY = h * (0.25 + i * 0.08) + Math.sin(frame * 0.012 + i * 2.1) * h * 0.04;
        const grad = ctx.createLinearGradient(0, waveY - 40, 0, waveY + 40);
        const colors = ["rgba(100,255,180,", "rgba(80,160,255,", "rgba(160,80,255,"];
        grad.addColorStop(0, colors[i] + "0)");
        grad.addColorStop(0.5, colors[i] + "0.8)");
        grad.addColorStop(1, colors[i] + "0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, waveY);
        for (let x = 0; x <= w; x += 8) {
          const y = waveY + Math.sin(x * 0.005 + frame * 0.015 + i) * h * 0.035 + Math.sin(x * 0.012 + frame * 0.008) * h * 0.02;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, waveY + 80);
        ctx.lineTo(0, waveY + 80);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };

    const drawClouds = (hour, frame) => {
      const w = W(), h = H();
      const phase = getPhase(hour);
      const cloudAlpha = { night: 0.08, dawn: 0.25, morning: 0.35, day: 0.4, sunset: 0.45, dusk: 0.2 }[phase] || 0;

      const cloudColor = {
        night: "150,160,200", dawn: "255,180,140", morning: "255,200,160",
        day: "220,235,255", sunset: "255,140,100", dusk: "180,140,220"
      }[phase] || "200,210,230";

      cloudsRef.current.forEach(c => {
        c.x = (c.x + c.speed) % 1.3;
        if (c.x > 1.2) c.x = -0.2;

        const cx = c.x * w, cy = c.y * h;
        const cw = c.w * w, ch = c.h * h;
        const alpha = cloudAlpha * c.opacity * 12;
        if (alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = Math.min(alpha, 0.5);
        ctx.filter = `blur(${c.layer === "far" ? 8 : 4}px)`;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cw * 0.5);
        grad.addColorStop(0, `rgba(${cloudColor},0.9)`);
        grad.addColorStop(0.5, `rgba(${cloudColor},0.5)`);
        grad.addColorStop(1, `rgba(${cloudColor},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw * 0.5, ch * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Secondary puffs
        ctx.beginPath();
        ctx.ellipse(cx - cw*0.2, cy + ch*0.1, cw*0.32, ch*0.4, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + cw*0.22, cy + ch*0.05, cw*0.28, ch*0.38, 0, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
      });
    };

    const drawGround = (sky) => {
      const w = W(), h = H();
      const grad = ctx.createLinearGradient(0, h * 0.72, 0, h);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(0.3, "rgba(0,0,0,0.15)");
      grad.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    };

    const loop = () => {
      frame++;
      const now  = new Date();
      const hour = now.getHours();
      const min  = now.getMinutes();
      const sky  = getBlendedSky(hour, min);

      drawSky(sky);
      drawAurora(frame);
      drawStars(hour, frame);
      drawMoon(hour, frame);
      drawHorizonGlow(hour, min);
      drawClouds(hour, frame);
      drawSun(hour, min);
      drawGround(sky);

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, opacity: 0.35, pointerEvents: "none" }} />
  );
});

export default LiveBackground;
