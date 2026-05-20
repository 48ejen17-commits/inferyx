import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, addDoc, orderBy, query, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth, ROLE_COLORS, ROLE_LABELS } from "../context/AuthContext";
import { getOnlineStatus, STATUS_COLOR } from "../components/Layout";
import { useTheme } from "../context/ThemeContext";
import { Send, Plus, Hash, Lock, Users, X, Search, Check } from "lucide-react";

const EMOJI = ["👍", "❤️", "😂", "🔥", "💯", "👏", "🎯", "✅"];
const BUBBLE_RADIUS = "12px"; // одинаковое для всех

export default function Chat() {
  const { db, user, profile } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const t = theme;
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [text, setText] = useState("");
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [search, setSearch] = useState("");
  const [newRoom, setNewRoom] = useState({ name: "", type: "public", description: "" });
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  const messagesEndRef = useRef(null);

  const activeRoomRef = useRef(null);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "rooms"), snap => {
        const r = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const accessible = r
          .filter(room =>
            room.type === "public" || room.createdBy === user.uid ||
            (room.members && room.members.includes(user.uid))
          )
          .sort((a, b) => {
            // Sort by last message time descending
            const ta = a.lastMessageAt || a.createdAt || "";
            const tb = b.lastMessageAt || b.createdAt || "";
            return tb.localeCompare(ta);
          });
        setRooms(accessible);
        // Only auto-select first room if nothing is selected yet
        if (!activeRoomRef.current && accessible.length > 0) {
          setActiveRoom(accessible[0]);
          activeRoomRef.current = accessible[0];
        } else if (activeRoomRef.current) {
          // Keep active room data fresh (e.g. lastMessage updated) without switching
          const updated = accessible.find(r => r.id === activeRoomRef.current.id);
          if (updated) {
            setActiveRoom(updated);
            activeRoomRef.current = updated;
          }
        }
      }),
      onSnapshot(collection(db, "users"), snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  useEffect(() => {
    if (!activeRoom) return;
    const q = query(collection(db, "rooms", activeRoom.id, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsub();
  }, [db, activeRoom]);

  const sendMessage = async () => {
    if (!text.trim() || !activeRoom) return;
    await addDoc(collection(db, "rooms", activeRoom.id, "messages"), {
      text: text.trim(), userId: user.uid, userName: profile?.name || "—",
      userRole: profile?.role || "chatter", createdAt: serverTimestamp(),
      date: new Date().toLocaleDateString("ru-RU"),
      time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    });
    await updateDoc(doc(db, "rooms", activeRoom.id), {
      lastMessage: text.trim(), lastMessageAt: new Date().toISOString(),
      lastMessageUser: profile?.name || "—",
    });
    setText("");
  };

  const createRoom = async () => {
    if (!newRoom.name.trim()) return;
    const members = [...selectedMembers, user.uid];
    const r = await addDoc(collection(db, "rooms"), {
      name: newRoom.name.trim(), type: newRoom.type, description: newRoom.description,
      createdBy: user.uid, createdAt: new Date().toISOString(), members,
      memberNames: [profile?.name || "—", ...selectedMembers.map(uid => users.find(u => u.uid === uid)?.name || "—")],
      lastMessage: "", lastMessageAt: "",
    });
    setActiveRoom({ id: r.id, ...newRoom, members });
    activeRoomRef.current = { id: r.id, ...newRoom, members };
    setNewRoom({ name: "", type: "public", description: "" });
    setSelectedMembers([]); setMemberSearch(""); setShowNewRoom(false);
  };

  const toggleMember = (uid) => setSelectedMembers(prev =>
    prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
  );

  const filteredRooms = rooms.filter(r => r.name?.toLowerCase().includes(search.toLowerCase()));
  const filteredUsers = users.filter(u => u.uid !== user.uid &&
    (u.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(memberSearch.toLowerCase()))
  );

  // Группируем сообщения по отправителю
  const groupedMessages = messages.reduce((groups, msg, i) => {
    const prev = messages[i - 1];
    const isSame = prev && prev.userId === msg.userId &&
      msg.createdAt && prev.createdAt &&
      (msg.createdAt?.seconds - prev.createdAt?.seconds) < 120;
    if (!isSame) {
      groups.push({ userId: msg.userId, userName: msg.userName, userRole: msg.userRole, msgs: [msg] });
    } else {
      groups[groups.length - 1].msgs.push(msg);
    }
    return groups;
  }, []);

  const inputStyle = {
    background: t.bgInput, color: t.text, border: `1px solid ${t.borderInput}`,
    borderRadius: "10px", padding: "10px 14px", fontSize: "14px",
    outline: "none", fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 120px)", borderRadius: "16px", overflow: "hidden", border: `1px solid ${t.border}` }}>

      {/* Sidebar */}
      <div style={{ width: "260px", background: t.sidebar, borderRight: `1px solid ${t.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "16px", borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ color: t.text, fontWeight: 700, fontSize: "15px" }}>Чаты</span>
            <button onClick={() => setShowNewRoom(true)}
              style={{ background: "rgba(124,58,237,0.2)", border: "none", color: "#a78bfa", borderRadius: "6px", padding: "5px", cursor: "pointer", display: "flex" }}>
              <Plus size={15} />
            </button>
          </div>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: t.textMuted }} />
            <input placeholder="Поиск чатов..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: "32px", width: "100%", fontSize: "13px" }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {filteredRooms.length === 0 ? (
            <div style={{ color: t.textFaint, fontSize: "13px", textAlign: "center", padding: "30px 16px" }}>
              Нет чатов.<br />Нажми + чтобы создать!
            </div>
          ) : filteredRooms.map(room => (
            <motion.button key={room.id} onClick={() => { setActiveRoom(room); activeRoomRef.current = room; }} whileHover={{ x: 2 }}
              style={{ width: "100%", background: activeRoom?.id === room.id ? "rgba(124,58,237,0.15)" : "transparent", border: "none", borderRadius: "10px", padding: "10px 12px", cursor: "pointer", textAlign: "left", marginBottom: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: activeRoom?.id === room.id ? "rgba(124,58,237,0.3)" : t.bgCardHover, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {room.type === "private" ? <Lock size={15} style={{ color: "#f59e0b" }} /> : <Hash size={15} style={{ color: "#7c3aed" }} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ color: activeRoom?.id === room.id ? t.text : t.textSecondary, fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{room.name}</div>
                    {room.lastMessageAt && (
                      <div style={{ color: t.textFaint, fontSize: "10px", flexShrink: 0, marginLeft: "6px" }}>
                        {new Date(room.lastMessageAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                  <div style={{ color: t.textFaint, fontSize: "11px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {room.lastMessage ? `${room.lastMessageUser}: ${room.lastMessage}` : "Нет сообщений"}
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        <div style={{ padding: "12px", borderTop: `1px solid ${t.border}` }}>
          <div style={{ color: t.textFaint, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
            Команда ({users.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {users.slice(0, 5).map(u => (
              <div key={u.id}
                onClick={() => navigate(`/profile/${u.uid || u.id}`)}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 6px", borderRadius: "8px", cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = t.bgCardHover}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: `linear-gradient(135deg, ${ROLE_COLORS[u.role]}, ${ROLE_COLORS[u.role]}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#fff" }}>
                    {u.avatarEmoji || (u.name || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ position: "absolute", bottom: -1, right: -1, width: "8px", height: "8px", borderRadius: "50%", background: STATUS_COLOR[getOnlineStatus(u)], border: `1.5px solid ${t.bg}` }} />
                </div>
                <span style={{ color: t.textMuted, fontSize: "12px", flex: 1 }}>{u.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat area */}
      {activeRoom ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: t.bg }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: "12px", background: t.topbar }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {activeRoom.type === "private" ? <Lock size={16} style={{ color: "#f59e0b" }} /> : <Hash size={16} style={{ color: "#7c3aed" }} />}
            </div>
            <div>
              <div style={{ color: t.text, fontWeight: 600, fontSize: "15px" }}>{activeRoom.name}</div>
              <div style={{ color: t.textMuted, fontSize: "12px" }}>
                {activeRoom.type === "private" ? `${activeRoom.members?.length || 0} участников · приватный` : activeRoom.description || "публичный канал"}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            {groupedMessages.length === 0 ? (
              <div style={{ textAlign: "center", color: t.textFaint, padding: "60px 20px" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>💬</div>
                <div style={{ fontSize: "15px", fontWeight: 600, color: t.textMuted }}>Начни общение!</div>
              </div>
            ) : groupedMessages.map((group, gi) => {
              const isMe = group.userId === user.uid;
              const roleColor = ROLE_COLORS[group.userRole] || "#64748b";
              return (
                <div key={gi} style={{ display: "flex", gap: "10px", flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-start" }}>
                  {/* Аватар */}
                  {!isMe && (
                    <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: `linear-gradient(135deg, ${roleColor}, ${roleColor}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "#fff", flexShrink: 0, marginTop: "20px" }}>
                      {group.userName?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}

                  <div style={{ maxWidth: "60%", display: "flex", flexDirection: "column", gap: "4px", alignItems: isMe ? "flex-end" : "flex-start" }}>
                    {/* Имя */}
                    {!isMe && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                        <span onClick={() => navigate(`/profile/${group.userId}`)}
                          style={{ color: roleColor, fontSize: "12px", fontWeight: 700, cursor: "pointer", textDecoration: "none" }}
                          onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                          onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                          {group.userName}
                        </span>
                        <span style={{ color: t.textFaint, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{ROLE_LABELS[group.userRole] || group.userRole}</span>
                      </div>
                    )}

                    {/* Пузыри — одинаковое закругление у всех */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: isMe ? "flex-end" : "flex-start" }}>
                      {group.msgs.map((msg) => (
                        <div key={msg.id} style={{
                          background: isMe ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : t.bgCard,
                          color: isMe ? "#fff" : t.text,
                          padding: "10px 14px",
                          borderRadius: BUBBLE_RADIUS,
                          fontSize: "14px",
                          lineHeight: "1.5",
                          wordBreak: "break-word",
                          border: isMe ? "none" : `1px solid ${t.border}`,
                          maxWidth: "100%",
                        }}>
                          {msg.text}
                        </div>
                      ))}
                    </div>

                    <div style={{ color: t.textFaint, fontSize: "11px" }}>
                      {group.msgs[group.msgs.length - 1].time}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: "16px 20px", borderTop: `1px solid ${t.border}`, background: t.topbar }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <textarea value={text} onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Сообщение..." rows={1}
                  style={{ ...inputStyle, width: "100%", paddingRight: "130px", minHeight: "44px", maxHeight: "120px", resize: "none" }} />
                <div style={{ position: "absolute", right: "10px", bottom: "10px", display: "flex", gap: "4px" }}>
                  {EMOJI.slice(0, 5).map(e => (
                    <button key={e} onClick={() => setText(prev => prev + e)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", padding: "1px", opacity: 0.5 }}
                      onMouseEnter={ev => ev.target.style.opacity = 1}
                      onMouseLeave={ev => ev.target.style.opacity = 0.5}>{e}</button>
                  ))}
                </div>
              </div>
              <motion.button onClick={sendMessage} whileTap={{ scale: 0.9 }} disabled={!text.trim()}
                style={{ background: text.trim() ? "linear-gradient(135deg, #7c3aed, #db2777)" : t.bgCard, border: `1px solid ${t.border}`, borderRadius: "10px", padding: "12px", color: text.trim() ? "#fff" : t.textMuted, cursor: text.trim() ? "pointer" : "not-allowed", display: "flex", flexShrink: 0 }}>
                <Send size={18} />
              </motion.button>
            </div>
            <div style={{ color: t.textFaint, fontSize: "11px", marginTop: "6px" }}>Enter — отправить · Shift+Enter — новая строка</div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: t.bg }}>
          <div style={{ textAlign: "center", color: t.textFaint }}>
            <Users size={48} style={{ marginBottom: "16px", opacity: 0.2 }} />
            <div>Выбери чат или создай новый</div>
          </div>
        </div>
      )}

      {/* New room modal */}
      <AnimatePresence>
        {showNewRoom && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "440px", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 600 }}>Новый чат</h3>
                <button onClick={() => { setShowNewRoom(false); setSelectedMembers([]); setMemberSearch(""); }}
                  style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[{ val: "public", label: "Публичный", icon: Hash, desc: "Все видят" }, { val: "private", label: "Приватный", icon: Lock, desc: "Только участники" }].map(({ val, label, icon: Icon, desc }) => (
                    <button key={val} onClick={() => setNewRoom({ ...newRoom, type: val })}
                      style={{ flex: 1, padding: "12px", borderRadius: "10px", border: `1px solid ${newRoom.type === val ? "#7c3aed" : t.border}`, background: newRoom.type === val ? "rgba(124,58,237,0.15)" : t.bgCard, color: newRoom.type === val ? "#a78bfa" : t.textMuted, cursor: "pointer", textAlign: "center" }}>
                      <Icon size={18} style={{ marginBottom: "6px" }} />
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: "11px", opacity: 0.7 }}>{desc}</div>
                    </button>
                  ))}
                </div>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Название чата</label>
                  <input placeholder="general, team-leads..." value={newRoom.name} onChange={e => setNewRoom({ ...newRoom, name: e.target.value })} style={{ ...inputStyle, width: "100%" }} />
                </div>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Описание (необязательно)</label>
                  <input placeholder="О чём этот чат?" value={newRoom.description} onChange={e => setNewRoom({ ...newRoom, description: e.target.value })} style={{ ...inputStyle, width: "100%" }} />
                </div>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "8px" }}>
                    Добавить участников {selectedMembers.length > 0 && <span style={{ color: "#7c3aed" }}>({selectedMembers.length} выбрано)</span>}
                  </label>
                  <div style={{ position: "relative", marginBottom: "8px" }}>
                    <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: t.textMuted }} />
                    <input placeholder="Поиск по имени..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} style={{ ...inputStyle, width: "100%", paddingLeft: "32px" }} />
                  </div>
                  <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {filteredUsers.length === 0 ? (
                      <div style={{ color: t.textMuted, textAlign: "center", padding: "16px", fontSize: "13px" }}>
                        {users.length <= 1 ? "Добавь участников в команду сначала" : "Никого не найдено"}
                      </div>
                    ) : filteredUsers.map(u => {
                      const isSelected = selectedMembers.includes(u.uid);
                      const roleColor = ROLE_COLORS[u.role] || "#64748b";
                      return (
                        <button key={u.id} onClick={() => toggleMember(u.uid)}
                          style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", border: `1px solid ${isSelected ? "#7c3aed" : t.border}`, background: isSelected ? "rgba(124,58,237,0.1)" : t.bgCard, cursor: "pointer", textAlign: "left" }}>
                          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `linear-gradient(135deg, ${roleColor}, ${roleColor}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                            {u.avatarEmoji || (u.name || "?")[0].toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{u.name}</div>
                            <div style={{ color: roleColor, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{ROLE_LABELS[u.role] || u.role}</div>
                          </div>
                          <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: `2px solid ${isSelected ? "#7c3aed" : t.border}`, background: isSelected ? "#7c3aed" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {isSelected && <Check size={12} style={{ color: "#fff" }} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button onClick={createRoom} disabled={!newRoom.name.trim()}
                  style={{ background: newRoom.name.trim() ? "linear-gradient(135deg, #7c3aed, #db2777)" : t.bgCard, color: newRoom.name.trim() ? "#fff" : t.textMuted, border: "none", borderRadius: "10px", padding: "13px", fontSize: "14px", fontWeight: 600, cursor: newRoom.name.trim() ? "pointer" : "not-allowed" }}>
                  Создать чат {selectedMembers.length > 0 ? `с ${selectedMembers.length + 1} участниками` : ""}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
