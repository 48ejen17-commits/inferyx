import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import SplashScreen from "./components/SplashScreen";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Traffic from "./pages/Traffic";
import Checklist from "./pages/Checklist";
import Chat from "./pages/Chat";
import Schedule from "./pages/Schedule";
import Content from "./pages/Content";
import Models from "./pages/Models";
import Team from "./pages/Team";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Tasks from "./pages/Tasks";
import Admin from "./pages/Admin";
import Teams from "./pages/Teams";
import TeamPanel from "./pages/TeamPanel";
import Users from "./pages/Users";

function ProfileWrapper() {
  const { userId } = useParams();
  return <Profile userId={userId} />;
}

function LoadingScreen({ error }) {
  if (error) return (
    <div style={{ position: "fixed", inset: 0, background: "#07070f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
      <div style={{ fontSize: "48px" }}>📡</div>
      <div style={{ color: "#e2e8f0", fontSize: "18px", fontWeight: 700 }}>Проблема с подключением</div>
      <div style={{ color: "#64748b", fontSize: "14px", textAlign: "center", maxWidth: "300px", lineHeight: "1.6" }}>
        Не удалось подключиться к серверу.<br />Проверь интернет и попробуй снова.
      </div>
      <button onClick={() => window.location.reload()}
        style={{ marginTop: "8px", padding: "12px 28px", borderRadius: "12px", background: "linear-gradient(135deg,#7c3aed,#db2877)", color: "#fff", border: "none", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
        🔄 Обновить страницу
      </button>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "#07070f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }}>
      <div style={{ position: "relative" }}>
        <svg width="60" height="60" viewBox="0 0 60 60">
          <defs>
            <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#db2877" />
            </linearGradient>
          </defs>
          <polygon points="30,3 57,17 57,43 30,57 3,43 3,17" fill="url(#lg)" opacity="0.9" />
          <text x="30" y="37" textAnchor="middle" fill="white" fontSize="20" fontWeight="900" fontFamily="Inter,sans-serif">I</text>
        </svg>
        <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "#7c3aed", borderRightColor: "#db2877", animation: "spin 1s linear infinite" }} />
      </div>
      <div style={{ color: "#a78bfa", fontSize: "14px", fontWeight: 600, letterSpacing: "1px" }}>INFERYX</div>
      <div style={{ color: "#334155", fontSize: "12px" }}>Подключение...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading, authError } = useAuth();
  if (loading) return <LoadingScreen />;
  if (authError) return <LoadingScreen error />;
  return user ? children : <Navigate to="/login" />;
}

function OwnerRoute({ children }) {
  const { user, loading, profile, authError } = useAuth();
  if (loading) return <LoadingScreen />;
  if (authError) return <LoadingScreen error />;
  if (!user) return <Navigate to="/login" />;
  if (profile?.role?.toLowerCase() !== "owner") return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
      <Route path="/traffic" element={<PrivateRoute><Layout><Traffic /></Layout></PrivateRoute>} />
      <Route path="/checklist" element={<PrivateRoute><Layout><Checklist /></Layout></PrivateRoute>} />
      <Route path="/chat" element={<PrivateRoute><Layout><Chat /></Layout></PrivateRoute>} />
      <Route path="/schedule" element={<PrivateRoute><Layout><Schedule /></Layout></PrivateRoute>} />
      <Route path="/content" element={<PrivateRoute><Layout><Content /></Layout></PrivateRoute>} />
      <Route path="/models" element={<PrivateRoute><Layout><Models /></Layout></PrivateRoute>} />
      <Route path="/team" element={<PrivateRoute><Layout><Team /></Layout></PrivateRoute>} />
      <Route path="/teams" element={<PrivateRoute><Layout><Teams /></Layout></PrivateRoute>} />
      <Route path="/team-panel" element={<PrivateRoute><Layout><TeamPanel /></Layout></PrivateRoute>} />
      <Route path="/users" element={<PrivateRoute><Layout><Users /></Layout></PrivateRoute>} />
      <Route path="/analytics" element={<PrivateRoute><Layout><Analytics /></Layout></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Layout><Settings /></Layout></PrivateRoute>} />
      <Route path="/tasks" element={<PrivateRoute><Layout><Tasks /></Layout></PrivateRoute>} />
      <Route path="/admin" element={<OwnerRoute><Layout><Admin /></Layout></OwnerRoute>} />
      <Route path="/profile" element={<PrivateRoute><Layout><Profile /></Layout></PrivateRoute>} />
      <Route path="/profile/:userId" element={<PrivateRoute><Layout><ProfileWrapper /></Layout></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AnimatePresence mode="wait">
            {showSplash && (
              <SplashScreen key="splash" onDone={() => setShowSplash(false)} />
            )}
          </AnimatePresence>
          {!showSplash && <AppRoutes />}
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
