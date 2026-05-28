import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth, ROLES } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Plus, Trash2, Settings as SettingsIcon, Globe, User, Moon, Sun, AlertTriangle, Shield } from "lucide-react";

export default function Settings() {
  const { db, profile, user } = useAuth();
  const { theme, mode, toggle } = useTheme();
  const t = theme;
  const [platforms, setPlatforms] = useState([]);
  const [models, setModels] = useState([]);
  const [newPlatform, setNewPlatform] = useState("");
  const [newModel, setNewModel] = useState("");
  const [activeTab, setActiveTab] = useState("platforms");
  const [confirmDelete, setConfirmDelete] = useState(null); // { type, id, name }

  const isOwner   = profile?.role === ROLES.OWNER;
  const isAdmin   = profile?.role === ROLES.ADMIN || isOwner;
  const isChatter = profile?.role === ROLES.CHATTER;
  const isTeamLead = profile?.role === ROLES.TEAM_LEAD;

  const allTabs = [
    { id: "platforms",  label: "Платформы",  icon: Globe,                          restricted: true,  ownerOnly: false },
    { id: "models",     label: "Модели",      icon: User,                           restricted: true,  ownerOnly: false },
    { id: "appearance", label: "Внешний вид", icon: mode === "dark" ? Moon : Sun,   restricted: false, ownerOnly: false },
    { id: "account",    label: "Аккаунт",     icon: SettingsIcon,                   restricted: false, ownerOnly: false },
    { id: "site",       label: "Управление",  icon: Shield,                         restricted: true,  ownerOnly: true  },
  ];

  // Chatter and team_lead only see appearance + account
  const tabs = (isChatter || isTeamLead)
    ? allTabs.filter(tb => !tb.restricted)
    : isOwner
    ? allTabs
    : allTabs.filter(tb => !tb.ownerOnly);

  // Set default tab based on role
  useEffect(() => {
    if ((isChatter || isTeamLead) && (activeTab === "platforms" || activeTab === "models")) {
      setActiveTab("appearance");
    }
  }, [profile?.role]);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "platforms"), snap => setPlatforms(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "models"),    snap => setModels(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  const addPlatform = async () => {
    if (!newPlatform.trim()) return;
    await addDoc(collection(db, "platforms"), { name: newPlatform.trim(), createdAt: new Date().toISOString() });
    setNewPlatform("");
  };

  const addModel = async () => {
    if (!newModel.trim()) return;
    await addDoc(collection(db, "models"), { name: newModel.trim(), createdAt: new Date().toISOString() });
    setNewModel("");
  };

  const confirmAndDelete = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "platform") await deleteDoc(doc(db, "platforms", confirmDelete.id));
    if (confirmDelete.type === "model")    await deleteDoc(doc(db, "models",    confirmDelete.id));
    setConfirmDelete(null);
  };

  const defaultPlatforms = ["Reddit","Twitter/X","TikTok","Instagram","Telegram","Discord","Facebook","YouTube","OnlyFans","Snapchat"];

  const inputStyle = { background: t.bgInput, color: t.text, border: `1px solid ${t.borderInput}`, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", outline: "none", fontFamily: "inherit", flex: 1 };

  return (
    <div>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: t.text, marginBottom: "4px" }}>Настройки</h1>
        <p style={{ color: t.textMuted, fontSize: "14px" }}>Управление агентством</p>
      </div>

      {/* Confirm delete modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: t.bgSecondary, border: "1px solid rgba(239,68,68,0.3)", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "360px", textAlign: "center" }}>
              <AlertTriangle size={36} style={{ color: "#ef4444", marginBottom: "12px" }} />
              <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>Удалить?</h3>
              <p style={{ color: t.textMuted, fontSize: "14px", marginBottom: "20px", lineHeight: "1.5" }}>
                Вы точно хотите удалить <strong style={{ color: t.text }}>{confirmDelete.name}</strong>?<br />
                Это действие нельзя отменить.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={confirmAndDelete}
                  style={{ flex: 1, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: "10px", padding: "11px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                  Да, удалить
                </button>
                <button onClick={() => setConfirmDelete(null)}
                  style={{ flex: 1, background: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "10px", padding: "11px", cursor: "pointer" }}>
                  Отмена
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", background: t.bgCard, borderRadius: "12px", padding: "4px", marginBottom: "28px", width: "fit-content", border: `1px solid ${t.border}` }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 18px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, transition: "all 0.2s", background: activeTab === id ? "rgba(124,58,237,0.2)" : "transparent", color: activeTab === id ? "#a78bfa" : t.textMuted }}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* Platforms */}
      {activeTab === "platforms" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "24px", marginBottom: "20px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "16px" }}>Добавить платформу</h3>
            <div style={{ display: "flex", gap: "10px" }}>
              <input placeholder="Название платформы..." value={newPlatform} onChange={e => setNewPlatform(e.target.value)} onKeyDown={e => e.key === "Enter" && addPlatform()} style={inputStyle} />
              <button onClick={addPlatform}
                style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}>
                <Plus size={16} />Добавить
              </button>
            </div>
          </div>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "24px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "16px" }}>Стандартные платформы</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
              {defaultPlatforms.map(p => (
                <div key={p} style={{ padding: "6px 14px", background: t.bgCardHover, border: `1px solid ${t.border}`, borderRadius: "20px", color: t.textMuted, fontSize: "13px" }}>{p}</div>
              ))}
            </div>
            {platforms.length > 0 && (
              <>
                <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "16px" }}>Кастомные платформы</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {platforms.map((p, i) => (
                    <motion.div key={p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: t.bgCardHover, borderRadius: "10px", border: `1px solid ${t.border}` }}>
                      <span style={{ color: t.text, fontSize: "14px" }}>{p.name}</span>
                      {isAdmin && (
                        <button onClick={() => setConfirmDelete({ type: "platform", id: p.id, name: p.name })}
                          style={{ background: "rgba(239,68,68,0.1)", border: "none", color: "#ef4444", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", display: "flex" }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* Models */}
      {activeTab === "models" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "24px", marginBottom: "20px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "16px" }}>Добавить модель</h3>
            <div style={{ display: "flex", gap: "10px" }}>
              <input placeholder="Имя модели..." value={newModel} onChange={e => setNewModel(e.target.value)} onKeyDown={e => e.key === "Enter" && addModel()} style={inputStyle} />
              <button onClick={addModel}
                style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}>
                <Plus size={16} />Добавить
              </button>
            </div>
          </div>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "24px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "16px" }}>Все модели ({models.length})</h3>
            {models.length === 0 ? (
              <div style={{ color: t.textMuted, textAlign: "center", padding: "30px" }}>Нет моделей</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {models.map((m, i) => (
                  <motion.div key={m.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: t.bgCardHover, borderRadius: "10px", border: `1px solid ${t.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "34px", height: "34px", borderRadius: "8px", background: `linear-gradient(135deg, ${m.color || "#7c3aed"}, ${m.color || "#db2777"})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: m.emoji ? "16px" : "14px", fontWeight: 700, color: "#fff" }}>
                        {m.emoji || m.name[0].toUpperCase()}
                      </div>
                      <div>
                        <span style={{ color: t.text, fontSize: "14px", fontWeight: 500 }}>{m.name}</span>
                        {m.note && <div style={{ color: t.textMuted, fontSize: "12px" }}>{m.note}</div>}
                      </div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => setConfirmDelete({ type: "model", id: m.id, name: m.name })}
                        style={{ background: "rgba(239,68,68,0.1)", border: "none", color: "#ef4444", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", display: "flex" }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Appearance */}
      {activeTab === "appearance" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "24px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "20px" }}>Тема оформления</h3>
            <div style={{ display: "flex", gap: "12px" }}>
              {[{ m: "dark", label: "Тёмная", icon: Moon, desc: "Тёмный фон" }, { m: "light", label: "Светлая", icon: Sun, desc: "Светлый фон" }].map(({ m: themeMode, label, icon: Icon, desc }) => (
                <button key={themeMode} onClick={() => themeMode !== mode && toggle()}
                  style={{ flex: 1, padding: "20px", borderRadius: "14px", border: `2px solid ${mode === themeMode ? "#7c3aed" : t.border}`, background: mode === themeMode ? "rgba(124,58,237,0.1)" : t.bgCardHover, cursor: "pointer", textAlign: "center" }}>
                  <Icon size={28} style={{ color: mode === themeMode ? "#7c3aed" : t.textMuted, marginBottom: "10px" }} />
                  <div style={{ color: mode === themeMode ? "#a78bfa" : t.text, fontSize: "15px", fontWeight: 700, marginBottom: "4px" }}>{label}</div>
                  <div style={{ color: t.textMuted, fontSize: "12px" }}>{desc}</div>
                  {mode === themeMode && (
                    <div style={{ marginTop: "10px", background: "rgba(124,58,237,0.2)", color: "#a78bfa", fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", display: "inline-block" }}>Активна</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Account */}
      {activeTab === "account" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "24px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "20px" }}>Мой аккаунт</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px", padding: "16px", background: t.bgCardHover, borderRadius: "12px" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "linear-gradient(135deg, #7c3aed, #db2777)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: 700, color: "#fff" }}>
                {(profile?.name || "?")[0].toUpperCase()}
              </div>
              <div>
                <div style={{ color: t.text, fontSize: "18px", fontWeight: 700 }}>{profile?.name || "—"}</div>
                <div style={{ color: t.textMuted, fontSize: "13px" }}>{user?.email}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[
                { label: "Роль", value: profile?.role || "—" },
                { label: "ID", value: user?.uid?.slice(0, 12) + "..." || "—" },
              ].map((item, i) => (
                <div key={i} style={{ padding: "14px", background: t.bgCardHover, borderRadius: "10px" }}>
                  <div style={{ color: t.textMuted, fontSize: "12px", marginBottom: "4px" }}>{item.label}</div>
                  <div style={{ color: t.text, fontSize: "14px", fontWeight: 500 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "24px", marginTop: "20px" }}>
            <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "12px" }}>Поддержка</h3>
            <p style={{ color: t.textMuted, fontSize: "14px", marginBottom: "16px", lineHeight: "1.6" }}>
              Если возникли проблемы — наша команда готова помочь.
            </p>
            <a href="https://t.me/mars_cd" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(0,136,204,0.15)", border: "1px solid rgba(0,136,204,0.3)", color: "#38bdf8", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, textDecoration: "none" }}>
              ✈️ Написать в Telegram @mars_cd
            </a>
          </div>
        </motion.div>
      )}
      {/* Site management — owner only */}
      {activeTab === "site" && isOwner && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Quick links */}
            <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
              <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "16px" }}>⚡ Быстрые действия</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {[
                  { label: "👥 Управление пользователями", desc: "Создать, удалить, изменить роли", href: "/users" },
                  { label: "🏆 Команды",                   desc: "Создать команды, назначить модели", href: "/teams" },
                  { label: "📊 Admin Panel",               desc: "Статистика, финансы, логи",        href: "/admin" },
                  { label: "📋 Задачи",                    desc: "Все задачи команды",               href: "/tasks" },
                ].map((item, i) => (
                  <a key={i} href={item.href}
                    style={{ display: "block", padding: "14px 16px", background: t.bgCardHover, border: `1px solid ${t.border}`, borderRadius: "12px", textDecoration: "none", cursor: "pointer" }}>
                    <div style={{ color: t.text, fontSize: "13px", fontWeight: 600, marginBottom: "3px" }}>{item.label}</div>
                    <div style={{ color: t.textMuted, fontSize: "12px" }}>{item.desc}</div>
                  </a>
                ))}
              </div>
            </div>

            {/* Permissions guide */}
            <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
              <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "14px" }}>🔐 Система разрешений</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { role: "Owner",    color: "#f59e0b", perms: "Полный доступ ко всему, включая Admin Panel и управление пользователями" },
                  { role: "Admin",    color: "#7c3aed", perms: "Всё кроме Admin Panel. Может менять разрешения чаттерам" },
                  { role: "Team Lead",color: "#10b981", perms: "Видит свою команду и модели. Проверяет отчёты смен" },
                  { role: "Chatter",  color: "#64748b", perms: "Только свои задачи, смены, команда. Без контента и аналитики" },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: "12px", padding: "12px 14px", background: t.bgCardHover, borderRadius: "10px" }}>
                    <span style={{ background: `${r.color}20`, color: r.color, fontSize: "11px", fontWeight: 700, padding: "2px 10px", borderRadius: "20px", flexShrink: 0, height: "fit-content", marginTop: "1px" }}>{r.role}</span>
                    <span style={{ color: t.textMuted, fontSize: "13px", lineHeight: "1.5" }}>{r.perms}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "12px", padding: "12px 14px", background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: "10px" }}>
                <div style={{ color: "#a78bfa", fontSize: "12px" }}>
                  💡 Разрешения каждого пользователя можно настроить индивидуально во вкладке <strong>Пользователи</strong> — нажми кнопку «Права» напротив нужного человека.
                </div>
              </div>
            </div>

            {/* Firebase info */}
            <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "22px" }}>
              <h3 style={{ color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "14px" }}>🔧 Техническая информация</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {[
                  { label: "Firebase проект", value: "jgnn-3d5e4" },
                  { label: "Хостинг",          value: "Vercel (inferyx.org)" },
                  { label: "Версия",            value: "v3.0" },
                  { label: "Поддержка",         value: "@mars_cd в Telegram" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: t.bgCardHover, borderRadius: "8px" }}>
                    <span style={{ color: t.textMuted, fontSize: "13px" }}>{item.label}</span>
                    <span style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

    </div>
  );
}
