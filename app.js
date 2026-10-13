(() => {
  const STORAGE_KEY = "daymark.tasks.v1";
  const today = startOfDay(new Date());
  let selectedDate = startOfDay(today);
  let currentView = "today";
  let tasks = loadTasks();
  let filters = { status: "all", priority: "all", list: "all" };
  let toastTimer;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  function dateKey(date) { return date.toISOString().slice(0, 10); }
  function parseDate(value) { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d); }
  function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
  function addDays(date, amount) { const next = new Date(date); next.setDate(next.getDate() + amount); return startOfDay(next); }
  function isSameDay(a, b) { return dateKey(a) === dateKey(b); }
  function escapeHtml(value = "") { return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
  function formatLongDate(date) { return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date).toUpperCase(); }
  function formatShortDate(date) { return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(date); }
  function formatTime(time) { if (!time) return ""; const [hour, minute] = time.split(":").map(Number); const suffix = hour >= 12 ? "PM" : "AM"; return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`; }
  function uid() { return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

  function makeSeedTasks() {
    const d = (offset) => dateKey(addDays(today, offset));
    return [
      { id: uid(), title: "Shape the new project brief", details: "Pull the loose notes into one clear point of view before the afternoon review.", date: d(0), time: "10:30", priority: "high", list: "Studio", tags: ["writing", "focus"], done: false },
      { id: uid(), title: "Send the revised route map", details: "A small note with the three decisions we made yesterday.", date: d(0), time: "14:00", priority: "medium", list: "Studio", tags: ["admin"], done: false },
      { id: uid(), title: "Pick up the good coffee", details: "The beans from the place on Mercer.", date: d(0), time: "17:30", priority: "low", list: "Personal", tags: ["errand"], done: true },
      { id: uid(), title: "Read chapter four", details: "Thirty quiet pages, no need to finish the book tonight.", date: d(1), time: "20:00", priority: "low", list: "Reading list", tags: ["slow"], done: false },
      { id: uid(), title: "Studio stand-up", details: "Bring the latest questions, not a polished performance.", date: d(2), time: "09:30", priority: "medium", list: "Studio", tags: ["meeting"], done: false },
      { id: uid(), title: "Book Friday train", details: "Window seat if there is one.", date: d(4), time: "11:00", priority: "medium", list: "Personal", tags: ["travel"], done: false },
      { id: uid(), title: "Archive old references", details: "Clear the desktop and keep the useful bits close.", date: d(5), time: "16:00", priority: "low", list: "Studio", tags: ["tidy"], done: false },
      { id: uid(), title: "Sunday reset", details: "A little time to look at the week without trying to control it.", date: d(6), time: "18:00", priority: "medium", list: "Personal", tags: ["ritual"], done: false }
    ];
  }

  function loadTasks() {
    try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (Array.isArray(saved) && saved.length) return saved; } catch (error) { /* use the calm default */ }
    const seeded = makeSeedTasks();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }

  function getVisibleTasks() {
    let visible = [...tasks];
    if (currentView === "today") visible = visible.filter((task) => task.date === dateKey(selectedDate));
    if (currentView === "upcoming") visible = visible.filter((task) => task.date >= dateKey(today) && !task.done);
    if (currentView === "completed") visible = visible.filter((task) => task.done);
    if (["Studio", "Personal", "Reading list"].includes(currentView)) visible = visible.filter((task) => task.list === currentView);
    if (filters.status === "open") visible = visible.filter((task) => !task.done);
    if (filters.status === "done") visible = visible.filter((task) => task.done);
    if (filters.priority !== "all") visible = visible.filter((task) => task.priority === filters.priority);
    if (filters.list !== "all") visible = visible.filter((task) => task.list === filters.list);
    return visible.sort((a, b) => Number(a.done) - Number(b.done) || (a.time || "99:99").localeCompare(b.time || "99:99"));
  }

  function renderDateStrip() {
    const start = addDays(selectedDate, -3);
    $("#dateCells").innerHTML = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      const key = dateKey(date);
      const dayLabel = new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date).slice(0, 3);
      const marked = tasks.some((task) => task.date === key && !task.done);
      return `<button class="date-cell ${isSameDay(date, selectedDate) ? "is-selected" : ""}" type="button" data-date="${key}" aria-label="${formatShortDate(date)}"><span class="day-name">${dayLabel}</span><span class="day-number">${date.getDate()}</span>${marked ? "<span class=\"day-mark\"></span>" : ""}</button>`;
    }).join("");
    $$(".date-cell").forEach((button) => button.addEventListener("click", () => { selectedDate = parseDate(button.dataset.date); currentView = "today"; setActiveNav("today"); render(); }));
  }

  function taskTemplate(task, index) {
    const tagMarkup = (task.tags || []).slice(0, 3).map((tag) => `<span class="task-tag">${escapeHtml(tag)}</span>`).join("");
    const reminder = task.time ? `<span class="task-time">◷ ${formatTime(task.time)}</span>` : "";
    return `<article class="task-item ${task.done ? "is-done" : ""}" style="animation-delay:${index * 35}ms" data-task-id="${task.id}">
      <button class="check-button" type="button" data-action="toggle-task" data-id="${task.id}" aria-label="Mark ${escapeHtml(task.title)} ${task.done ? "active" : "complete"}">${task.done ? "✓" : ""}</button>
      <div class="task-main"><h3 class="task-title">${escapeHtml(task.title)}</h3>${task.details ? `<p class="task-details">${escapeHtml(task.details)}</p>` : ""}<div class="task-meta"><span class="task-list-label">${escapeHtml(task.list)}</span><span class="priority-mark ${task.priority}">${task.priority}</span>${reminder}${tagMarkup}</div></div>
      <div class="task-actions"><button class="task-action" type="button" data-action="edit-task" data-id="${task.id}" aria-label="Edit task">↗</button><button class="task-action" type="button" data-action="delete-task-inline" data-id="${task.id}" aria-label="Delete task">×</button></div>
    </article>`;
  }

  function renderTasks() {
    const visible = getVisibleTasks();
    $("#taskList").innerHTML = visible.map(taskTemplate).join("");
    $("#taskList").hidden = visible.length === 0;
    $("#emptyState").hidden = visible.length !== 0;
    const title = currentView === "today" ? (isSameDay(selectedDate, today) ? "For today" : `For ${new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(selectedDate).toLowerCase()}`) : currentView === "upcoming" ? "Coming up" : currentView === "completed" ? "All done" : currentView;
    $("#agendaTitle").textContent = title;
    $("#breadcrumbView").textContent = title;
    $("#agendaEyebrow").textContent = currentView === "today" ? formatLongDate(selectedDate) : `${visible.length} ${visible.length === 1 ? "mark" : "marks"} in this view`;
    $("#heroSummary").textContent = visible.length ? `${visible.filter((task) => !task.done).length} open ${visible.filter((task) => !task.done).length === 1 ? "thread" : "threads"} in this view. Keep the edges soft.` : "A blank edge can be a useful place to begin.";
    $$("[data-action=toggle-task], [data-action=edit-task], [data-action=delete-task-inline]").forEach((button) => button.addEventListener("click", handleTaskAction));
  }

  function renderSidebarCounts() {
    $("#todayCount").textContent = tasks.filter((task) => task.date === dateKey(today) && !task.done).length;
    $("#upcomingCount").textContent = tasks.filter((task) => task.date >= dateKey(today) && !task.done).length;
    $("#completedCount").textContent = tasks.filter((task) => task.done).length;
    $$("[data-list-count]").forEach((count) => { count.textContent = tasks.filter((task) => task.list === count.dataset.listCount && !task.done).length; });
  }

  function renderWeek() {
    const start = addDays(selectedDate, -selectedDate.getDay() + 1);
    const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
    const weekTasks = tasks.filter((task) => days.some((day) => task.date === dateKey(day)));
    const doneCount = weekTasks.filter((task) => task.done).length;
    $("#weekDone").textContent = doneCount;
    $("#weekTotal").textContent = weekTasks.length;
    $("#weekProgress").style.width = `${weekTasks.length ? (doneCount / weekTasks.length) * 100 : 0}%`;
    $("#weekRange").textContent = `${days[0].getDate()}—${days[6].getDate()} ${new Intl.DateTimeFormat("en-GB", { month: "short" }).format(days[6]).toUpperCase()}`;
    $("#weekList").innerHTML = days.map((day) => { const dayTasks = tasks.filter((task) => task.date === dateKey(day)); const label = new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(day).slice(0, 3); return `<div class="week-row ${isSameDay(day, today) ? "is-today" : ""}"><span class="week-row-day">${label}</span><span class="week-row-label">${isSameDay(day, today) ? "Today" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(day)}</span><span class="week-row-count">${dayTasks.length ? `${dayTasks.filter((task) => task.done).length}/${dayTasks.length}` : "—"}</span></div>`; }).join("");
  }

  function render() {
    renderDateStrip(); renderTasks(); renderSidebarCounts(); renderWeek();
    const filterCount = Object.values(filters).filter((value) => value !== "all").length;
    $("#filterIndicator").textContent = filterCount;
    $("#dateKicker").textContent = formatLongDate(selectedDate);
    $("#taskList").querySelectorAll(".task-item").forEach((item) => item.addEventListener("dblclick", () => openDialog(item.dataset.taskId)));
  }

  function setActiveNav(view) { $$(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.view === view || item.dataset.list === view)); }
  function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("is-visible"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200); }

  function openDialog(id = "") {
    const task = tasks.find((item) => item.id === id);
    $("#taskId").value = task?.id || "";
    $("#dialogKicker").textContent = task ? "Edit mark" : "New mark";
    $("#dialogTitle").textContent = task ? "Make a small adjustment." : "What needs a place?";
    $("#taskTitle").value = task?.title || "";
    $("#taskDetails").value = task?.details || "";
    $("#taskDate").value = task?.date || dateKey(selectedDate);
    $("#taskTime").value = task?.time || "";
    $("#taskPriority").value = task?.priority || "medium";
    $("#taskListName").value = task?.list || "Studio";
    $("#taskTags").value = task?.tags?.join(", ") || "";
    $("[data-action=delete-task]").hidden = !task;
    $("#taskDialog").showModal();
    setTimeout(() => $("#taskTitle").focus(), 50);
  }
  function closeDialog() { $("#taskDialog").close(); }

  function handleTaskAction(event) {
    const { action, id } = event.currentTarget.dataset;
    if (action === "toggle-task") { const task = tasks.find((item) => item.id === id); task.done = !task.done; saveTasks(); render(); showToast(task.done ? "Marked complete." : "Back on the list."); }
    if (action === "edit-task") openDialog(id);
    if (action === "delete-task-inline") { tasks = tasks.filter((item) => item.id !== id); saveTasks(); render(); showToast("Removed from the list."); }
  }

  $("#taskForm").addEventListener("submit", (event) => { event.preventDefault(); const id = $("#taskId").value; const entry = { id: id || uid(), title: $("#taskTitle").value.trim(), details: $("#taskDetails").value.trim(), date: $("#taskDate").value, time: $("#taskTime").value, priority: $("#taskPriority").value, list: $("#taskListName").value, tags: $("#taskTags").value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 4), done: id ? tasks.find((item) => item.id === id).done : false }; if (!entry.title || !entry.date) return; if (id) tasks = tasks.map((task) => task.id === id ? entry : task); else tasks.push(entry); selectedDate = parseDate(entry.date); currentView = "today"; setActiveNav("today"); saveTasks(); closeDialog(); render(); showToast(id ? "Task updated." : "New task marked."); });
  $("[data-action=delete-task]").addEventListener("click", () => { const id = $("#taskId").value; if (!id) return; tasks = tasks.filter((task) => task.id !== id); saveTasks(); closeDialog(); render(); showToast("Removed from the list."); });
  $$("[data-action=close-dialog]").forEach((button) => button.addEventListener("click", closeDialog));
  $("#taskDialog").addEventListener("click", (event) => { if (event.target === $("#taskDialog")) closeDialog(); });
  $("[data-action=new-task]").addEventListener("click", () => openDialog());
  $("[data-action=previous-day]").addEventListener("click", () => { selectedDate = addDays(selectedDate, -1); currentView = "today"; setActiveNav("today"); render(); });
  $("[data-action=next-day]").addEventListener("click", () => { selectedDate = addDays(selectedDate, 1); currentView = "today"; setActiveNav("today"); render(); });
  $("[data-action=toggle-filters]").addEventListener("click", () => { const panel = $("#filterPanel"); panel.hidden = !panel.hidden; $("[data-action=toggle-filters]").setAttribute("aria-expanded", String(!panel.hidden)); });
  $("[data-action=reset-filters]").addEventListener("click", () => { filters = { status: "all", priority: "all", list: "all" }; $("#statusFilter").value = "all"; $("#priorityFilter").value = "all"; $("#listFilter").value = "all"; render(); });
  ["statusFilter", "priorityFilter", "listFilter"].forEach((id) => $("#" + id).addEventListener("change", (event) => { filters[{ statusFilter: "status", priorityFilter: "priority", listFilter: "list" }[id]] = event.target.value; render(); }));
  $$("[data-view]").forEach((button) => button.addEventListener("click", () => { currentView = button.dataset.view; setActiveNav(currentView); render(); if (window.innerWidth <= 760) document.body.classList.remove("menu-open"); }));
  $$("[data-list]").forEach((button) => button.addEventListener("click", () => { currentView = button.dataset.list; setActiveNav(currentView); render(); if (window.innerWidth <= 760) document.body.classList.remove("menu-open"); }));
  $("[data-action=open-menu]").addEventListener("click", () => document.body.classList.add("menu-open"));
  $("[data-action=close-menu]").addEventListener("click", () => document.body.classList.remove("menu-open"));
  $("[data-action=focus-search]").addEventListener("click", () => { const query = window.prompt("Search your marks"); if (query === null) return; const normalized = query.trim().toLowerCase(); if (!normalized) { render(); return; } const match = tasks.filter((task) => `${task.title} ${task.details} ${task.tags.join(" ")}`.toLowerCase().includes(normalized)); $("#taskList").innerHTML = match.map(taskTemplate).join(""); $("#taskList").hidden = match.length === 0; $("#emptyState").hidden = match.length !== 0; $("#agendaTitle").textContent = normalized ? `Search: ${query.trim()}` : "For today"; showToast(`${match.length} ${match.length === 1 ? "mark" : "marks"} found.`); });
  $("[data-action=new-list]").addEventListener("click", () => showToast("Lists are kept deliberately small for now."));
  window.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("[data-action=focus-search]").click(); } if (event.key === "Escape" && document.body.classList.contains("menu-open")) document.body.classList.remove("menu-open"); });
  render();
})();
