import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth, ROLES } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  Plus, X, Edit3, Trash2, AlertTriangle, Check,
  ChevronDown, ChevronUp, Lock, Eye, User,
  Heart, MessageCircle, Shield, Star, BookOpen, Smile
} from "lucide-react";

const MODEL_COLORS = [
  "#7c3aed","#db2777","#0ea5e9","#10b981","#f59e0b",
  "#ef4444","#8b5cf6","#06b6d4","#84cc16","#f97316",
];
const MODEL_EMOJIS = ["👤","⭐","🌟","💎","🔥","🎯","👑","🦋","🌸","💫","🎪","🍓","🌙","☀️","🦊"];

// Секции профиля персонажа
const PROFILE_SECTIONS = [
  {
    key: "legend",
    icon: BookOpen,
    label: "Легенда",
    color: "#7c3aed",
    description: "Биография и история персонажа",
    fields: [
      { key: "age",        label: "Возраст",      type: "text",     placeholder: "23" },
      { key: "location",   label: "Локация",       type: "text",     placeholder: "Майами, Флорида" },
      { key: "occupation", label: "Занятие",       type: "text",     placeholder: "Студентка, фитнес-блогер" },
      { key: "background", label: "Биография",     type: "textarea", placeholder: "Откуда, как попала в нишу, история..." },
    ],
  },
  {
    key: "personality",
    icon: Smile,
    label: "Характер",
    color: "#db2777",
    description: "Как общается, какой тон, манера речи",
    fields: [
      { key: "tone",       label: "Тон общения",   type: "text",     placeholder: "Игривый, дерзкий, нежный..." },
      { key: "style",      label: "Стиль речи",    type: "textarea", placeholder: "Как пишет сообщения, какие слова использует..." },
      { key: "traits",     label: "Черты характера",type: "textarea", placeholder: "Открытая, любопытная, саркастичная..." },
    ],
  },
  {
    key: "interests",
    icon: Heart,
    label: "Интересы",
    color: "#0ea5e9",
    description: "Темы для разговоров с подписчиками",
    fields: [
      { key: "hobbies",    label: "Хобби",         type: "textarea", placeholder: "Йога, путешествия, готовка..." },
      { key: "topics",     label: "Любимые темы",  type: "textarea", placeholder: "О чём любит говорить с фанатами..." },
      { key: "dislikes",   label: "Не любит",      type: "textarea", placeholder: "Что не интересно, скучно..." },
    ],
  },
  {
    key: "communication",
    icon: MessageCircle,
    label: "Общение с фанатами",
    color: "#10b981",
    description: "Как вести диалог, что продавать",
    fields: [
      { key: "greeting",   label: "Приветствие",   type: "textarea", placeholder: "Как начинать диалог с новым подписчиком..." },
      { key: "upsell",     label: "Как продавать", type: "textarea", placeholder: "Переходы к PPV, tips, кастом-контенту..." },
      { key: "fanTypes",   label: "Типы фанатов",  type: "textarea", placeholder: "Как работать с китами, с активными, с тихонями..." },
    ],
  },
  {
    key: "allowed",
    icon: Check,
    label: "Можно",
    color: "#10b981",
    description: "Что обсуждать и предлагать",
    fields: [
      { key: "allowedTopics",   label: "Темы",     type: "textarea", placeholder: "Флирт, отношения, фитнес, путешествия..." },
      { key: "allowedContent",  label: "Контент",  type: "textarea", placeholder: "Какой тип контента создаётся..." },
      { key: "allowedRequests", label: "Запросы",  type: "textarea", placeholder: "На какие просьбы фанатов соглашаться..." },
    ],
  },
  {
    key: "taboo",
    icon: Shield,
    label: "Табу",
    color: "#ef4444",
    description: "Что никогда не делать и не обсуждать",
    fields: [
      { key: "tabooTopics",   label: "Темы",       type: "textarea", placeholder: "Реальное имя, локация, личная жизнь..." },
      { key: "tabooContent",  label: "Контент",    type: "textarea", placeholder: "Что никогда не снимается..." },
      { key: "tabooRequests", label: "Запросы",    type: "textarea", placeholder: "На что всегда отказывать..." },
      { key: "redFlags",      label: "Красные флаги", type: "textarea", placeholder: "Подозрительное поведение, стоп-слова..." },
    ],
  },
  {
    key: "accounts",
    icon: Star,
    label: "Аккаунты",
    color: "#f59e0b",
    description: "Ссылки и логины платформ",
    fields: [
      { key: "onlyfans",   label: "OnlyFans",      type: "text",     placeholder: "onlyfans.com/..." },
      { key: "reddit",     label: "Reddit",        type: "text",     placeholder: "u/username" },
      { key: "twitter",    label: "Twitter/X",     type: "text",     placeholder: "@handle" },
      { key: "instagram",  label: "Instagram",     type: "text",     placeholder: "@handle" },
      { key: "other",      label: "Другие",        type: "textarea", placeholder: "TikTok, Telegram, Discord..." },
    ],
  },
];

