import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, deleteDoc } from "firebase/firestore";
import { useAuth, ROLE_COLORS, ROLE_LABELS } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Edit3, X, Plus, Trash2, Send, MessageCircle, FileText, Smile, RotateCcw, Check } from "lucide-react";

const AVATAR_EMOJIS = [
  "😎","🤩","🦊","🐺","🐱","🦁","🐯","🦄","🐸","🤖",
  "👾","🎭","🔥","⚡","🌟","💎","🏆","🎯","🚀","👑",
  "🎪","🎨","🎸","🎮","💀","🧠","👻","🦋","🌈","❄️",
  "🍕","🌴","🎃","🦅","🐉","🌙","☀️","🎲","🃏","🎰",
];

const AVATAR_COLORS = [
  "#7c3aed","#db2777","#0ea5e9","#10b981","#f59e0b",
  "#ef4444","#8b5cf6","#06b6d4","#84cc16","#f97316",
  "#6366f1","#ec4899","#14b8a6","#a855f7","#3b82f6",
];

const BRUSH_COLORS = [
  "#ffffff","#000000","#7c3aed","#db2777","#ef4444",
  "#f59e0b","#10b981","#0ea5e9","#a855f7","#f97316",
  "#06b6d4","#84cc16","#ec4899","#6366f1","#94a3b8",
];

const BRUSH_SIZES = [2, 5, 10, 16, 24];

const BG_PRESETS = [
  { label: "Фиолет", stops: ["#7c3aed", "#db2777"] },
  { label: "Океан",  stops: ["#0ea5e9", "#10b981"] },
  { label: "Закат",  stops: ["#f59e0b", "#ef4444"] },
  { label: "Ночь",   stops: ["#0f172a", "#1e1b4b"] },
  { label: "Розовый",stops: ["#ec4899", "#f97316"] },
  { label: "Мята",   stops: ["#10b981", "#06b6d4"] },
  { label: "Белый",  stops: ["#ffffff", "#f1f5f9"] },
  { label: "Серый",  stops: ["#334155", "#1e293b"] },
  { label: "Золото", stops: ["#f59e0b", "#84cc16"] },
  { label: "Космос", stops: ["#1e1b4b", "#4c1d95"] },
];

