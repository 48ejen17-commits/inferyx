import { createContext, useContext, useEffect, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB3TeUaqDGu_4hhu8Mmr348W-SFWhq6bsU",
  authDomain: "jgnn-3d5e4.firebaseapp.com",
  projectId: "jgnn-3d5e4",
  storageBucket: "jgnn-3d5e4.firebasestorage.app",
  messagingSenderId: "804522593080",
  appId: "1:804522593080:web:82d8680416b517043b8fcd",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);

const AuthContext = createContext(null);

export const ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  PROJECT_MANAGER: "project_manager",
  TEAM_LEAD: "team_lead",
  CHATTER: "chatter",
};

export const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  project_manager: "Project Manager",
  team_lead: "Team Lead",
  chatter: "Chatter",
};

export const ROLE_COLORS = {
  owner: "#f59e0b",
  admin: "#7c3aed",
  project_manager: "#0ea5e9",
  team_lead: "#10b981",
  chatter: "#64748b",
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          setProfile(snap.data());
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, login, logout, loading, db }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
