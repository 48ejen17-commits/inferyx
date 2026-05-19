import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError("Неверный email или пароль");
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#07070f",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', system-ui, sans-serif", position: "relative", overflow: "hidden"
    }}>
      {/* Animated background orbs */}
      <div style={{
        position: "absolute", width: "600px", height: "600px",
        borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)",
        top: "-200px", left: "-200px", animation: "float1 8s ease-in-out infinite"
      }} />
      <div style={{
        position: "absolute", width: "400px", height: "400px",
        borderRadius: "50%", background: "radial-gradient(circle, rgba(219,39,119,0.12) 0%, transparent 70%)",
        bottom: "-100px", right: "-100px", animation: "float2 10s ease-in-out infinite"
      }} />
      <div style={{
        position: "absolute", width: "300px", height: "300px",
        borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,233,0.1) 0%, transparent 70%)",
        top: "50%", right: "20%", animation: "float1 12s ease-in-out infinite reverse"
      }} />

      <style>{`
        @keyframes float1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,20px)} }
        @keyframes float2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-20px,30px)} }
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        * { box-sizing: border-box; }
        input { background: rgba(255,255,255,0.05); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 14px 16px; font-size: 15px; width: 100%; outline: none; transition: border-color 0.2s; }
        input:focus { border-color: #7c3aed; background: rgba(124,58,237,0.08); }
        input::placeholder { color: #475569; }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{
          width: "100%", maxWidth: "420px", padding: "0 24px", position: "relative", zIndex: 10
        }}
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ textAlign: "center", marginBottom: "40px" }}
        >
          <div style={{
            fontSize: "36px", fontWeight: 800, letterSpacing: "-1px",
            background: "linear-gradient(135deg, #7c3aed, #db2777, #0ea5e9)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            animation: "shimmer 4s linear infinite"
          }}>
            INFERYX
          </div>
          <div style={{ color: "#475569", fontSize: "13px", marginTop: "6px", letterSpacing: "3px", textTransform: "uppercase" }}>
            Management Platform
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px",
            padding: "36px"
          }}
        >
          <h2 style={{ color: "#fff", fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>Добро пожаловать</h2>
          <p style={{ color: "#475569", fontSize: "14px", marginBottom: "28px" }}>Войдите в свой аккаунт</p>

          <form onSubmit={handle}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ color: "#94a3b8", fontSize: "13px", display: "block", marginBottom: "8px" }}>Email</label>
              <input type="email" placeholder="you@inferyx.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ color: "#94a3b8", fontSize: "13px", display: "block", marginBottom: "8px" }}>Пароль</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "10px 14px", color: "#f87171", fontSize: "13px", marginBottom: "16px" }}
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "14px", borderRadius: "10px", border: "none",
                background: loading ? "#2d2d4e" : "linear-gradient(135deg, #7c3aed, #db2777)",
                color: "#fff", fontSize: "15px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                transition: "opacity 0.2s", letterSpacing: "0.3px"
              }}
            >
              {loading ? "Вход..." : "Войти"}
            </button>
          </form>
        </motion.div>

        {/* Support */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ textAlign: "center", marginTop: "24px" }}
        >
          <a
            href="https://t.me/mars_cd"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#334155", fontSize: "12px", textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={e => e.target.style.color = "#64748b"}
            onMouseLeave={e => e.target.style.color = "#334155"}
          >
            Возникли проблемы? Обратитесь в поддержку → @mars_cd
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
}