export default function Profile({ userId: propUserId }) {
  const { db, user, profile: myProfile } = useAuth();
  const { theme } = useTheme();
  const t = theme;

  const targetId = propUserId || user?.uid;
  const isMe = targetId === user?.uid;

  const [profileData, setProfileData] = useState(null);
  const [profileDocId, setProfileDocId] = useState(null);
  const [posts, setPosts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [editing, setEditing] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showBannerDraw, setShowBannerDraw] = useState(false);
  const [newPost, setNewPost] = useState({ text: "", emoji: "" });
  const [editForm, setEditForm] = useState({ name: "", telegram: "", note: "", bio: "" });

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(5);
  const [selectedBg, setSelectedBg] = useState(BG_PRESETS[0]);
  const lastPos = useRef(null);

  useEffect(() => {
    if (!targetId) return;
    const unsub = onSnapshot(collection(db, "users"), snap => {
      const found = snap.docs.find(d => d.data().uid === targetId || d.id === targetId);
      if (found) {
        setProfileData(found.data());
        setProfileDocId(found.id);
        setEditForm({ name: found.data().name || "", telegram: found.data().telegram || "", note: found.data().note || "", bio: found.data().bio || "" });
      }
    });
    return () => unsub();
  }, [db, targetId]);

  useEffect(() => {
    if (!targetId) return;
    const unsubs = [
      onSnapshot(query(collection(db, "profile_posts"), where("userId", "==", targetId)),
        snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt?.localeCompare?.(a.createdAt) || 0))),
      onSnapshot(query(collection(db, "entries"), where("userId", "==", targetId)),
        snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db, targetId]);

  // Fill canvas with selected gradient
  const fillCanvasBackground = (canvas, stops) => {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(1, stops[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Init canvas when modal opens
  useEffect(() => {
    if (!showBannerDraw) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (profileData?.bannerDataUrl) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = profileData.bannerDataUrl;
    } else {
      fillCanvasBackground(canvas, selectedBg.stops);
    }
  }, [showBannerDraw]);

  const applyBackground = (preset) => {
    setSelectedBg(preset);
    const canvas = canvasRef.current;
    if (!canvas) return;
    fillCanvasBackground(canvas, preset.stops);
  };

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDraw = (e) => { e.preventDefault(); setIsDrawing(true); lastPos.current = getPos(e, canvasRef.current); };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    fillCanvasBackground(canvas, selectedBg.stops);
  };

  const saveBanner = async () => {
    if (!canvasRef.current || !profileDocId) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    await updateDoc(doc(db, "users", profileDocId), { bannerDataUrl: dataUrl });
    setShowBannerDraw(false);
  };

  const saveProfile = async () => {
    if (!profileDocId) return;
    await updateDoc(doc(db, "users", profileDocId), { name: editForm.name, telegram: editForm.telegram, note: editForm.note, bio: editForm.bio });
    setEditing(false);
  };

  const setAvatar = async (emoji, color) => {
    if (!profileDocId) return;
    await updateDoc(doc(db, "users", profileDocId), { avatarEmoji: emoji, avatarColor: color });
  };

  const addPost = async () => {
    if (!newPost.text.trim()) return;
    try {
      await addDoc(collection(db, "profile_posts"), {
        text: newPost.text.trim(),
        emoji: newPost.emoji,
        userId: user.uid,
        userName: myProfile?.name || "—",
        userRole: myProfile?.role || "",
        createdAt: new Date().toISOString(),
        date: new Date().toLocaleDateString("ru-RU"),
        time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      });
      setNewPost({ text: "", emoji: "" });
      setShowNewPost(false);
    } catch (e) {
      console.error("addPost error:", e);
      alert("Ошибка при публикации: " + e.message);
    }
  };

  const deletePost = async (id) => await deleteDoc(doc(db, "profile_posts", id));

  const roleColor = ROLE_COLORS[profileData?.role] || "#64748b";
  const totalTraffic = entries.reduce((s, e) => s + (e.traffic || 0), 0);
  const avatarColor = profileData?.avatarColor || roleColor;
  const telegramHandle = profileData?.telegram?.replace("@", "");

  if (!profileData) return <div style={{ textAlign: "center", padding: "60px", color: t.textMuted }}>Загрузка...</div>;

  const inputStyle = { background: t.bgInput, color: t.text, border: `1px solid ${t.borderInput}`, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", outline: "none", fontFamily: "inherit", width: "100%" };

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }}>

      {/* Profile card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "20px", overflow: "hidden", marginBottom: "20px" }}>

        {/* Banner */}
        <div style={{ height: "110px", position: "relative", overflow: "hidden" }}>
          {profileData.bannerDataUrl
            ? <img src={profileData.bannerDataUrl} alt="banner" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ height: "100%", background: `linear-gradient(135deg, ${avatarColor}60, #7c3aed30)` }} />
          }
          {isMe && (
            <button onClick={() => setShowBannerDraw(true)}
              style={{ position: "absolute", bottom: "8px", right: "8px", background: "rgba(0,0,0,0.55)", border: "none", color: "#fff", borderRadius: "8px", padding: "5px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer", backdropFilter: "blur(6px)" }}>
              🎨 Нарисовать
            </button>
          )}
        </div>

        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "-44px", marginBottom: "16px" }}>
            <div style={{ position: "relative" }}>
              <motion.div whileHover={isMe ? { scale: 1.05 } : {}} onClick={isMe ? () => setShowAvatarPicker(true) : undefined}
                style={{ width: "82px", height: "82px", borderRadius: "20px", border: `3px solid ${t.bgCard}`, background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}99)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: profileData.avatarEmoji ? "36px" : "28px", fontWeight: 700, color: "#fff", cursor: isMe ? "pointer" : "default" }}>
                {profileData.avatarEmoji || (profileData.name || "?")[0].toUpperCase()}
              </motion.div>
              {isMe && (
                <div style={{ position: "absolute", bottom: -4, right: -4, width: "24px", height: "24px", borderRadius: "50%", background: "#7c3aed", border: `2px solid ${t.bgCard}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Smile size={12} style={{ color: "#fff" }} />
                </div>
              )}
            </div>
            {isMe && !editing && (
              <button onClick={() => setEditing(true)}
                style={{ display: "flex", alignItems: "center", gap: "6px", background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textSecondary, borderRadius: "10px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                <Edit3 size={14} />Редактировать
              </button>
            )}
          </div>

          {!editing ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "6px" }}>
                <h2 style={{ color: t.text, fontSize: "20px", fontWeight: 700 }}>{profileData.name}</h2>
                <div style={{ background: `${roleColor}20`, color: roleColor, fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {ROLE_LABELS[profileData.role]}
                </div>
              </div>
              {profileData.bio && <p style={{ color: t.textSecondary, fontSize: "14px", marginBottom: "12px", lineHeight: "1.6" }}>{profileData.bio}</p>}
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
                {telegramHandle && (
                  <a href={`https://t.me/${telegramHandle}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: "6px", textDecoration: "none", padding: "5px 12px", background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.25)", borderRadius: "20px", transition: "background 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(14,165,233,0.2)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(14,165,233,0.1)"}>
                    <MessageCircle size={13} style={{ color: "#0ea5e9" }} />
                    <span style={{ color: "#0ea5e9", fontSize: "13px", fontWeight: 600 }}>@{telegramHandle}</span>
                  </a>
                )}
                {profileData.note && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <FileText size={13} style={{ color: t.textMuted }} />
                    <span style={{ color: t.textMuted, fontSize: "13px" }}>{profileData.note}</span>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "24px", paddingTop: "16px", borderTop: `1px solid ${t.border}` }}>
                {[{ label: "Записей", value: entries.length }, { label: "Трафик", value: totalTraffic.toLocaleString() }, { label: "Постов", value: posts.length }].map((s, i) => (
                  <div key={i}>
                    <div style={{ color: t.text, fontSize: "20px", fontWeight: 700 }}>{s.value}</div>
                    <div style={{ color: t.textMuted, fontSize: "12px" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div><label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Имя</label><input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={inputStyle} /></div>
              <div><label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>О себе</label><textarea value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} style={{ ...inputStyle, resize: "none" }} rows={2} /></div>
              <div><label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Telegram</label><input value={editForm.telegram} onChange={e => setEditForm({ ...editForm, telegram: e.target.value })} style={inputStyle} placeholder="@username" /></div>
              <div><label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Заметка (видна всем)</label><input value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} style={inputStyle} placeholder="МСК +3, удалёнка..." /></div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={saveProfile} style={{ flex: 1, background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "10px", padding: "11px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Сохранить</button>
                <button onClick={() => setEditing(false)} style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "10px", padding: "11px 16px", cursor: "pointer" }}>Отмена</button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Posts */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 600 }}>Посты</h3>
          {isMe && (
            <button onClick={() => setShowNewPost(!showNewPost)}
              style={{ display: "flex", alignItems: "center", gap: "6px", background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              <Plus size={14} />Написать пост
            </button>
          )}
        </div>
        <AnimatePresence>
          {showNewPost && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "20px", marginBottom: "16px" }}>
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px", alignItems: "center" }}>
                <input placeholder="🎉" value={newPost.emoji} onChange={e => setNewPost({ ...newPost, emoji: e.target.value })} style={{ ...inputStyle, width: "80px" }} maxLength={4} />
                <span style={{ color: t.textFaint, fontSize: "12px" }}>эмодзи (необязательно)</span>
              </div>
              <textarea placeholder="Напиши что-нибудь для команды..." value={newPost.text} onChange={e => setNewPost({ ...newPost, text: e.target.value })}
                rows={3} style={{ ...inputStyle, resize: "none", marginBottom: "12px" }} />
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={addPost} disabled={!newPost.text.trim()}
                  style={{ display: "flex", alignItems: "center", gap: "6px", background: newPost.text.trim() ? "linear-gradient(135deg, #7c3aed, #db2777)" : t.bgCardHover, color: newPost.text.trim() ? "#fff" : t.textMuted, border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: newPost.text.trim() ? "pointer" : "not-allowed" }}>
                  <Send size={14} />Опубликовать
                </button>
                <button onClick={() => setShowNewPost(false)} style={{ background: t.bgCardHover, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "10px", padding: "10px 16px", cursor: "pointer" }}>Отмена</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {posts.length === 0 ? (
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "40px", textAlign: "center" }}>
            <div style={{ fontSize: "28px", marginBottom: "10px" }}>📝</div>
            <div style={{ color: t.textFaint }}>{isMe ? "Напиши свой первый пост!" : "Нет постов"}</div>
          </div>
        ) : posts.map((post, i) => (
          <motion.div key={post.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "18px 20px", marginBottom: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                {post.emoji && <div style={{ fontSize: "26px", marginBottom: "8px" }}>{post.emoji}</div>}
                <p style={{ color: t.text, fontSize: "15px", lineHeight: "1.6", margin: 0 }}>{post.text}</p>
              </div>
              {isMe && (
                <button onClick={() => deletePost(post.id)}
                  style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", padding: "4px", marginLeft: "12px" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                  onMouseLeave={e => e.currentTarget.style.color = t.textFaint}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div style={{ color: t.textFaint, fontSize: "12px", marginTop: "10px" }}>{post.date} в {post.time}</div>
          </motion.div>
        ))}
      </div>

      {/* Avatar picker */}
      <AnimatePresence>
        {showAvatarPicker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: "20px", padding: "24px", width: "100%", maxWidth: "380px", maxHeight: "80vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 600 }}>Аватарка</h3>
                <button onClick={() => setShowAvatarPicker(false)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
              </div>
              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: `linear-gradient(135deg, ${profileData?.avatarColor || avatarColor}, ${profileData?.avatarColor || avatarColor}99)`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "28px", color: "#fff", fontWeight: 700 }}>
                  {profileData?.avatarEmoji || (profileData.name || "?")[0].toUpperCase()}
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ color: t.textMuted, fontSize: "11px", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Эмодзи</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "5px" }}>
                  {AVATAR_EMOJIS.map(emoji => (
                    <motion.button key={emoji} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                      onClick={() => setAvatar(emoji, profileData?.avatarColor || avatarColor)}
                      style={{ background: profileData?.avatarEmoji === emoji ? "rgba(124,58,237,0.25)" : t.bgCard, border: `1.5px solid ${profileData?.avatarEmoji === emoji ? "#7c3aed" : t.border}`, borderRadius: "8px", padding: "6px 2px", fontSize: "18px", cursor: "pointer", lineHeight: 1, textAlign: "center" }}>
                      {emoji}
                    </motion.button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ color: t.textMuted, fontSize: "11px", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Цвет фона</div>
                <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
                  {AVATAR_COLORS.map(color => (
                    <motion.button key={color} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                      onClick={() => setAvatar(profileData?.avatarEmoji || (profileData.name || "?")[0], color)}
                      style={{ width: "28px", height: "28px", borderRadius: "50%", background: color, border: profileData?.avatarColor === color ? "3px solid #a78bfa" : `2px solid ${t.border}`, cursor: "pointer" }} />
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banner drawing */}
      <AnimatePresence>
        {showBannerDraw && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: "20px", padding: "20px", width: "100%", maxWidth: "660px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 600 }}>🎨 Нарисуй шапку</h3>
                <button onClick={() => setShowBannerDraw(false)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
              </div>

              {/* Canvas */}
              <canvas ref={canvasRef} width={620} height={130}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                style={{ width: "100%", height: "auto", borderRadius: "12px", cursor: "crosshair", display: "block", border: `1px solid ${t.border}`, touchAction: "none" }} />

              {/* BG presets */}
              <div style={{ marginTop: "12px", marginBottom: "12px" }}>
                <div style={{ color: t.textMuted, fontSize: "11px", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Фон</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {BG_PRESETS.map(preset => (
                    <button key={preset.label} onClick={() => applyBackground(preset)}
                      style={{ padding: "5px 12px", borderRadius: "20px", border: `1.5px solid ${selectedBg.label === preset.label ? "#7c3aed" : t.border}`, background: `linear-gradient(135deg, ${preset.stops[0]}, ${preset.stops[1]})`, color: preset.stops[0] === "#ffffff" || preset.stops[0] === "#f1f5f9" ? "#000" : "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Brush tools */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                  {BRUSH_COLORS.map(c => (
                    <button key={c} onClick={() => setBrushColor(c)}
                      style={{ width: "22px", height: "22px", borderRadius: "50%", background: c, border: brushColor === c ? "2.5px solid #a78bfa" : `1.5px solid ${t.border}`, cursor: "pointer" }} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                  {BRUSH_SIZES.map(s => (
                    <button key={s} onClick={() => setBrushSize(s)}
                      style={{ width: "28px", height: "28px", borderRadius: "50%", background: brushSize === s ? "rgba(124,58,237,0.2)" : t.bgCard, border: `1.5px solid ${brushSize === s ? "#7c3aed" : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      <div style={{ width: `${Math.min(s, 16)}px`, height: `${Math.min(s, 16)}px`, borderRadius: "50%", background: brushColor }} />
                    </button>
                  ))}
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
                  <button onClick={clearCanvas}
                    style={{ display: "flex", alignItems: "center", gap: "6px", background: t.bgCard, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: "8px", padding: "7px 12px", fontSize: "13px", cursor: "pointer" }}>
                    <RotateCcw size={14} />Очистить
                  </button>
                  <button onClick={saveBanner}
                    style={{ display: "flex", alignItems: "center", gap: "6px", background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "8px", padding: "7px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                    <Check size={14} />Сохранить
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
