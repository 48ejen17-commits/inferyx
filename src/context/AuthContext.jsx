import { createContext, useContext, useEffect, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB3TeUaqDGu_4hhu8Mmr348W-SFWhq6bsU",
  authDomain: "jgnn-3d5e4.firebaseapp.com",
  projectId: "jgnn-3d5e4",
  storageBucket: "jgnn-3d5e4.appspot.com",
  messagingSenderId: "804522593080",
  appId: "1:804522593080:web:82d8680416b517043b8fcd",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db   = getFirestore(app);

const AuthContext = createContext(null);

export const ROLES = {
  OWNER:           "owner",
  ADMIN:           "admin",
  PROJECT_MANAGER: "project_manager",
  TEAM_LEAD:       "team_lead",
  CHATTER:         "chatter",
};

export const ROLE_LABELS = {
  admin:           "Admin",
  project_manager: "Project Manager",
  team_lead:       "Team Lead",
  chatter:         "Chatter",
};

export const ROLE_LABELS_DISPLAY = {
  owner:           "Owner",
  admin:           "Admin",
  project_manager: "Project Manager",
  team_lead:       "Team Lead",
  chatter:         "Chatter",
};

export const ROLE_COLORS = {
  owner:           "#f59e0b",
  admin:           "#7c3aed",
  project_manager: "#0ea5e9",
  team_lead:       "#10b981",
  chatter:         "#64748b",
};

// ── Permissions ───────────────────────────────────────────────────────────────
export const DEFAULT_PERMISSIONS = {
  owner: {
    nav_dashboard: true, nav_checklist: true, nav_chat: true,
    nav_schedule: true,  nav_content: true,   nav_models: true,
    nav_team: true,      nav_tasks: true,     nav_analytics: true,
    nav_settings: true,  nav_admin: true,     nav_team_panel: true,
    tasks_create_any: true, tasks_assign_any: true, tasks_see_all: true,
    models_see_all: true,   content_access: true,   settings_full: true,
  },
  admin: {
    nav_dashboard: true, nav_checklist: true, nav_chat: true,
    nav_schedule: true,  nav_content: true,   nav_models: true,
    nav_team: true,      nav_tasks: true,     nav_analytics: true,
    nav_settings: true,  nav_admin: false,    nav_team_panel: true,
    tasks_create_any: true, tasks_assign_any: true, tasks_see_all: true,
    models_see_all: true,   content_access: true,   settings_full: true,
  },
  project_manager: {
    nav_dashboard: true, nav_checklist: true, nav_chat: true,
    nav_schedule: true,  nav_content: false,  nav_models: true,
    nav_team: true,      nav_tasks: true,     nav_analytics: true,
    nav_settings: true,  nav_admin: false,    nav_team_panel: true,
    tasks_create_any: true, tasks_assign_any: true, tasks_see_all: true,
    models_see_all: true,   content_access: false,  settings_full: true,
  },
  team_lead: {
    nav_dashboard: true, nav_checklist: true, nav_chat: true,
    nav_schedule: true,  nav_content: false,  nav_models: true,
    nav_team: true,      nav_tasks: true,     nav_analytics: false,
    nav_settings: true,  nav_admin: false,    nav_team_panel: true,
    tasks_create_any: false, tasks_assign_any: false, tasks_see_all: false,
    models_see_all: false,   content_access: false,   settings_full: false,
  },
  chatter: {
    nav_dashboard: true, nav_checklist: true, nav_chat: true,
    nav_schedule: true,  nav_content: false,  nav_models: false,
    nav_team: false,     nav_tasks: true,     nav_analytics: false,
    nav_settings: true,  nav_admin: false,    nav_team_panel: true,
    tasks_create_any: false, tasks_assign_any: false, tasks_see_all: false,
    models_see_all: false,   content_access: false,   settings_full: false,
  },
};

export const resolvePermissions = (role, userPerms = {}) => {
  const base = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.chatter;
  return { ...base, ...userPerms };
};

export const canEditPermissions = (editorRole, targetRole) => {
  if (editorRole === "owner") return true;
  if (editorRole === "admin" && targetRole === "chatter") return true;
  return false;
};

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [profile,   setProfile]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false);
      setAuthError(true);
    }, 10000);

    const unsub = onAuthStateChanged(auth, async (u) => {
      clearTimeout(timeout);
      try {
        if (u) {
          setUser(u);
          const snap = await new Promise(resolve => {
            const unsub = onSnapshot(collection(db, "users"), snap => {
              unsub();
              resolve(snap);
            });
          });
          const found = snap.docs.find(d => d.data().uid === u.uid || d.id === u.uid);
          if (found) {
            const data  = found.data();
            const perms = resolvePermissions(data.role, data.permissions || {});
            setProfile({ ...data, _docId: found.id, _permissions: perms });
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (e) {
        console.error("Auth error:", e);
        setAuthError(true);
      }
      setLoading(false);
    });

    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, login, logout, loading, authError, db }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
