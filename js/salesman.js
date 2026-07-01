const user = guardPage('salesman');
document.getElementById('userName').textContent = user.name;
document.getElementById('userRole').textContent = user.role.replace('_', ' ');
document.getElementById('avatarInit').textContent = initials(user.name);

let currentFilter = '';
let activeChatId = null;
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
    list.innerHTML = `<div class="empty-list">No chats assigned to you yet</div>`;
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
          ${c.unread_count > 0 ? `<span class="unread-pill">${c.unread_count}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

async function openChat(chatId) {
  activeChatId = chatId;
  renderChatList(chatsCache);
  socket && socket.emit('join_chat', chatId);

  try {
    const { chat } = await api('GET', `/chats/${chatId}`);
    renderChatWindow(chat);
    loadChats(); // refresh unread counts in the list now that messages were marked read
  } catch (err) {
    showToast(err.message);
  }
}

function renderChatWindow(chat) {
  const win = document.getElementById('chatWindow');
  const closed = chat.status === 'closed';

  win.innerHTML = `
    <div class="chat-window-header">
      <div class="who">
        <div class="chat-avatar">${initials(chat.customer_name || chat.phone_number)}</div>
        <div>
          <div class="phone">${escapeHtml(chat.customer_name || chat.phone_number)}</div>
          <div class="status-line">${escapeHtml(chat.phone_number)} · <span class="badge badge-${chat.status}">${chat.status.replace('_',' ')}</span></div>
        </div>
      </div>
      <button class="btn ${closed ? 'btn-ghost' : 'btn-danger'} btn-sm" onclick="toggleStatus(${chat.id}, '${closed ? 'assigned' : 'closed'}')">
        ${closed ? 'Reopen chat' : 'Mark as closed'}
      </button>
    </div>
    <div class="chat-messages" id="chatMessages">
      ${chat.messages.map(renderBubble).join('') || '<div class="chat-empty-state">No messages yet</div>'}
    </div>
    <div class="chat-composer">
      <input type="text" id="composerInput" placeholder="${closed ? 'Reopen this chat to reply…' : 'Type a reply…'}" ${closed ? 'disabled' : ''} onkeydown="if(event.key==='Enter') sendReply(${chat.id})" />
      <button onclick="sendReply(${chat.id})" ${closed ? 'disabled' : ''}>➤</button>
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

async function sendReply(chatId) {
  const input = document.getElementById('composerInput');
  const message = input.value.trim();
  if (!message) return;

  input.disabled = true;
  try {
    await api('POST', '/messages/send', { chatId, message });
    input.value = '';
    openChat(chatId);
  } catch (err) {
    showToast(err.message);
  } finally {
    input.disabled = false;
    input.focus();
  }
}

async function toggleStatus(chatId, status) {
  try {
    await api('PATCH', '/chats/status', { chatId, status });
    showToast(status === 'closed' ? 'Chat closed' : 'Chat reopened');
    await loadChats();
    openChat(chatId);
  } catch (err) {
    showToast(err.message);
  }
}

// ---- Realtime ----
if (socket) {
  socket.on('chat_assigned', (payload) => {
    showToast(`New chat assigned: ${payload.phone_number}`);
    loadChats();
  });
  socket.on('chat_updated', (payload) => {
    loadChats();
    if (payload.chatId === activeChatId) openChat(activeChatId);
  });
  socket.on('new_message', (payload) => {
    loadChats();
    if (payload.chatId === activeChatId) openChat(activeChatId);
  });
}

loadChats();
