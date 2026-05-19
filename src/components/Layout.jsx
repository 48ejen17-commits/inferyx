import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, ROLE_LABELS, ROLE_COLORS } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  LayoutDashboard, TrendingUp, CheckSquare, Users, BarChart3,
  Settings, LogOut, Menu, X, Bell, ChevronRight, MessageSquare,
  CalendarDays, FileText, Sun, Moon
} from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Дашборд" },
  { to: "/traffic", icon: TrendingUp, label: "Трафик" },
  { to: "/checklist", icon: CheckSquare, label: "Чек-лист" },
  { to: "/chat", icon: MessageSquare, label: "Чаты" },
  { to: "/schedule", icon: CalendarDays, label: "График" },
  { to: "/content", icon: FileText, label: "Контент" },
  { to: "/team", icon: Users, label: "Команда" },
  { to: "/models", icon: UserCircle, label: "Модели" },
  { to: "/analytics", icon: BarChart3, label: "Аналитика" },
  { to: "/settings", icon: Settings, label: "Настройки" },
];

export default function Layout({ children }) {
  const { profile, logout, user, db } = useAuth();
  const { mode, toggle, theme } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [liveProfile, setLiveProfile] = useState(null);

  // Live profile data (for avatar updates)
  useEffect(() => {
    if (!user?.uid || !db) return;
    const unsub = onSnapshot(collection(db, "users"), snap => {
      const found = snap.docs.find(d => d.data().uid === user.uid || d.id === user.uid);
      if (found) setLiveProfile(found.data());
    });
    return () => unsub();
  }, [db, user?.uid]);

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const currentProfile = liveProfile || profile;
  const roleColor = ROLE_COLORS[currentProfile?.role] || "#64748b";
  const roleLabel = ROLE_LABELS[currentProfile?.role] || "—";
  const avatarEmoji = currentProfile?.avatarEmoji;
  const avatarColor = currentProfile?.avatarColor || roleColor;
  const isDark = mode === "dark";
  const t = theme;

  // Avatar component — solid, no transparency
  const Avatar = ({ size = 32, fontSize = 13, radius = "50%" }) => (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}cc)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: avatarEmoji ? Math.round(size * 0.5) : fontSize,
      fontWeight: 700, color: "#fff", flexShrink: 0,
      userSelect: "none", lineHeight: 1,
    }}>
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
      `}</style>

      {/* Desktop Sidebar */}
      <motion.div
        animate={{ width: collapsed ? 70 : 240 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        style={{
          background: t.sidebar, borderRight: `1px solid ${t.border}`,
          display: "flex", flexDirection: "column", padding: "20px 12px",
          position: "sticky", top: 0, height: "100vh", overflow: "hidden",
          flexShrink: 0, backdropFilter: "blur(20px)", transition: "background 0.3s"
        }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", marginBottom: "32px", padding: "0 4px" }}>
          {!collapsed && (
            <div style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.5px", background: "linear-gradient(135deg, #7c3aed, #db2777)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shimmer 4s linear infinite" }}>
              INFERYX
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: "4px", borderRadius: "6px", display: "flex" }}>
            {collapsed ? <ChevronRight size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === "/"}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              style={{ justifyContent: collapsed ? "center" : "flex-start" }}
              title={collapsed ? label : undefined}>
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: "16px", marginTop: "16px" }}>
          <button onClick={toggle} className="nav-link"
            style={{ width: "100%", background: "none", border: "none", cursor: "pointer", justifyContent: collapsed ? "center" : "flex-start", marginBottom: "4px" }}>
            {isDark ? <Sun size={18} style={{ color: "#f59e0b", flexShrink: 0 }} /> : <Moon size={18} style={{ color: "#7c3aed", flexShrink: 0 }} />}
            {!collapsed && <span style={{ color: t.textMuted, fontSize: "14px", fontWeight: 500 }}>{isDark ? "Светлая тема" : "Тёмная тема"}</span>}
          </button>

          {/* Profile in sidebar */}
          <div onClick={() => navigate("/profile")}
            style={{ display: "flex", alignItems: "center", gap: "10px", padding: collapsed ? "10px 14px" : "10px 14px", marginBottom: "4px", cursor: "pointer", borderRadius: "10px", justifyContent: collapsed ? "center" : "flex-start" }}
            onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <Avatar size={28} fontSize={12} radius="8px" />
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ color: t.text, fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentProfile?.name || "—"}</div>
                <div style={{ display: "inline-block", fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "20px", background: `${roleColor}20`, color: roleColor, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                  {roleLabel}
                </div>
              </div>
            )}
          </div>

          <button onClick={handleLogout} className="nav-link"
            style={{ width: "100%", background: "none", border: "none", cursor: "pointer", justifyContent: collapsed ? "center" : "flex-start" }}>
            <LogOut size={18} style={{ flexShrink: 0 }} />
            {!collapsed && <span>Выйти</span>}
          </button>
        </div>
      </motion.div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200 }} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25 }}
              style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 260, background: t.bgSecondary, borderRight: `1px solid ${t.border}`, zIndex: 300, padding: "20px 12px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
                <div style={{ fontSize: "20px", fontWeight: 800, background: "linear-gradient(135deg, #7c3aed, #db2777)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>INFERYX</div>
                <button onClick={() => setMobileOpen(false)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
              </div>
              <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                {NAV.map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} onClick={() => setMobileOpen(false)}>
                    <Icon size={18} /><span>{label}</span>
                  </NavLink>
                ))}
              </nav>
              <button onClick={toggle} className="nav-link" style={{ background: "none", border: "none", cursor: "pointer", marginBottom: "4px" }}>
                {isDark ? <Sun size={18} style={{ color: "#f59e0b" }} /> : <Moon size={18} style={{ color: "#7c3aed" }} />}
                <span>{isDark ? "Светлая тема" : "Тёмная тема"}</span>
              </button>
              <button onClick={handleLogout} className="nav-link" style={{ background: "none", border: "none", cursor: "pointer" }}>
                <LogOut size={18} /><span>Выйти</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        {/* Topbar */}
        <div style={{ padding: "14px 28px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", background: t.topbar, backdropFilter: "blur(10px)" }}>
          <button style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", border: `1px solid ${t.border}`, borderRadius: "8px", padding: "8px", color: t.textMuted, cursor: "pointer", display: "flex" }}>
            <Bell size={16} />
          </button>
          <button onClick={toggle}
            style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", border: `1px solid ${t.border}`, borderRadius: "8px", padding: "8px", color: isDark ? "#f59e0b" : "#7c3aed", cursor: "pointer", display: "flex" }}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Clickable profile — live avatar */}
          <motion.div onClick={() => navigate("/profile")} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", padding: "6px 12px", borderRadius: "10px" }}
            onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <Avatar size={34} fontSize={14} radius="10px" />
            <div>
              <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{currentProfile?.name || "—"}</div>
              <div style={{ color: roleColor, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{roleLabel}</div>
            </div>
          </motion.div>
        </div>

        {/* Page content */}
        <motion.div key={window.location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          style={{ padding: "32px", color: t.text, transition: "color 0.3s" }}>
          {children}
        </motion.div>
      </div>
    </div>
  );
}