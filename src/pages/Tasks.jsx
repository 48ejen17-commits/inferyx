import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth, ROLES, ROLE_COLORS, ROLE_LABELS_DISPLAY } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Plus, X, Trash2, Calendar, User, Flag, ChevronDown, Circle, CheckCircle2, Clock, AlertCircle, Grip } from "lucide-react";

const COLUMNS = [
  { id: "todo", label: "К выполнению", color: "#64748b", emoji: "📋" },
  { id: "inprogress", label: "В работе", color: "#0ea5e9", emoji: "⚡" },
  { id: "review", label: "На проверке", color: "#f59e0b", emoji: "👀" },
  { id: "done", label: "Готово", color: "#10b981", emoji: "✅" },
];

const PRIORITIES = [
  { val: "low", label: "Низкий", color: "#64748b", icon: "🔵" },
  { val: "medium", label: "Средний", color: "#f59e0b", icon: "🟡" },
  { val: "high", label: "Высокий", color: "#ef4444", icon: "🔴" },
  { val: "urgent", label: "Срочно", color: "#7c3aed", icon: "🚨" },
];

const getPriority = (val) => PRIORITIES.find(p => p.val === val) || PRIORITIES[1];

export default function Tasks() {
  const { db, user, profile } = useAuth();
  const { theme } = useTheme();
  const t = theme;

  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium",
    assigneeId: "", assigneeName: "", dueDate: "", column: "todo", tags: ""
  });

  const isChatter  = profile?.role === ROLES.CHATTER;
  const isTeamLead = profile?.role === ROLES.TEAM_LEAD;
  const canManage  = [ROLES.OWNER, ROLES.ADMIN].includes(profile?.role);

  // Teams for scoping
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "tasks"), snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "users"), snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "teams"), snap => setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  // My team member IDs (for chatter/team_lead)
  const myTeamMemberIds = (isChatter || isTeamLead)
    ? new Set(teams.filter(tm => (tm.memberIds || []).includes(profile?.uid)).flatMap(tm => tm.memberIds || []))
    : null;

  // Users chatter can assign tasks to (only themselves)
  const assignableUsers = isChatter
    ? users.filter(u => u.uid === profile?.uid || u.id === profile?.uid)
    : isTeamLead
    ? users.filter(u => myTeamMemberIds?.has(u.uid || u.id))
    : users;

  const addTask = async () => {
    if (!form.title.trim()) return;
    // Chatter can only assign to themselves
    const assigneeId = isChatter ? (profile?.uid || "") : form.assigneeId;
    const assignee   = users.find(u => u.id === assigneeId || u.uid === assigneeId);
    await addDoc(collection(db, "tasks"), {
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      assigneeId,
      assigneeName: isChatter ? profile?.name : (assignee?.name || "—"),
      assigneeRole: isChatter ? profile?.role : (assignee?.role || ""),
      dueDate: form.dueDate,
      column: form.column,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      createdBy: user.uid,
      createdByName: profile?.name || "—",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setForm({ title: "", description: "", priority: "medium", assigneeId: "", assigneeName: "", dueDate: "", column: "todo", tags: "" });
    setShowForm(false);
  };

  const moveTask = async (taskId, newColumn) => {
    await updateDoc(doc(db, "tasks", taskId), { column: newColumn, updatedAt: new Date().toISOString() });
  };

  const deleteTask = async (taskId) => {
    await deleteDoc(doc(db, "tasks", taskId));
    setSelectedTask(null);
  };

  const updateTask = async (taskId, updates) => {
    await updateDoc(doc(db, "tasks", taskId), { ...updates, updatedAt: new Date().toISOString() });
  };

  const handleDrop = async (e, columnId) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) await moveTask(taskId, columnId);
    setDragOver(null);
  };

  const isOverdue = (dueDate) => dueDate && new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
  const isDueToday = (dueDate) => dueDate && new Date(dueDate).toDateString() === new Date().toDateString();

  const filteredTasks = tasks
    .filter(task => {
      // Chatter: only tasks assigned to them or created by them
      if (isChatter) {
        const myUid = profile?.uid;
        return task.assigneeId === myUid || task.createdBy === myUid;
      }
      // TeamLead: only tasks within their team
      if (isTeamLead && myTeamMemberIds) {
        return myTeamMemberIds.has(task.assigneeId) || myTeamMemberIds.has(task.createdBy);
      }
      return true;
    })
    .filter(task =>
      (filterAssignee === "all" || task.assigneeId === filterAssignee) &&
      (filterPriority === "all" || task.priority === filterPriority)
    );

  const getColumnTasks = (colId) => filteredTasks.filter(t => t.column === colId);

  // Progress based on visible tasks only (not all tasks)
  const totalDone  = filteredTasks.filter(t => t.column === "done").length;
  const totalTasks = filteredTasks.length;

  const inputStyle = { background: t.bgInput, color: t.text, border: `1px solid ${t.borderInput}`, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", outline: "none", fontFamily: "inherit", width: "100%" };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: t.text, marginBottom: "4px" }}>Задачи</h1>
          <p style={{ color: t.textMuted, fontSize: "14px" }}>
            {totalDone}/{totalTasks} выполнено
            {totalTasks > 0 && <span style={{ color: "#10b981", marginLeft: "8px" }}>· {Math.round((totalDone / totalTasks) * 100)}%</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Filters */}
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
            style={{ background: t.bgCard, color: t.text, border: `1px solid ${t.border}`, borderRadius: "8px", padding: "8px 12px", fontSize: "13px", outline: "none" }}>
            <option value="all">Все исполнители</option>
            {assignableUsers.map(u => <option key={u.id} value={u.uid || u.id}>{u.name}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            style={{ background: t.bgCard, color: t.text, border: `1px solid ${t.border}`, borderRadius: "8px", padding: "8px 12px", fontSize: "13px", outline: "none" }}>
            <option value="all">Все приоритеты</option>
            {PRIORITIES.map(p => <option key={p.val} value={p.val}>{p.icon} {p.label}</option>)}
          </select>
          {canManage && (
            <button onClick={() => setShowForm(true)}
              style={{ display: "flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg, #7c3aed, #db2777)", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
              <Plus size={16} />Новая задача
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {totalTasks > 0 && (
        <div style={{ height: "4px", background: t.border, borderRadius: "2px", marginBottom: "24px" }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${(totalDone / totalTasks) * 100}%` }} transition={{ duration: 0.6 }}
            style={{ height: "100%", borderRadius: "2px", background: "linear-gradient(90deg, #7c3aed, #10b981)" }} />
        </div>
      )}

      {/* Kanban board */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", alignItems: "start" }}>
        {COLUMNS.map(col => {
          const colTasks = getColumnTasks(col.id);
          const isDragTarget = dragOver === col.id;
          return (
            <div key={col.id}
              onDragOver={e => { e.preventDefault(); setDragOver(col.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, col.id)}
              style={{ background: isDragTarget ? `${col.color}10` : t.bgCard, border: `1px solid ${isDragTarget ? col.color : t.border}`, borderRadius: "16px", padding: "16px", minHeight: "200px", transition: "all 0.2s" }}>

              {/* Column header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>{col.emoji}</span>
                  <span style={{ color: t.text, fontSize: "13px", fontWeight: 700 }}>{col.label}</span>
                  <span style={{ background: `${col.color}20`, color: col.color, fontSize: "11px", fontWeight: 700, padding: "2px 7px", borderRadius: "10px" }}>
                    {colTasks.length}
                  </span>
                </div>
                {canManage && (
                  <button onClick={() => { setForm({ ...form, column: col.id }); setShowForm(true); }}
                    style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", display: "flex", padding: "2px" }}
                    onMouseEnter={e => e.currentTarget.style.color = col.color}
                    onMouseLeave={e => e.currentTarget.style.color = t.textFaint}>
                    <Plus size={16} />
                  </button>
                )}
              </div>

              {/* Tasks */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {colTasks.length === 0 && (
                  <div style={{ textAlign: "center", color: t.textFaint, padding: "20px 0", fontSize: "13px" }}>
                    Нет задач
                  </div>
                )}
                {colTasks.map((task, i) => {
                  const priority = getPriority(task.priority);
                  const overdue = isOverdue(task.dueDate);
                  const dueToday = isDueToday(task.dueDate);
                  const assigneeColor = ROLE_COLORS[task.assigneeRole] || "#64748b";

                  return (
                    <motion.div key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      draggable
                      onDragStart={e => e.dataTransfer.setData("taskId", task.id)}
                      onClick={() => setSelectedTask(task)}
                      whileHover={{ scale: 1.01, y: -1 }}
                      style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: "12px", padding: "12px", cursor: "pointer", position: "relative", overflow: "hidden" }}>

                      {/* Priority stripe */}
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: priority.color }} />

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <span style={{ color: t.text, fontSize: "13px", fontWeight: 600, lineHeight: "1.4", flex: 1, paddingRight: "8px" }}>{task.title}</span>
                        <span style={{ fontSize: "14px", flexShrink: 0 }}>{priority.icon}</span>
                      </div>

                      {task.description && (
                        <p style={{ color: t.textMuted, fontSize: "12px", marginBottom: "10px", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {task.description}
                        </p>
                      )}

                      {/* Tags */}
                      {task.tags?.length > 0 && (
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "8px" }}>
                          {task.tags.map(tag => (
                            <span key={tag} style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa", fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "6px" }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        {/* Assignee */}
                        {task.assigneeName && task.assigneeName !== "—" && (
                          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                            <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: `linear-gradient(135deg, ${assigneeColor}, ${assigneeColor}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 700, color: "#fff" }}>
                              {task.assigneeName[0].toUpperCase()}
                            </div>
                            <span style={{ color: t.textMuted, fontSize: "11px" }}>{task.assigneeName}</span>
                          </div>
                        )}

                        {/* Due date */}
                        {task.dueDate && (
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", background: overdue ? "rgba(239,68,68,0.1)" : dueToday ? "rgba(245,158,11,0.1)" : t.bgCardHover, padding: "3px 7px", borderRadius: "6px" }}>
                            <Clock size={10} style={{ color: overdue ? "#ef4444" : dueToday ? "#f59e0b" : t.textMuted }} />
                            <span style={{ fontSize: "10px", color: overdue ? "#ef4444" : dueToday ? "#f59e0b" : t.textMuted, fontWeight: 600 }}>
                              {overdue ? "Просрочено" : dueToday ? "Сегодня" : new Date(task.dueDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task detail modal */}
      <AnimatePresence>
        {selectedTask && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "520px", maxHeight: "85vh", overflowY: "auto" }}>

              {/* Priority stripe */}
              <div style={{ height: "3px", background: getPriority(selectedTask.priority).color, borderRadius: "2px", marginBottom: "20px" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                <h2 style={{ color: t.text, fontSize: "18px", fontWeight: 700, flex: 1, paddingRight: "12px" }}>{selectedTask.title}</h2>
                <div style={{ display: "flex", gap: "8px" }}>
                  {canManage && (
                    <button onClick={() => deleteTask(selectedTask.id)}
                      style={{ background: "rgba(239,68,68,0.1)", border: "none", color: "#ef4444", borderRadius: "8px", padding: "7px", cursor: "pointer", display: "flex" }}>
                      <Trash2 size={15} />
                    </button>
                  )}
                  <button onClick={() => setSelectedTask(null)}
                    style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
                </div>
              </div>

              {selectedTask.description && (
                <p style={{ color: t.textSecondary, fontSize: "14px", lineHeight: "1.6", marginBottom: "20px" }}>{selectedTask.description}</p>
              )}

              {/* Info grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                {/* Status */}
                <div style={{ background: t.bgCard, borderRadius: "12px", padding: "14px" }}>
                  <div style={{ color: t.textMuted, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Статус</div>
                  {canManage ? (
                    <select value={selectedTask.column}
                      onChange={e => { updateTask(selectedTask.id, { column: e.target.value }); setSelectedTask({ ...selectedTask, column: e.target.value }); }}
                      style={{ background: t.bgInput, color: t.text, border: `1px solid ${t.borderInput}`, borderRadius: "8px", padding: "6px 10px", fontSize: "13px", outline: "none", width: "100%" }}>
                      {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                    </select>
                  ) : (
                    <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>
                      {COLUMNS.find(c => c.id === selectedTask.column)?.emoji} {COLUMNS.find(c => c.id === selectedTask.column)?.label}
                    </div>
                  )}
                </div>

                {/* Priority */}
                <div style={{ background: t.bgCard, borderRadius: "12px", padding: "14px" }}>
                  <div style={{ color: t.textMuted, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Приоритет</div>
                  {canManage ? (
                    <select value={selectedTask.priority}
                      onChange={e => { updateTask(selectedTask.id, { priority: e.target.value }); setSelectedTask({ ...selectedTask, priority: e.target.value }); }}
                      style={{ background: t.bgInput, color: t.text, border: `1px solid ${t.borderInput}`, borderRadius: "8px", padding: "6px 10px", fontSize: "13px", outline: "none", width: "100%" }}>
                      {PRIORITIES.map(p => <option key={p.val} value={p.val}>{p.icon} {p.label}</option>)}
                    </select>
                  ) : (
                    <div style={{ color: getPriority(selectedTask.priority).color, fontSize: "13px", fontWeight: 600 }}>
                      {getPriority(selectedTask.priority).icon} {getPriority(selectedTask.priority).label}
                    </div>
                  )}
                </div>

                {/* Assignee */}
                <div style={{ background: t.bgCard, borderRadius: "12px", padding: "14px" }}>
                  <div style={{ color: t.textMuted, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Исполнитель</div>
                  {canManage ? (
                    <select value={selectedTask.assigneeId}
                      onChange={e => {
                        const u = users.find(u => u.id === e.target.value);
                        updateTask(selectedTask.id, { assigneeId: e.target.value, assigneeName: u?.name || "—", assigneeRole: u?.role || "" });
                        setSelectedTask({ ...selectedTask, assigneeId: e.target.value, assigneeName: u?.name || "—" });
                      }}
                      style={{ background: t.bgInput, color: t.text, border: `1px solid ${t.borderInput}`, borderRadius: "8px", padding: "6px 10px", fontSize: "13px", outline: "none", width: "100%" }}>
                      <option value="">Не назначен</option>
                      {assignableUsers.map(u => <option key={u.id} value={u.uid || u.id}>{u.name}</option>)}
                    </select>
                  ) : (
                    <div style={{ color: t.text, fontSize: "13px", fontWeight: 600 }}>{selectedTask.assigneeName || "Не назначен"}</div>
                  )}
                </div>

                {/* Due date */}
                <div style={{ background: t.bgCard, borderRadius: "12px", padding: "14px" }}>
                  <div style={{ color: t.textMuted, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Дедлайн</div>
                  {canManage ? (
                    <input type="date" value={selectedTask.dueDate}
                      onChange={e => { updateTask(selectedTask.id, { dueDate: e.target.value }); setSelectedTask({ ...selectedTask, dueDate: e.target.value }); }}
                      style={{ background: t.bgInput, color: t.text, border: `1px solid ${t.borderInput}`, borderRadius: "8px", padding: "6px 10px", fontSize: "13px", outline: "none", width: "100%" }} />
                  ) : (
                    <div style={{ color: isOverdue(selectedTask.dueDate) ? "#ef4444" : t.text, fontSize: "13px", fontWeight: 600 }}>
                      {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString("ru-RU") : "—"}
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              {selectedTask.tags?.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ color: t.textMuted, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Теги</div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {selectedTask.tags.map(tag => (
                      <span key={tag} style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa", fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "8px" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ color: t.textFaint, fontSize: "12px", paddingTop: "16px", borderTop: `1px solid ${t.border}` }}>
                Создал {selectedTask.createdByName} · {new Date(selectedTask.createdAt).toLocaleDateString("ru-RU")}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add task modal */}
      <AnimatePresence>
        {showForm && canManage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h3 style={{ color: t.text, fontSize: "16px", fontWeight: 600 }}>Новая задача</h3>
                <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Название *</label>
                  <input placeholder="Что нужно сделать?" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} autoFocus />
                </div>

                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Описание</label>
                  <textarea placeholder="Подробности задачи..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={3} style={{ ...inputStyle, resize: "none" }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Приоритет</label>
                    <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={{ ...inputStyle }}>
                      {PRIORITIES.map(p => <option key={p.val} value={p.val}>{p.icon} {p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Колонка</label>
                    <select value={form.column} onChange={e => setForm({ ...form, column: e.target.value })} style={{ ...inputStyle }}>
                      {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Исполнитель</label>
                    <select value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })} style={{ ...inputStyle }}>
                      <option value="">Не назначен</option>
                      {assignableUsers.map(u => <option key={u.id} value={u.uid || u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Дедлайн</label>
                    <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} style={{ ...inputStyle }} />
                  </div>
                </div>

                <div>
                  <label style={{ color: t.textMuted, fontSize: "12px", display: "block", marginBottom: "6px" }}>Теги (через запятую)</label>
                  <input placeholder="дизайн, срочно, контент..." value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} style={inputStyle} />
                </div>

                <button onClick={addTask} disabled={!form.title.trim()}
                  style={{ background: form.title.trim() ? "linear-gradient(135deg, #7c3aed, #db2777)" : t.bgCardHover, color: form.title.trim() ? "#fff" : t.textMuted, border: "none", borderRadius: "10px", padding: "13px", fontSize: "14px", fontWeight: 600, cursor: form.title.trim() ? "pointer" : "not-allowed" }}>
                  Создать задачу
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
