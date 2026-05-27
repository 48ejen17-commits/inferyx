import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth, ROLE_COLORS, ROLE_LABELS_DISPLAY, canEditPermissions, DEFAULT_PERMISSIONS, resolvePermissions } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Plus, X, Users, Shield, Edit3, Trash2, ChevronDown, ChevronUp, Check, AlertTriangle } from "lucide-react";

const PERM_LABELS = {
  nav_checklist:  "Чек-лист",
  nav_chat:       "Чаты",
  nav_schedule:   "График",
  nav_content:    "Контент",
  nav_models:     "Модели",
  nav_team:       "Команда",
  nav_tasks:      "Задачи",
  nav_analytics:  "Аналитика",
  nav_team_panel: "Панель команды",
  nav_settings:   "Настройки",
  tasks_create_any: "Создавать задачи для других",
  tasks_assign_any: "Назначать задачи другим",
  tasks_see_all:    "Видеть все задачи",
  models_see_all:   "Видеть все модели",
  content_access:   "Доступ к контенту",
  settings_full:    "Полные настройки",
};

// ── Permission Editor ─────────────────────────────────────────────────────────
function PermissionEditor({ targetUser, currentUserRole, db, t, onClose }) {
  const canEdit = canEditPermissions(currentUserRole, targetUser.role);
  const current = resolvePermissions(targetUser.role, targetUser.permissions || {});
  const [perms, setPerms] = useState({ ...current });
  const [saving, setSaving] = useState(false);

  if (!canEdit) return (
    <div style={{ padding: "20px", color: t.textMuted, textAlign: "center" }}>
      <Shield size={24} style={{ marginBottom: "8px", opacity: 0.4 }} />
      <div>Нет прав для редактирования разрешений этой роли</div>
    </div>
  );

  const toggle = (key) => setPerms(p => ({ ...p, [key]: !p[key] }));

  const save = async () => {
    setSaving(true);
    try {
      const docId = targetUser._docId || targetUser.id;
      await updateDoc(doc(db, "users", docId), { permissions: perms });
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const reset = () => {
    const defaults = DEFAULT_PERMISSIONS[targetUser.role] || DEFAULT_PERMISSIONS.chatter;
    setPerms({ ...defaults });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <div style={{ color: t.text, fontSize: "14px", fontWeight: 700 }}>Разрешения: {targetUser.name}</div>
          <div style={{ color: t.textMuted, fontSize: "12px" }}>{ROLE_LABELS_DISPLAY[targetUser.role]}</div>
        </div>
        <button onClick={reset} style={{ background: "none", border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "8px", padding: "5px 10px", fontSize: "11px", cursor: "pointer" }}>
          ↺ По умолчанию
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px", maxHeight: "300px", overflowY: "auto" }}>
        {Object.entries(PERM_LABELS).map(([key, label]) => (
          <div key={key} onClick={() => toggle(key)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: perms[key] ? "rgba(124,58,237,0.08)" : t.bgCardHover, borderRadius: "9px", border: `1px solid ${perms[key] ? "rgba(124,58,237,0.25)" : t.border}`, cursor: "pointer" }}>
            <span style={{ color: t.text, fontSize: "13px" }}>{label}</span>
            <div style={{ width: "20px", height: "20px", borderRadius: "6px", background: perms[key] ? "#7c3aed" : t.bgCard, border: `2px solid ${perms[key] ? "#7c3aed" : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {perms[key] && <Check size={12} style={{ color: "#fff" }} />}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={save} disabled={saving}
          style={{ flex: 1, background: "linear-gradient(135deg,#7c3aed,#db2877)", color: "#fff", border: "none", borderRadius: "10px", padding: "11px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Сохраняем..." : "Сохранить"}
        </button>
        <button onClick={onClose} style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "10px", padding: "11px 16px", cursor: "pointer" }}>Отмена</button>
      </div>
    </div>
  );
}

// ── Team Card ──────────────────────────────────────────────────────────────────
function TeamCard({ team, allUsers, allModels, canManage, onEdit, onDelete, db, currentUser, t }) {
  const [expanded, setExpanded] = useState(false);
  const [editingPerms, setEditingPerms] = useState(null);

  const members = allUsers.filter(u => (team.memberIds || []).includes(u.uid || u.id));
  const models  = allModels.filter(m => (team.modelIds || []).includes(m.id));

  const groupedMembers = {
    team_lead: members.filter(m => m.role === "team_lead"),
    chatter:   members.filter(m => m.role === "chatter"),
    other:     members.filter(m => !["team_lead","chatter"].includes(m.role)),
  };

  return (
    <motion.div layout initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "18px", overflow: "hidden", marginBottom: "14px" }}>

      {/* Header */}
      <div style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{ width: "46px", height: "46px", borderRadius: "14px", background: `linear-gradient(135deg, ${team.color || "#7c3aed"}, ${team.color || "#db2877"})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>
          {team.emoji || "👥"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: t.text, fontSize: "17px", fontWeight: 700 }}>{team.name}</div>
          <div style={{ color: t.textMuted, fontSize: "12px", marginTop: "2px" }}>
            {members.length} участников · {models.length} моделей
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setExpanded(v => !v)}
            style={{ background: expanded ? "rgba(124,58,237,0.12)" : t.bgCardHover, border: `1px solid ${expanded ? "rgba(124,58,237,0.3)" : t.border}`, color: expanded ? "#a78bfa" : t.textMuted, borderRadius: "9px", padding: "7px 14px", cursor: "pointer", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? "Свернуть" : "Открыть"}
          </button>
          {canManage && (
            <>
              <button onClick={() => onEdit(team)} style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "9px", padding: "7px 10px", cursor: "pointer" }}><Edit3 size={14} /></button>
              <button onClick={() => onDelete(team)} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444", borderRadius: "9px", padding: "7px 10px", cursor: "pointer" }}><Trash2 size={14} /></button>
            </>
          )}
        </div>
      </div>

      {/* Expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }} exit={{ height:0, opacity:0 }}
            style={{ borderTop: `1px solid ${t.border}`, overflow: "hidden" }}>
            <div style={{ padding: "20px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>

              {/* Members */}
              <div>
                <div style={{ color: t.textMuted, fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>Участники</div>

                {/* Hierarchy */}
                {[
                  { key: "team_lead", label: "🎯 Тим-лиды" },
                  { key: "chatter",   label: "💬 Чаттеры" },
                  { key: "other",     label: "👤 Другие" },
                ].map(({ key, label }) => {
                  const group = groupedMembers[key];
                  if (group.length === 0) return null;
                  return (
                    <div key={key} style={{ marginBottom: "12px" }}>
                      <div style={{ color: t.textFaint, fontSize: "11px", fontWeight: 600, marginBottom: "6px" }}>{label}</div>
                      {group.map(u => {
                        const rc = ROLE_COLORS[u.role] || "#64748b";
                        return (
                          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", background: t.bgCardHover, borderRadius: "9px", marginBottom: "4px" }}>
                            <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: `linear-gradient(135deg,${rc},${rc}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: u.avatarEmoji ? "13px" : "11px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                              {u.avatarEmoji || (u.name||"?")[0].toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{u.name}</div>
                              <div style={{ color: t.textFaint, fontSize: "11px" }}>{ROLE_LABELS_DISPLAY[u.role] || u.role}</div>
                            </div>
                            {canManage && (
                              <button onClick={() => setEditingPerms(editingPerms?.id === u.id ? null : u)}
                                style={{ background: editingPerms?.id === u.id ? "rgba(124,58,237,0.15)" : "none", border: `1px solid ${editingPerms?.id === u.id ? "rgba(124,58,237,0.3)" : t.border}`, color: editingPerms?.id === u.id ? "#a78bfa" : t.textMuted, borderRadius: "7px", padding: "4px 8px", cursor: "pointer", fontSize: "11px" }}>
                                <Shield size={11} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {members.length === 0 && <div style={{ color: t.textFaint, fontSize: "13px" }}>Нет участников</div>}
              </div>

              {/* Models */}
              <div>
                <div style={{ color: t.textMuted, fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>Модели команды</div>
                {models.length === 0 ? (
                  <div style={{ color: t.textFaint, fontSize: "13px" }}>Нет моделей</div>
                ) : models.map(m => {
                  const color = m.color || "#7c3aed";
                  return (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: t.bgCardHover, borderRadius: "10px", border: `1px solid ${color}25`, marginBottom: "6px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: `linear-gradient(135deg,${color},${color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>
                        {m.emoji || m.name[0]}
                      </div>
                      <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{m.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Permission editor */}
            <AnimatePresence>
              {editingPerms && (
                <motion.div initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }} exit={{ height:0, opacity:0 }}
                  style={{ borderTop: `1px solid ${t.border}`, padding: "20px 22px" }}>
                  <PermissionEditor
                    targetUser={editingPerms}
                    currentUserRole={currentUser?.role}
                    db={db} t={t}
                    onClose={() => setEditingPerms(null)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Edit Team Modal ────────────────────────────────────────────────────────────
const TEAM_COLORS = ["#7c3aed","#db2877","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#f97316"];
const TEAM_EMOJIS = ["👥","🚀","⚡","🎯","🔥","💎","👑","🌟","🎪","🦁"];

function EditTeamModal({ team, allUsers, allModels, onSave, onClose, t }) {
  const [form, setForm] = useState({
    name: team?.name || "",
    emoji: team?.emoji || "👥",
    color: team?.color || "#7c3aed",
    memberIds: team?.memberIds || [],
    modelIds:  team?.modelIds  || [],
  });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filteredUsers = allUsers.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    (ROLE_LABELS_DISPLAY[u.role]||"").toLowerCase().includes(search.toLowerCase())
  );

  const toggleMember = (uid) => setForm(f => ({
    ...f,
    memberIds: f.memberIds.includes(uid) ? f.memberIds.filter(id => id !== uid) : [...f.memberIds, uid],
  }));

  const toggleModel = (id) => setForm(f => ({
    ...f,
    modelIds: f.modelIds.includes(id) ? f.modelIds.filter(mid => mid !== id) : [...f.modelIds, id],
  }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <motion.div initial={{ scale:0.93, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.93, opacity:0 }}
        onClick={e => e.stopPropagation()}
        style={{ background: t.bgSecondary || t.bgCard, border: `1px solid ${t.border}`, borderRadius: "22px", padding: "28px", width: "100%", maxWidth: "680px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
          <h3 style={{ color: t.text, fontSize: "18px", fontWeight: 700 }}>{team ? "Редактировать команду" : "Новая команда"}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:t.textMuted, cursor:"pointer" }}><X size={20} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Name + emoji + color */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px" }}>
            <div>
              <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase" }}>Название команды</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                placeholder="Команда A..."
                style={{ width: "100%", background: t.bgInput, color: t.text, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", outline: "none", fontFamily: "inherit" }} />
            </div>
            <div>
              <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase" }}>Цвет</label>
              <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "2px" }}>
                {TEAM_COLORS.map(c => (
                  <button key={c} onClick={() => setForm({...form, color: c})}
                    style={{ width: "24px", height: "24px", borderRadius: "50%", background: c, border: form.color === c ? "3px solid #fff" : "2px solid transparent", cursor: "pointer" }} />
                ))}
              </div>
            </div>
          </div>

          {/* Emoji */}
          <div>
            <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "8px", textTransform: "uppercase" }}>Иконка</label>
            <div style={{ display: "flex", gap: "6px" }}>
              {TEAM_EMOJIS.map(e => (
                <button key={e} onClick={() => setForm({...form, emoji: e})}
                  style={{ width: "36px", height: "36px", borderRadius: "9px", fontSize: "18px", border: `2px solid ${form.emoji === e ? "#7c3aed" : t.border}`, background: form.emoji === e ? "rgba(124,58,237,0.15)" : t.bgCard, cursor: "pointer" }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
            {/* Members */}
            <div>
              <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "8px", textTransform: "uppercase" }}>
                Участники ({form.memberIds.length})
              </label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..."
                style={{ width: "100%", background: t.bgInput, color: t.text, border: `1px solid ${t.border}`, borderRadius: "8px", padding: "7px 10px", fontSize: "12px", outline: "none", fontFamily: "inherit", marginBottom: "8px" }} />
              <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                {filteredUsers.map(u => {
                  const selected = form.memberIds.includes(u.uid || u.id);
                  const rc = ROLE_COLORS[u.role] || "#64748b";
                  return (
                    <div key={u.id} onClick={() => toggleMember(u.uid || u.id)}
                      style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", background: selected ? "rgba(124,58,237,0.1)" : t.bgCard, borderRadius: "8px", border: `1px solid ${selected ? "rgba(124,58,237,0.3)" : t.border}`, cursor: "pointer" }}>
                      <div style={{ width: "24px", height: "24px", borderRadius: "7px", background: `linear-gradient(135deg,${rc},${rc}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                        {u.avatarEmoji || (u.name||"?")[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: t.text, fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
                        <div style={{ color: t.textFaint, fontSize: "10px" }}>{ROLE_LABELS_DISPLAY[u.role]}</div>
                      </div>
                      {selected && <Check size={14} style={{ color: "#7c3aed", flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Models */}
            <div>
              <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "8px", textTransform: "uppercase" }}>
                Модели ({form.modelIds.length})
              </label>
              <div style={{ maxHeight: "232px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                {allModels.filter(m => m.status !== "inactive").map(m => {
                  const selected = form.modelIds.includes(m.id);
                  const color = m.color || "#7c3aed";
                  return (
                    <div key={m.id} onClick={() => toggleModel(m.id)}
                      style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", background: selected ? `${color}12` : t.bgCard, borderRadius: "8px", border: `1px solid ${selected ? color+"40" : t.border}`, cursor: "pointer" }}>
                      <div style={{ width: "24px", height: "24px", borderRadius: "7px", background: `linear-gradient(135deg,${color},${color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0 }}>
                        {m.emoji || m.name[0]}
                      </div>
                      <div style={{ flex: 1, color: t.text, fontSize: "12px", fontWeight: 600 }}>{m.name}</div>
                      {selected && <Check size={14} style={{ color, flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={save} disabled={saving || !form.name.trim()}
              style={{ flex: 1, background: form.name.trim() ? "linear-gradient(135deg,#7c3aed,#db2877)" : "rgba(124,58,237,0.3)", color: "#fff", border: "none", borderRadius: "12px", padding: "13px", fontSize: "15px", fontWeight: 700, cursor: form.name.trim() ? "pointer" : "not-allowed" }}>
              {saving ? "Сохраняем..." : team ? "Сохранить" : "Создать команду"}
            </button>
            <button onClick={onClose} style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "12px", padding: "13px 20px", cursor: "pointer" }}>Отмена</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Teams Page ────────────────────────────────────────────────────────────
export default function Teams() {
  const { db, profile } = useAuth();
  const { theme } = useTheme();
  const t = theme;

  const [teams,    setTeams]    = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allModels, setAllModels] = useState([]);
  const [editTarget, setEditTarget] = useState(null); // null | "new" | team
  const [confirmDel, setConfirmDel] = useState(null);

  const canManage = ["owner","admin"].includes(profile?.role?.toLowerCase());

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "teams"),  s => setTeams(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "users"),  s => setAllUsers(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "models"), s => setAllModels(s.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  const saveTeam = async (form) => {
    if (editTarget && editTarget !== "new") {
      await updateDoc(doc(db, "teams", editTarget.id), form);
    } else {
      await addDoc(collection(db, "teams"), { ...form, createdAt: new Date().toISOString() });
    }
    setEditTarget(null);
  };

  const deleteTeam = async () => {
    if (!confirmDel) return;
    await deleteDoc(doc(db, "teams", confirmDel.id));
    setConfirmDel(null);
  };

  // Filter teams visible to current user
  const visibleTeams = profile?.role === "owner" || profile?.role === "admin" || profile?.role === "project_manager"
    ? teams
    : teams.filter(team => (team.memberIds || []).includes(profile?.uid));

  return (
    <div>
      <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"28px" }}>
        <div>
          <h1 style={{ fontSize:"26px", fontWeight:700, color:t.text, marginBottom:"6px" }}>Команды</h1>
          <p style={{ color:t.textMuted, fontSize:"14px" }}>{visibleTeams.length} команд · {allUsers.length} сотрудников</p>
        </div>
        {canManage && (
          <button onClick={() => setEditTarget("new")}
            style={{ display:"flex", alignItems:"center", gap:"8px", background:"linear-gradient(135deg,#7c3aed,#db2877)", color:"#fff", border:"none", borderRadius:"12px", padding:"11px 20px", fontSize:"14px", fontWeight:600, cursor:"pointer" }}>
            <Plus size={16} />Новая команда
          </button>
        )}
      </motion.div>

      {visibleTeams.length === 0 ? (
        <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:"20px", padding:"60px", textAlign:"center" }}>
          <div style={{ fontSize:"40px", marginBottom:"14px" }}>👥</div>
          <p style={{ color:t.textMuted }}>{canManage ? "Создай первую команду!" : "Ты пока не в командах"}</p>
        </div>
      ) : visibleTeams.map(team => (
        <TeamCard key={team.id} team={team} allUsers={allUsers} allModels={allModels}
          canManage={canManage} onEdit={t => setEditTarget(t)} onDelete={t => setConfirmDel(t)}
          db={db} currentUser={profile} t={t} />
      ))}

      <AnimatePresence>
        {editTarget && (
          <EditTeamModal
            team={editTarget === "new" ? null : editTarget}
            allUsers={allUsers} allModels={allModels}
            onSave={saveTeam} onClose={() => setEditTarget(null)} t={t}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDel && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={() => setConfirmDel(null)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
            <motion.div initial={{ scale:0.92 }} animate={{ scale:1 }} exit={{ scale:0.92 }}
              onClick={e => e.stopPropagation()}
              style={{ background: t.bgSecondary || t.bgCard, border:"1px solid rgba(239,68,68,0.3)", borderRadius:"20px", padding:"28px", maxWidth:"380px", width:"100%", textAlign:"center" }}>
              <AlertTriangle size={36} style={{ color:"#ef4444", marginBottom:"14px" }} />
              <h3 style={{ color:t.text, fontSize:"17px", fontWeight:700, marginBottom:"8px" }}>Удалить команду?</h3>
              <p style={{ color:t.textMuted, fontSize:"14px", marginBottom:"22px" }}>«{confirmDel.name}» будет удалена безвозвратно</p>
              <div style={{ display:"flex", gap:"10px" }}>
                <button onClick={deleteTeam} style={{ flex:1, background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", color:"#ef4444", borderRadius:"12px", padding:"12px", fontSize:"14px", fontWeight:600, cursor:"pointer" }}>Удалить</button>
                <button onClick={() => setConfirmDel(null)} style={{ flex:1, background:t.bgCardHover, border:`1px solid ${t.border}`, color:t.textMuted, borderRadius:"12px", padding:"12px", cursor:"pointer" }}>Отмена</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
