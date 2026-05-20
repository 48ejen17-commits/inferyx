import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
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

function ProfileWrapper() {
  const { userId } = useParams();
  return <Profile userId={userId} />;
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#07070f", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "24px", fontWeight: 800, background: "linear-gradient(135deg, #7c3aed, #db2777)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "16px" }}>
          INFERYX
        </div>
        <div style={{ color: "#475569", fontSize: "14px" }}>Загрузка...</div>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/login" />;
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
      <Route path="/analytics" element={<PrivateRoute><Layout><Analytics /></Layout></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Layout><Settings /></Layout></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><Layout><Profile /></Layout></PrivateRoute>} />
      <Route path="/profile/:userId" element={<PrivateRoute><Layout><ProfileWrapper /></Layout></PrivateRoute>} />
      <Route path="/tasks" element={<PrivateRoute><Layout><Tasks /></Layout></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}