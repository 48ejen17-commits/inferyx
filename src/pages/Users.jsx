import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { useAuth, ROLES, ROLE_LABELS, ROLE_LABELS_DISPLAY, ROLE_COLORS, DEFAULT_PERMISSIONS, resolvePermissions, canEditPermissions } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Plus, X, Edit3, Trash2, Shield, Check, AlertTriangle, Search, ChevronDown, ChevronUp } from "lucide-react";

const PERM_LABELS = {
  nav_checklist:    { label: "Чек-лист",              group: "Навигация" },
  nav_chat:         { label: "Чаты",                  group: "Навигация" },
  nav_schedule:     { label: "График",                group: "Навигация" },
  nav_content:      { label: "Контент",               group: "Навигация" },
  nav_models:       { label: "Модели",                group: "Навигация" },
  nav_team:         { label: "Команды",               group: "Навигация" },
  nav_tasks:        { label: "Задачи",                group: "Навигация" },
  nav_analytics:    { label: "Аналитика",             group: "Навигация" },
  nav_team_panel:   { label: "Панель команды",        group: "Навигация" },
  nav_settings:     { label: "Настройки",             group: "Навигация" },
  tasks_create_any: { label: "Создавать задачи другим", group: "Задачи" },
  tasks_assign_any: { label: "Назначать задачи другим", group: "Задачи" },
  tasks_see_all:    { label: "Видеть все задачи",     group: "Задачи" },
  models_see_all:   { label: "Видеть все модели",     group: "Доступ" },
  content_access:   { label: "Полный доступ к контенту", group: "Доступ" },
  settings_full:    { label: "Полные настройки",      group: "Доступ" },
};

// Group permissions by category
const PERM_GROUPS = {};
Object.entries(PERM_LABELS).forEach(([key, val]) => {
  if (!PERM_GROUPS[val.group]) PERM_GROUPS[val.group] = [];
  PERM_GROUPS[val.group].push(key);
});