// ── TagInput — список пунктов через Enter ─────────────────────────────────────
function TagInput({ value, onChange, placeholder }) {
  const [input, setInput] = useState("");
  const items = value ? value.split("\n").filter(Boolean) : [];

  const add = () => {
    if (!input.trim()) return;
    onChange([...items, input.trim()].join("\n"));
    setInput("");
  };

  const remove = (i) => {
    const next = items.filter((_, idx) => idx !== i);
    onChange(next.join("\n"));
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
          style={{ flex: 1, background: "rgba(255,255,255,0.05)", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit" }} />
        <button onClick={add} style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", color: "#a78bfa", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontSize: "13px" }}>+ Добавить</button>
      </div>
      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "20px", padding: "4px 10px" }}>
              <span style={{ color: "#c4b5fd", fontSize: "12px" }}>{item}</span>
              <button onClick={() => remove(i)} style={{ background: "none", border: "none", color: "#6d28d9", cursor: "pointer", padding: 0, lineHeight: 1 }}><X size={11} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Model Profile Card ─────────────────────────────────────────────────────────
function ModelProfileCard({ model, entries, canEdit, onEdit, onDelete, t }) {
  const [expanded, setExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState("legend");

  const color = model.color || "#7c3aed";
  const totalPosts = entries.filter(e => e.model === model.name).length;
  const todayStr = new Date().toLocaleDateString("ru-RU");
  const todayPosts = entries.filter(e => e.model === model.name && e.date === todayStr).length;
  const isActive = model.status !== "inactive";
  const profile = model.profile || {};

  const currentSection = PROFILE_SECTIONS.find(s => s.key === activeSection);

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "20px", overflow: "hidden", opacity: isActive ? 1 : 0.6 }}>

      {/* Header */}
      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Avatar */}
          <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: `linear-gradient(135deg, ${color}, ${color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", flexShrink: 0, boxShadow: `0 4px 14px ${color}40` }}>
            {model.emoji || model.name[0]}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h3 style={{ color: t.text, fontSize: "17px", fontWeight: 700 }}>{model.name}</h3>
              <span style={{ background: isActive ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.12)", color: isActive ? "#10b981" : "#64748b", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px" }}>
                {isActive ? "Активна" : "Неактивна"}
              </span>
            </div>
            {model.note && <p style={{ color: t.textMuted, fontSize: "13px", marginTop: "3px" }}>{model.note}</p>}
            <div style={{ display: "flex", gap: "14px", marginTop: "8px" }}>
              <span style={{ color: t.textFaint, fontSize: "12px" }}>📊 {totalPosts} записей</span>
              <span style={{ color: todayPosts > 0 ? "#10b981" : t.textFaint, fontSize: "12px" }}>✅ {todayPosts} сегодня</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            <button onClick={() => setExpanded(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: "6px", background: expanded ? `${color}20` : t.bgCardHover, border: `1px solid ${expanded ? color + "40" : t.border}`, color: expanded ? color : t.textMuted, borderRadius: "10px", padding: "8px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              <Eye size={14} />
              {expanded ? "Скрыть" : "Профиль"}
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {canEdit && (
              <>
                <button onClick={() => onEdit(model)} style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "10px", padding: "8px 10px", cursor: "pointer" }}><Edit3 size={14} /></button>
                <button onClick={() => onDelete(model)} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444", borderRadius: "10px", padding: "8px 10px", cursor: "pointer" }}><Trash2 size={14} /></button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Profile panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
            style={{ borderTop: `1px solid ${t.border}`, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr" }}>

              {/* Section nav */}
              <div style={{ borderRight: `1px solid ${t.border}`, padding: "12px" }}>
                {PROFILE_SECTIONS.map(sec => {
                  const Icon = sec.icon;
                  const isActive = activeSection === sec.key;
                  const hasData = sec.fields.some(f => profile[sec.key]?.[f.key]);
                  return (
                    <button key={sec.key} onClick={() => setActiveSection(sec.key)}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", borderRadius: "10px", border: "none", cursor: "pointer", background: isActive ? `${sec.color}18` : "transparent", marginBottom: "3px", textAlign: "left" }}>
                      <Icon size={14} style={{ color: isActive ? sec.color : t.textMuted, flexShrink: 0 }} />
                      <span style={{ color: isActive ? sec.color : t.textMuted, fontSize: "13px", fontWeight: isActive ? 700 : 500, flex: 1 }}>{sec.label}</span>
                      {hasData && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: sec.color, flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>

              {/* Section content */}
              <div style={{ padding: "20px 24px" }}>
                {currentSection && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: `${currentSection.color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <currentSection.icon size={14} style={{ color: currentSection.color }} />
                      </div>
                      <div>
                        <div style={{ color: t.text, fontSize: "14px", fontWeight: 700 }}>{currentSection.label}</div>
                        <div style={{ color: t.textFaint, fontSize: "11px" }}>{currentSection.description}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      {currentSection.fields.map(field => {
                        const val = profile[currentSection.key]?.[field.key] || "";
                        if (!val) return (
                          <div key={field.key}>
                            <div style={{ color: t.textFaint, fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>{field.label}</div>
                            <div style={{ color: t.textFaint, fontSize: "13px", fontStyle: "italic" }}>— не заполнено</div>
                          </div>
                        );
                        // Tag-style display
                        const items = val.split("\n").filter(Boolean);
                        return (
                          <div key={field.key}>
                            <div style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{field.label}</div>
                            {items.length > 1 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {items.map((item, i) => (
                                  <span key={i} style={{ background: `${currentSection.color}15`, border: `1px solid ${currentSection.color}30`, color: t.textSecondary || t.textMuted, fontSize: "12px", padding: "4px 10px", borderRadius: "20px" }}>{item}</span>
                                ))}
                              </div>
                            ) : (
                              <p style={{ color: t.textSecondary || t.textMuted, fontSize: "13px", lineHeight: "1.6", margin: 0 }}>{val}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Edit Profile Modal ─────────────────────────────────────────────────────────
function EditProfileModal({ model, onSave, onClose, t }) {
  const [form, setForm] = useState({
    name: model?.name || "",
    note: model?.note || "",
    color: model?.color || MODEL_COLORS[0],
    emoji: model?.emoji || MODEL_EMOJIS[0],
    status: model?.status || "active",
  });
  const [profileData, setProfileData] = useState(model?.profile || {});
  const [activeSection, setActiveSection] = useState("legend");
  const [saving, setSaving] = useState(false);

  const setField = (section, key, val) => {
    setProfileData(prev => ({
      ...prev,
      [section]: { ...(prev[section] || {}), [key]: val },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...form, profile: profileData });
    setSaving(false);
  };

  const currentSection = PROFILE_SECTIONS.find(s => s.key === activeSection);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ background: t.bgSecondary || t.bgCard, border: `1px solid ${t.border}`, borderRadius: "22px", width: "100%", maxWidth: "780px", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>

        {/* Modal header */}
        <div style={{ padding: "22px 28px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <h2 style={{ color: t.text, fontSize: "18px", fontWeight: 700 }}>
            {model ? "Редактировать модель" : "Новая модель"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", flex: 1, overflow: "hidden" }}>

          {/* Left nav */}
          <div style={{ borderRight: `1px solid ${t.border}`, padding: "16px", overflowY: "auto" }}>
            {/* Basic info */}
            <div style={{ marginBottom: "8px" }}>
              <button onClick={() => setActiveSection("_basic")}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", borderRadius: "10px", border: "none", cursor: "pointer", background: activeSection === "_basic" ? "rgba(124,58,237,0.15)" : "transparent", textAlign: "left", marginBottom: "3px" }}>
                <User size={14} style={{ color: activeSection === "_basic" ? "#7c3aed" : t.textMuted }} />
                <span style={{ color: activeSection === "_basic" ? "#a78bfa" : t.textMuted, fontSize: "13px", fontWeight: activeSection === "_basic" ? 700 : 500 }}>Основное</span>
              </button>
            </div>

            <div style={{ color: t.textFaint, fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", padding: "4px 12px", marginBottom: "4px" }}>Профиль персонажа</div>

            {PROFILE_SECTIONS.map(sec => {
              const Icon = sec.icon;
              const isAct = activeSection === sec.key;
              return (
                <button key={sec.key} onClick={() => setActiveSection(sec.key)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", borderRadius: "10px", border: "none", cursor: "pointer", background: isAct ? `${sec.color}15` : "transparent", marginBottom: "3px", textAlign: "left" }}>
                  <Icon size={14} style={{ color: isAct ? sec.color : t.textMuted }} />
                  <span style={{ color: isAct ? sec.color : t.textMuted, fontSize: "13px", fontWeight: isAct ? 700 : 500 }}>{sec.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right content */}
          <div style={{ overflowY: "auto", padding: "24px 28px" }}>
            {activeSection === "_basic" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Имя модели</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Имя..." style={{ width: "100%", background: t.bgInput, color: t.text, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", outline: "none", fontFamily: "inherit" }} />
                </div>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Заметка</label>
                  <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                    placeholder="Короткое описание..." style={{ width: "100%", background: t.bgInput, color: t.text, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", outline: "none", fontFamily: "inherit" }} />
                </div>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Статус</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[{ v: "active", l: "Активна" }, { v: "inactive", l: "Неактивна" }].map(opt => (
                      <button key={opt.v} onClick={() => setForm({ ...form, status: opt.v })}
                        style={{ flex: 1, padding: "10px", borderRadius: "10px", border: `1px solid ${form.status === opt.v ? "#7c3aed" : t.border}`, background: form.status === opt.v ? "rgba(124,58,237,0.15)" : t.bgCard, color: form.status === opt.v ? "#a78bfa" : t.textMuted, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Цвет</label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {MODEL_COLORS.map(c => (
                      <button key={c} onClick={() => setForm({ ...form, color: c })}
                        style={{ width: "30px", height: "30px", borderRadius: "50%", background: c, border: form.color === c ? "3px solid #fff" : "2px solid transparent", cursor: "pointer" }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Эмодзи</label>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {MODEL_EMOJIS.map(e => (
                      <button key={e} onClick={() => setForm({ ...form, emoji: e })}
                        style={{ width: "38px", height: "38px", borderRadius: "8px", fontSize: "20px", border: `2px solid ${form.emoji === e ? "#7c3aed" : t.border}`, background: form.emoji === e ? "rgba(124,58,237,0.15)" : t.bgCard, cursor: "pointer" }}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : currentSection ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: `${currentSection.color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <currentSection.icon size={16} style={{ color: currentSection.color }} />
                  </div>
                  <div>
                    <div style={{ color: t.text, fontSize: "15px", fontWeight: 700 }}>{currentSection.label}</div>
                    <div style={{ color: t.textFaint, fontSize: "12px" }}>{currentSection.description}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {currentSection.fields.map(field => (
                    <div key={field.key}>
                      <label style={{ color: t.textMuted, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{field.label}</label>
                      <TagInput
                        value={profileData[currentSection.key]?.[field.key] || ""}
                        onChange={val => setField(currentSection.key, field.key, val)}
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 28px", borderTop: `1px solid ${t.border}`, display: "flex", gap: "10px", flexShrink: 0 }}>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            style={{ flex: 1, background: !form.name.trim() ? "rgba(124,58,237,0.3)" : "linear-gradient(135deg, #7c3aed, #db2877)", color: "#fff", border: "none", borderRadius: "12px", padding: "13px", fontSize: "15px", fontWeight: 700, cursor: form.name.trim() ? "pointer" : "not-allowed" }}>
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
          <button onClick={onClose} style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "12px", padding: "13px 20px", cursor: "pointer", fontSize: "14px" }}>Отмена</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Models() {
  const { db, profile } = useAuth();
  const { theme } = useTheme();
  const t = theme;

  const [models,  setModels]  = useState([]);
  const [entries, setEntries] = useState([]);
  const [teams,   setTeams]   = useState([]);
  const [editTarget,    setEditTarget]    = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const canEdit = [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_LEAD].includes(profile?.role);
  const isTeamLead = profile?.role === ROLES.TEAM_LEAD;
  const isChatter  = profile?.role === ROLES.CHATTER;

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "models"), snap => setModels(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "entries"), snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "teams"),  snap => setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  // Models visible to current user based on team membership
  const visibleModels = (() => {
    if (!isTeamLead && !isChatter) return models; // owner/admin/pm see all
    // Find teams this user belongs to
    const myTeams = teams.filter(tm => (tm.memberIds || []).includes(profile?.uid));
    const allowedModelIds = new Set(myTeams.flatMap(tm => tm.modelIds || []));
    return models.filter(m => allowedModelIds.has(m.id));
  })();

  const saveModel = async (form) => {
    if (editTarget && editTarget !== "new") {
      await updateDoc(doc(db, "models", editTarget.id), {
        name: form.name, note: form.note, color: form.color,
        emoji: form.emoji, status: form.status, profile: form.profile,
      });
    } else {
      await addDoc(collection(db, "models"), {
        name: form.name, note: form.note, color: form.color,
        emoji: form.emoji, status: form.status, profile: form.profile || {},
        createdAt: new Date().toISOString(),
      });
    }
    setEditTarget(null);
  };

  const deleteModel = async () => {
    if (!confirmDelete) return;
    await deleteDoc(doc(db, "models", confirmDelete.id));
    setConfirmDelete(null);
  };

  const active   = visibleModels.filter(m => m.status !== "inactive");
  const inactive = visibleModels.filter(m => m.status === "inactive");

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: t.text, marginBottom: "6px" }}>Модели</h1>
          <p style={{ color: t.textMuted, fontSize: "14px" }}>{active.length} активных · {inactive.length} неактивных</p>
        </div>
        {canEdit && (
          <button onClick={() => setEditTarget("new")}
            style={{ display: "flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg, #7c3aed, #db2877)", color: "#fff", border: "none", borderRadius: "12px", padding: "11px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
            <Plus size={16} />Новая модель
          </button>
        )}
      </motion.div>

      {!canEdit && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "12px", padding: "12px 16px", marginBottom: "20px" }}>
          <Lock size={14} style={{ color: "#a78bfa" }} />
          <span style={{ color: "#a78bfa", fontSize: "13px" }}>Редактировать профили могут только Тимлид, Админ и Овнер. Ты видишь информацию для работы.</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {visibleModels.length === 0 ? (
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "20px", padding: "60px", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "14px" }}>👤</div>
            <p style={{ color: t.textMuted }}>Нет моделей. {canEdit ? "Создай первую!" : ""}</p>
          </div>
        ) : visibleModels.map(model => (
          <ModelProfileCard key={model.id} model={model} entries={entries} canEdit={canEdit}
            onEdit={m => setEditTarget(m)} onDelete={m => setConfirmDelete(m)} t={t} />
        ))}
      </div>

      {/* Edit/New modal */}
      <AnimatePresence>
        {editTarget && (
          <EditProfileModal
            model={editTarget === "new" ? null : editTarget}
            onSave={saveModel}
            onClose={() => setEditTarget(null)}
            t={t}
          />
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setConfirmDelete(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: t.bgSecondary || t.bgCard, border: "1px solid rgba(239,68,68,0.3)", borderRadius: "20px", padding: "28px", maxWidth: "400px", width: "100%", textAlign: "center" }}>
              <AlertTriangle size={36} style={{ color: "#ef4444", marginBottom: "14px" }} />
              <h3 style={{ color: t.text, fontSize: "17px", fontWeight: 700, marginBottom: "8px" }}>Удалить модель?</h3>
              <p style={{ color: t.textMuted, fontSize: "14px", marginBottom: "22px" }}>
                «{confirmDelete.name}» будет удалена безвозвратно вместе с профилем персонажа.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={deleteModel} style={{ flex: 1, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: "12px", padding: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Удалить</button>
                <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "12px", padding: "12px", cursor: "pointer" }}>Отмена</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
