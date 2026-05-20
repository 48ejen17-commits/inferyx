import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, ROLE_LABELS, ROLE_COLORS } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { collection, onSnapshot, query, where, orderBy, limit, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import {
  LayoutDashboard, TrendingUp, CheckSquare, Users, BarChart3,
  Settings, LogOut, Menu, X, Bell, ChevronRight, MessageSquare,
  CalendarDays, FileText, Sun, Moon, UserCircle, Clipboard
} from "lucide-react";

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

export default function Layout({ children }) {
  const { profile, logout, user, db } = useAuth();
  const { mode, toggle, theme } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [liveProfile, setLiveProfile] = useState(null);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastSeen, setLastSeen] = useState(null);
  const notifRef = useRef(null);

  // Live profile
  useEffect(() => {
    if (!user?.uid || !db) return;
    const unsub = onSnapshot(collection(db, "users"), snap => {
      const found = snap.docs.find(d => d.data().uid === user.uid || d.id === user.uid);
      if (found) setLiveProfile(found.data());
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
                <div style={{ position: "absolute", bottom: -2, right: -2, width: "10px", height: "10px", borderRadius: "50%", background: "#10b981", border: `2px solid ${t.bg}` }} />
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

    </div>
  );
}
