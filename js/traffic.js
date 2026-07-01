const user = guardPage('traffic_manager');
document.getElementById('userName').textContent = user.name;
document.getElementById('userRole').textContent = user.role.replace('_', ' ');
document.getElementById('avatarInit').textContent = initials(user.name);

let currentFilter = '';
let activeChatId = null;
let salesmen = [];
let chatsCache = [];
const socket = connectSocket();

function setFilter(status) {
  currentFilter = status;
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.classList.toggle('btn-primary', btn.dataset.filter === status);
    btn.classList.toggle('btn-ghost', btn.dataset.filter !== status);
  });
  loadChats();
}
setFilter('');

async function loadSalesmen() {
  try {
    const { salesmen: list } = await api('GET', '/users/list/salesmen');
    salesmen = list;
  } catch (err) {
    showToast(err.message);
  }
}

async function loadChats() {
  try {
    const qs = currentFilter ? `?status=${currentFilter}` : '';
    const { chats } = await api('GET', `/chats${qs}`);
    chatsCache = chats;
    renderChatList(chats);
  } catch (err) {
    showToast(err.message);
  }
}

function renderChatList(chats) {
  const list = document.getElementById('chatList');
  if (chats.length === 0) {
    list.innerHTML = `<div class="empty-list">No chats in this view</div>`;
    return;
  }
  list.innerHTML = chats.map(c => `
    <div class="chat-list-item ${c.id === activeChatId ? 'active' : ''}" onclick="openChat(${c.id})">
      <div class="chat-avatar">${initials(c.customer_name || c.phone_number)}</div>
      <div class="ci-main">
        <div class="ci-top">
          <span class="phone">${escapeHtml(c.customer_name || c.phone_number)}</span>
          <span class="time">${timeAgo(c.last_message_at || c.created_at)}</span>
        </div>
        <div class="preview">${escapeHtml(c.phone_number)}</div>
        <div class="ci-meta">
          <span class="badge badge-${c.status}">${c.status.replace('_',' ')}</span>
          ${c.assignee ? `<span style="font-size:11px;color:var(--ink-soft);"><span class="dot ${c.assignee.online ? 'online' : 'offline'}"></span>${escapeHtml(c.assignee.name)}</span>` : `<span style="font-size:11px;color:var(--ink-soft);">Unassigned</span>`}
          ${c.unread_count > 0 ? `<span class="unread-pill">${c.unread_count}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

async function openChat(chatId) {
  activeChatId = chatId;
  renderChatList(chatsCache); // refresh active highlight
  socket && socket.emit('join_chat', chatId);

  try {
    const { chat } = await api('GET', `/chats/${chatId}`);
    renderChatWindow(chat);
  } catch (err) {
    showToast(err.message);
  }
}

function renderChatWindow(chat) {
  const win = document.getElementById('chatWindow');
  const salesmenOptions = salesmen.map(s =>
    `<option value="${s.id}" ${chat.assigned_to === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
  ).join('');

  win.innerHTML = `
    <div class="chat-window-header">
      <div class="who">
        <div class="chat-avatar">${initials(chat.customer_name || chat.phone_number)}</div>
        <div>
          <div class="phone">${escapeHtml(chat.customer_name || chat.phone_number)}</div>
          <div class="status-line">${escapeHtml(chat.phone_number)} · <span class="badge badge-${chat.status}">${chat.status.replace('_',' ')}</span></div>
        </div>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <select class="select-inline" id="assignSelect">
          <option value="">${chat.assigned_to ? 'Reassign to…' : 'Assign to…'}</option>
          ${salesmenOptions}
        </select>
        <button class="btn btn-primary btn-sm" onclick="assignChat(${chat.id})">Assign</button>
      </div>
    </div>
    <div class="chat-messages" id="chatMessages">
      ${chat.messages.map(renderBubble).join('') || '<div class="chat-empty-state">No messages yet</div>'}
    </div>
    <div style="padding:12px 16px; border-top:1px solid var(--border); font-size:12px; color:var(--ink-soft); text-align:center;">
      Traffic managers route chats — replies are sent from the assigned salesman's dashboard.
    </div>
  `;
  const msgBox = document.getElementById('chatMessages');
  msgBox.scrollTop = msgBox.scrollHeight;
}

function renderBubble(m) {
  if (m.sender === 'system') {
    return `<div class="bubble-row system"><div class="bubble">${escapeHtml(m.message)}</div></div>`;
  }
  const out = m.sender === 'salesman';
  return `
    <div class="bubble-row ${out ? 'out' : 'in'}">
      <div class="bubble">${escapeHtml(m.message)}<span class="meta-time">${formatClock(m.timestamp)}</span></div>
    </div>
  `;
}

async function assignChat(chatId) {
  const salesmanId = document.getElementById('assignSelect').value;
  if (!salesmanId) {
    showToast('Choose a salesman first');
    return;
  }
  try {
    await api('PATCH', '/chats/assign', { chatId, salesmanId: Number(salesmanId) });
    showToast('Chat assigned');
    await loadChats();
    openChat(chatId);
  } catch (err) {
    showToast(err.message);
  }
}

// ---- Realtime ----
if (socket) {
  socket.on('new_chat', () => { loadChats(); showToast('New chat received'); });
  socket.on('chat_updated', (payload) => {
    loadChats();
    if (payload.chatId === activeChatId) openChat(activeChatId);
  });
  socket.on('new_message', (payload) => {
    loadChats();
    if (payload.chatId === activeChatId) openChat(activeChatId);
  });
  socket.on('user_status', () => loadChats());
}

(async function init() {
  await loadSalesmen();
  await loadChats();
})();