// ── Permission Editor ─────────────────────────────────────────────────────────
function PermEditor({ user: targetUser, editorRole, db, t, onClose }) {
  const canEdit = canEditPermissions(editorRole, targetUser.role);
  const [perms, setPerms] = useState(resolvePermissions(targetUser.role, targetUser.permissions || {}));
  const [saving, setSaving] = useState(false);

  const toggle = (key) => setPerms(p => ({ ...p, [key]: !p[key] }));
  const reset  = () => setPerms(resolvePermissions(targetUser.role, {}));

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", targetUser._docId || targetUser.id), { permissions: perms });
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  if (!canEdit) return (
    <div style={{ padding: "16px", color: t.textMuted, textAlign: "center", fontSize: "13px" }}>
      <Shield size={20} style={{ display: "block", margin: "0 auto 8px", opacity: 0.3 }} />
      Нет прав для редактирования разрешений этой роли
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <div style={{ color: t.text, fontSize: "14px", fontWeight: 700 }}>
          Разрешения — {targetUser.name}
          <span style={{ color: ROLE_COLORS[targetUser.role], fontSize: "11px", fontWeight: 600, marginLeft: "8px", textTransform: "uppercase" }}>
            {ROLE_LABELS_DISPLAY[targetUser.role]}
          </span>
        </div>
        <button onClick={reset}
          style={{ background: "none", border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "8px", padding: "4px 10px", fontSize: "11px", cursor: "pointer" }}>
          ↺ Сбросить
        </button>
      </div>

      {Object.entries(PERM_GROUPS).map(([group, keys]) => (
        <div key={group} style={{ marginBottom: "14px" }}>
          <div style={{ color: t.textFaint, fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px" }}>{group}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {keys.map(key => (
              <div key={key} onClick={() => toggle(key)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: perms[key] ? "rgba(124,58,237,0.08)" : t.bgCardHover, borderRadius: "8px", border: `1px solid ${perms[key] ? "rgba(124,58,237,0.25)" : t.border}`, cursor: "pointer" }}>
                <span style={{ color: t.text, fontSize: "13px" }}>{PERM_LABELS[key].label}</span>
                <div style={{ width: "20px", height: "20px", borderRadius: "6px", background: perms[key] ? "#7c3aed" : t.bgCard, border: `2px solid ${perms[key] ? "#7c3aed" : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {perms[key] && <Check size={12} style={{ color: "#fff" }} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
        <button onClick={save} disabled={saving}
          style={{ flex: 1, background: "linear-gradient(135deg,#7c3aed,#db2877)", color: "#fff", border: "none", borderRadius: "10px", padding: "11px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Сохраняем..." : "Сохранить"}
        </button>
        <button onClick={onClose}
          style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "10px", padding: "11px 16px", cursor: "pointer" }}>
          Отмена
        </button>
      </div>
    </div>
  );
}

// ── User Row ──────────────────────────────────────────────────────────────────
function UserRow({ u, editorRole, canDelete, db, t, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [editingRole, setEditingRole] = useState(false);
  const [newRole, setNewRole] = useState(u.role);
  const [saving, setSaving] = useState(false);

  const rc = ROLE_COLORS[u.role] || "#64748b";

  const saveRole = async () => {
    if (newRole === u.role) { setEditingRole(false); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", u._docId || u.id), { role: newRole });
    } catch (e) { console.error(e); }
    setSaving(false);
    setEditingRole(false);
  };

  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "14px", marginBottom: "8px", overflow: "hidden" }}>
      {/* Main row */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px" }}>
        {/* Avatar */}
        <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: `linear-gradient(135deg,${rc},${rc}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: u.avatarEmoji ? "18px" : "14px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
          {u.avatarEmoji || (u.name || "?")[0].toUpperCase()}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: t.text, fontSize: "14px", fontWeight: 600, marginBottom: "2px" }}>{u.name || "—"}</div>
          <div style={{ color: t.textMuted, fontSize: "12px" }}>{u.email || u.telegram || "—"}</div>
        </div>

        {/* Role */}
        {editingRole ? (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <select value={newRole} onChange={e => setNewRole(e.target.value)}
              style={{ background: t.bgInput, color: t.text, border: `1px solid ${t.border}`, borderRadius: "8px", padding: "6px 10px", fontSize: "12px", outline: "none", fontFamily: "inherit" }}>
              {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={saveRole} disabled={saving}
              style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}>
              {saving ? "..." : "✓"}
            </button>
            <button onClick={() => setEditingRole(false)}
              style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "8px", padding: "6px 10px", fontSize: "12px", cursor: "pointer" }}>
              ✕
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: `${rc}18`, color: rc, fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {ROLE_LABELS_DISPLAY[u.role] || u.role}
            </span>
            {u.role !== "owner" && editorRole === "owner" && (
              <button onClick={() => setEditingRole(true)}
                style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", padding: "2px" }}>
                <Edit3 size={13} />
              </button>
            )}
          </div>
        )}

        {/* Permissions toggle */}
        {u.role !== "owner" && (
          <button onClick={() => setExpanded(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: "5px", background: expanded ? "rgba(124,58,237,0.1)" : t.bgCardHover, border: `1px solid ${expanded ? "rgba(124,58,237,0.3)" : t.border}`, color: expanded ? "#a78bfa" : t.textMuted, borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
            <Shield size={13} />
            {!expanded ? "Права" : "Скрыть"}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}

        {/* Delete */}
        {canDelete && u.role !== "owner" && (
          <button onClick={() => onDelete(u)}
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444", borderRadius: "8px", padding: "6px 10px", cursor: "pointer" }}>
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Permissions panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ borderTop: `1px solid ${t.border}`, padding: "18px 18px", overflow: "hidden" }}>
            <PermEditor user={u} editorRole={editorRole} db={db} t={t} onClose={() => setExpanded(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── New User Modal ────────────────────────────────────────────────────────────
function NewUserModal({ db, t, onClose }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "chatter", telegram: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError("Заполни имя, email и пароль"); return;
    }
    setSaving(true);
    setError("");
    try {
      const secondAuth = getAuth();
      const cred = await createUserWithEmailAndPassword(secondAuth, form.email.trim(), form.password);
      await addDoc(collection(db, "users"), {
        uid:      cred.user.uid,
        name:     form.name.trim(),
        email:    form.email.trim(),
        role:     form.role,
        telegram: form.telegram.trim(),
        permissions: {},
        createdAt: new Date().toISOString(),
      });
      onClose();
    } catch (e) {
      setError(e.message || "Ошибка создания");
    }
    setSaving(false);
  };

  const inputStyle = { width: "100%", background: t.bgInput, color: t.text, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", outline: "none", fontFamily: "inherit" };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <motion.div initial={{ scale: 0.93 }} animate={{ scale: 1 }} exit={{ scale: 0.93 }}
        onClick={e => e.stopPropagation()}
        style={{ background: t.bgSecondary || t.bgCard, border: `1px solid ${t.border}`, borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "440px", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
          <h3 style={{ color: t.text, fontSize: "17px", fontWeight: 700 }}>👤 Новый пользователь</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase" }}>Имя *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Имя Фамилия" style={inputStyle} />
          </div>
          <div>
            <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase" }}>Email *</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" style={inputStyle} />
          </div>
          <div>
            <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase" }}>Пароль *</label>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="минимум 6 символов" style={inputStyle} />
          </div>
          <div>
            <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase" }}>Роль</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
              style={{ ...inputStyle }}>
              {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase" }}>Telegram (необязательно)</label>
            <input value={form.telegram} onChange={e => setForm({ ...form, telegram: e.target.value })} placeholder="@username" style={inputStyle} />
          </div>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "10px 14px", color: "#f87171", fontSize: "13px" }}>
              ❌ {error}
            </div>
          )}

          <button onClick={save} disabled={saving}
            style={{ width: "100%", marginTop: "4px", background: "linear-gradient(135deg,#7c3aed,#db2877)", color: "#fff", border: "none", borderRadius: "12px", padding: "13px", fontSize: "15px", fontWeight: 700, cursor: "pointer" }}>
            {saving ? "Создаём..." : "Создать пользователя"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Users Page ───────────────────────────────────────────────────────────
export default function Users() {
  const { db, profile } = useAuth();
  const { theme } = useTheme();
  const t = theme;

  const [users, setUsers]         = useState([]);
  const [search, setSearch]       = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [showNew, setShowNew]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const isOwner = profile?.role === "owner";
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    return onSnapshot(collection(db, "users"), snap =>
      setUsers(snap.docs.map(d => ({ id: d.id, _docId: d.id, ...d.data() })))
    );
  }, [db]);

  const deleteUser = async () => {
    if (!confirmDel) return;
    await deleteDoc(doc(db, "users", confirmDel._docId || confirmDel.id));
    setConfirmDel(null);
  };

  // Sort: owner → admin → pm → team_lead → chatter
  const ROLE_ORDER = { owner: 0, admin: 1, project_manager: 2, team_lead: 3, chatter: 4 };
  const filtered = users
    .filter(u => {
      if (filterRole !== "all" && u.role !== filterRole) return false;
      if (search && !u.name?.toLowerCase().includes(search.toLowerCase()) && !u.email?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 5) - (ROLE_ORDER[b.role] ?? 5));

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: t.text, marginBottom: "6px" }}>Пользователи</h1>
          <p style={{ color: t.textMuted, fontSize: "14px" }}>{users.length} человек в системе</p>
        </div>
        {isOwner && (
          <button onClick={() => setShowNew(true)}
            style={{ display: "flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg,#7c3aed,#db2877)", color: "#fff", border: "none", borderRadius: "12px", padding: "11px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
            <Plus size={16} />Добавить
          </button>
        )}
      </motion.div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
          <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: t.textMuted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени или email..."
            style={{ width: "100%", background: t.bgCard, color: t.text, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "10px 12px 10px 34px", fontSize: "13px", outline: "none", fontFamily: "inherit" }} />
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {[{ v: "all", l: "Все" }, { v: "owner", l: "Owner" }, { v: "admin", l: "Admin" }, { v: "team_lead", l: "Team Lead" }, { v: "chatter", l: "Chatter" }].map(opt => (
            <button key={opt.v} onClick={() => setFilterRole(opt.v)}
              style={{ padding: "8px 14px", borderRadius: "9px", border: `1px solid ${filterRole === opt.v ? "#7c3aed" : t.border}`, background: filterRole === opt.v ? "rgba(124,58,237,0.15)" : t.bgCard, color: filterRole === opt.v ? "#a78bfa" : t.textMuted, fontSize: "13px", fontWeight: filterRole === opt.v ? 700 : 400, cursor: "pointer" }}>
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* Users list */}
      <div>
        {filtered.length === 0 ? (
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "40px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "10px" }}>👤</div>
            <div style={{ color: t.textMuted }}>Нет пользователей</div>
          </div>
        ) : filtered.map(u => (
          <UserRow key={u.id} u={u} editorRole={profile?.role}
            canDelete={isOwner} db={db} t={t}
            onDelete={u => setConfirmDel(u)} />
        ))}
      </div>

      {/* New user modal */}
      <AnimatePresence>
        {showNew && <NewUserModal db={db} t={t} onClose={() => setShowNew(false)} />}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {confirmDel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setConfirmDel(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
              onClick={e => e.stopPropagation()}
              style={{ background: t.bgSecondary || t.bgCard, border: "1px solid rgba(239,68,68,0.3)", borderRadius: "20px", padding: "28px", maxWidth: "380px", width: "100%", textAlign: "center" }}>
              <AlertTriangle size={36} style={{ color: "#ef4444", marginBottom: "14px" }} />
              <h3 style={{ color: t.text, fontSize: "17px", fontWeight: 700, marginBottom: "8px" }}>Удалить пользователя?</h3>
              <p style={{ color: t.textMuted, fontSize: "14px", marginBottom: "22px" }}>
                «{confirmDel.name}» будет удалён из системы. Войти снова он не сможет.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={deleteUser} style={{ flex: 1, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: "12px", padding: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Удалить</button>
                <button onClick={() => setConfirmDel(null)} style={{ flex: 1, background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "12px", padding: "12px", cursor: "pointer" }}>Отмена</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
