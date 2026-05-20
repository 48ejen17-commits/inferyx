import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, where, getDocs } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { useAuth, ROLES, ROLE_LABELS, ROLE_LABELS_DISPLAY, ROLE_COLORS } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Plus, X, Users, Shield, TrendingUp, Activity, Lock, Trash2, AlertTriangle } from "lucide-react";

export default function Team() {
  const { db, profile } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const t = theme;
  const [users, setUsers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: ROLES.CHATTER });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const isOwner = profile?.role === ROLES.OWNER;
  const ASSIGNABLE_ROLES = Object.entries(ROLE_LABELS); // без owner

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "users"), snap => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }),
      onSnapshot(collection(db, "entries"), snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  const createMember = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) return;
    setCreating(true); setError("");
    try {
      const auth = getAuth();
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await addDoc(collection(db, "users"), {
        uid: cred.user.uid, name: form.name, email: form.email,
        role: form.role, createdAt: new Date().toISOString()
      });
      setForm({ name: "", email: "", password: "", role: ROLES.CHATTER });
      setShowForm(false);
    } catch (e) {
      setError(e.message.includes("email-already-in-use") ? "Email уже используется" : "Ошибка создания аккаунта");
    }
    setCreating(false);
  };

  const changeRole = async (userId, newRole) => {
    if (!isOwner) return;
    await updateDoc(doc(db, "users", userId), { role: newRole });
    if (selected) setSelected({ ...selected, role: newRole });
  };

  const deleteUser = async (user) => {
    if (!isOwner) return;
    // Удаляем документ из Firestore
    await deleteDoc(doc(db, "users", user.id));
    setConfirmDelete(null);
    setSelected(null);
  };

  const getUserStats = (uid) => ({
    total: entries.filter(e => e.userId === uid).length,
    traffic: entries.filter(e => e.userId === uid).reduce((s, e) => s + (e.traffic || 0), 0),
    today: entries.filter(e => e.userId === uid && e.date === new Date().toLocaleDateString("ru-RU")).length,
  });

  const roleOrder = [ROLES.OWNER, ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.TEAM_LEAD, ROLES.CHATTER];
  const grouped = roleOrder.map(role => ({ role, members: users.filter(u => u.role === role) })).filter(g => g.members.length > 0);

  const inputStyle = { background: t.bgInput, color: t.text, border: `1px solid ${t.borderInput}`, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", outline: "none", fontFamily: "inherit", width: "100%" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: t.text, marginBottom: "4px" }}>Команда</h1>
          <p style={{ color: t.textMuted, fontSize: "14px" }}>{users.length} участников</p>
        </div>
        {isOwner ? (
          <button onClick={() => setShowForm(true)}
            style={{ display: "flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
            <Plus size={16} />Добавить участника
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "10px", padding: "10px 20px", fontSize: "14px" }}>
            <Lock size={14} />Только Owner может добавлять
          </div>
        )}
      </div>

      {/* Add member modal */}
      <AnimatePresence>
        {showForm && isOwner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "420px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 600 }}>Новый участник</h3>
                <button onClick={() => { setShowForm(false); setError(""); }} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div><label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Имя</label><input placeholder="Иван Иванов" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} /></div>
                <div><label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Email</label><input type="email" placeholder="ivan@inferyx.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} /></div>
                <div><label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Пароль</label><input type="password" placeholder="Минимум 6 символов" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={inputStyle} /></div>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Роль</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={inputStyle}>
                    {ASSIGNABLE_ROLES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                  </select>
                  <div style={{ color: t.textFaint, fontSize: "11px", marginTop: "6px" }}>* Роль Owner назначается только через Firebase</div>
                </div>
                {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "10px 14px", color: "#f87171", fontSize: "13px" }}>{error}</div>}
                <button onClick={createMember} disabled={creating}
                  style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 600, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1 }}>
                  {creating ? "Создание..." : "Создать аккаунт"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm delete modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: t.bgSecondary, border: "1px solid rgba(239,68,68,0.3)", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "380px" }}>
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <AlertTriangle size={40} style={{ color: "#ef4444", marginBottom: "12px" }} />
                <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>Удалить пользователя?</h3>
                <p style={{ color: t.textMuted, fontSize: "14px", lineHeight: "1.5" }}>
                  <strong style={{ color: t.text }}>{confirmDelete.name}</strong> будет удалён из команды.<br />
                  Его данные и записи останутся в системе.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => deleteUser(confirmDelete)}
                  style={{ flex: 1, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: "10px", padding: "11px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                  Да, удалить
                </button>
                <button onClick={() => setConfirmDelete(null)}
                  style={{ flex: 1, background: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "10px", padding: "11px", fontSize: "14px", cursor: "pointer" }}>
                  Отмена
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Member detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "480px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: `linear-gradient(135deg, ${ROLE_COLORS[selected.role]}, ${ROLE_COLORS[selected.role]}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: selected.avatarEmoji ? "24px" : "20px", fontWeight: 700, color: "#fff" }}>
                    {selected.avatarEmoji || (selected.name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: t.text, fontSize: "18px", fontWeight: 700 }}>{selected.name}</div>
                    <div style={{ display: "inline-block", marginTop: "4px", fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "20px", background: `${ROLE_COLORS[selected.role]}20`, color: ROLE_COLORS[selected.role], textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {ROLE_LABELS_DISPLAY[selected.role] || selected.role}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {/* Delete button — только owner, нельзя удалить другого owner */}
                  {isOwner && selected.role !== ROLES.OWNER && (
                    <button onClick={() => setConfirmDelete(selected)}
                      style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", borderRadius: "8px", padding: "7px 12px", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Trash2 size={14} />Удалить
                    </button>
                  )}
                  <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
                </div>
              </div>

              {/* Stats */}
              {(() => {
                const stats = getUserStats(selected.uid || selected.id);
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
                    {[
                      { label: "Всего записей", value: stats.total, icon: Activity, color: "#7c3aed" },
                      { label: "Трафик", value: stats.traffic.toLocaleString(), icon: TrendingUp, color: "#10b981" },
                      { label: "Сегодня", value: stats.today, icon: Shield, color: "#0ea5e9" },
                    ].map((s, i) => (
                      <div key={i} style={{ background: t.bgCard, borderRadius: "12px", padding: "14px", textAlign: "center" }}>
                        <s.icon size={18} style={{ color: s.color, marginBottom: "6px" }} />
                        <div style={{ color: t.text, fontSize: "20px", fontWeight: 700 }}>{s.value}</div>
                        <div style={{ color: t.textMuted, fontSize: "11px" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Recent entries */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ color: t.textMuted, fontSize: "12px", marginBottom: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Последние записи</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "180px", overflowY: "auto" }}>
                  {entries.filter(e => e.userId === (selected.uid || selected.id)).slice(0, 8).map(e => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: t.bgCard, borderRadius: "8px" }}>
                      <div>
                        <div style={{ color: t.text, fontSize: "13px" }}>{e.platform} · {e.model}</div>
                        <div style={{ color: t.textMuted, fontSize: "12px" }}>{e.note}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {e.traffic > 0 && <div style={{ color: "#10b981", fontSize: "13px", fontWeight: 600 }}>+{e.traffic}</div>}
                        <div style={{ color: t.textFaint, fontSize: "11px" }}>{e.date}</div>
                      </div>
                    </div>
                  ))}
                  {entries.filter(e => e.userId === (selected.uid || selected.id)).length === 0 && (
                    <div style={{ color: t.textMuted, textAlign: "center", padding: "16px" }}>Нет записей</div>
                  )}
                </div>
              </div>

              {/* Change role — только owner, только не owner роль */}
              {isOwner && selected.role !== ROLES.OWNER && (
                <div style={{ paddingTop: "16px", borderTop: `1px solid ${t.border}` }}>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "8px" }}>Изменить роль</label>
                  <select value={selected.role} onChange={e => changeRole(selected.id, e.target.value)} style={inputStyle}>
                    {ASSIGNABLE_ROLES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                  </select>
                  <div style={{ color: t.textFaint, fontSize: "11px", marginTop: "6px" }}>* Роль Owner назначается только через Firebase</div>
                </div>
              )}

              {selected.role === ROLES.OWNER && (
                <div style={{ paddingTop: "16px", borderTop: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
                  <Lock size={14} style={{ color: t.textMuted }} />
                  <span style={{ color: t.textMuted, fontSize: "13px" }}>Роль Owner нельзя изменить через интерфейс</span>
                </div>
              )}

              {/* Open profile button */}
              <div style={{ marginTop: "16px" }}>
                <button onClick={() => { navigate(`/profile/${selected.uid || selected.id}`); setSelected(null); }}
                  style={{ width: "100%", background: "linear-gradient(135deg, #7c3aed, #db2877)", color: "#fff", border: "none", borderRadius: "10px", padding: "11px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                  👤 Открыть профиль
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Team list */}
      {loading ? (
        <div style={{ color: t.textMuted, textAlign: "center", padding: "60px" }}>Загрузка...</div>
      ) : users.length === 0 ? (
        <div style={{ color: t.textMuted, textAlign: "center", padding: "60px" }}>
          <Users size={40} style={{ marginBottom: "12px", opacity: 0.3 }} />
          <div>Нет участников</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {grouped.map(({ role, members }) => (
            <div key={role}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: ROLE_COLORS[role] }} />
                <span style={{ color: ROLE_COLORS[role], fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>
                  {ROLE_LABELS_DISPLAY[role] || role}
                </span>
                <span style={{ color: t.textFaint, fontSize: "13px" }}>({members.length})</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
                {members.map((member, i) => {
                  const stats = getUserStats(member.uid || member.id);
                  return (
                    <motion.div key={member.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      onClick={() => setSelected(member)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "14px", padding: "18px", cursor: "pointer", position: "relative" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                        <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: `linear-gradient(135deg, ${ROLE_COLORS[role]}, ${ROLE_COLORS[role]}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: member.avatarEmoji ? "20px" : "16px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                          {member.avatarEmoji || (member.name || "?")[0].toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ color: t.text, fontWeight: 600, fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{member.name}</div>
                          <div style={{ color: ROLE_COLORS[role], fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            {ROLE_LABELS_DISPLAY[role] || role}
                          </div>
                        </div>
                        {role === ROLES.OWNER && <Lock size={12} style={{ color: ROLE_COLORS[role], flexShrink: 0 }} />}
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {[
                          { v: stats.total, l: "записей", c: t.text },
                          { v: stats.traffic.toLocaleString(), l: "трафик", c: "#10b981" },
                          { v: stats.today, l: "сегодня", c: "#0ea5e9" }
                        ].map((s, i) => (
                          <div key={i} style={{ flex: 1, textAlign: "center", background: t.bgCardHover, borderRadius: "8px", padding: "8px" }}>
                            <div style={{ color: s.c, fontSize: "16px", fontWeight: 700 }}>{s.v}</div>
                            <div style={{ color: t.textMuted, fontSize: "11px" }}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
