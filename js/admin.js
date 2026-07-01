const user = guardPage('admin');
document.getElementById('userName').textContent = user.name;
document.getElementById('userRole').textContent = user.role.replace('_', ' ');
document.getElementById('avatarInit').textContent = initials(user.name);

document.getElementById('navSimulate').addEventListener('click', () => {
  document.getElementById('simPanel').style.display = 'flex';
});

async function loadUsers() {
  try {
    const { users } = await api('GET', '/users');
    renderStats(users);
    renderTable(users);
  } catch (err) {
    showToast(err.message);
  }
}

function renderStats(users) {
  const counts = { admin: 0, traffic_manager: 0, salesman: 0, active: 0 };
  users.forEach(u => {
    counts[u.role] = (counts[u.role] || 0) + 1;
    if (u.is_active) counts.active++;
  });
  const grid = document.getElementById('statGrid');
  grid.innerHTML = `
    <div class="stat-card"><div class="num">${users.length}</div><div class="label">Total users</div></div>
    <div class="stat-card"><div class="num">${counts.active}</div><div class="label">Active</div></div>
    <div class="stat-card"><div class="num">${counts.traffic_manager}</div><div class="label">Traffic managers</div></div>
    <div class="stat-card"><div class="num">${counts.salesman}</div><div class="label">Salesmen</div></div>
  `;
}

function renderTable(users) {
  const body = document.getElementById('usersTableBody');
  if (users.length === 0) {
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--ink-soft);">No users yet</td></tr>`;
    return;
  }
  body.innerHTML = users.map(u => `
    <tr>
      <td>${escapeHtml(u.name)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td>
        <select class="select-inline" onchange="changeRole(${u.id}, this.value)" ${u.id === user.id ? 'disabled' : ''}>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          <option value="traffic_manager" ${u.role === 'traffic_manager' ? 'selected' : ''}>Traffic Manager</option>
          <option value="salesman" ${u.role === 'salesman' ? 'selected' : ''}>Salesman</option>
        </select>
      </td>
      <td><span class="badge ${u.is_active ? 'badge-active' : 'badge-inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>${new Date(u.created_at).toLocaleDateString()}</td>
      <td>
        <button class="btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-ghost'}"
          onclick="toggleActive(${u.id}, ${!u.is_active})"
          ${u.id === user.id ? 'disabled' : ''}>
          ${u.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </td>
    </tr>
  `).join('');
}

async function changeRole(id, role) {
  try {
    await api('PATCH', `/users/${id}`, { role });
    showToast('Role updated');
    loadUsers();
  } catch (err) {
    showToast(err.message);
    loadUsers();
  }
}

async function toggleActive(id, is_active) {
  try {
    await api('PATCH', `/users/${id}`, { is_active });
    showToast(is_active ? 'User activated' : 'User deactivated');
    loadUsers();
  } catch (err) {
    showToast(err.message);
  }
}

document.getElementById('createUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('newName').value.trim();
  const email = document.getElementById('newEmail').value.trim();
  const password = document.getElementById('newPassword').value;
  const role = document.getElementById('newRole').value;

  try {
    await api('POST', '/users', { name, email, password, role });
    showToast('User created');
    e.target.reset();
    loadUsers();
  } catch (err) {
    showToast(err.message);
  }
});

async function sendSimulatedMessage() {
  const phone_number = document.getElementById('simPhone').value.trim();
  const customer_name = document.getElementById('simName').value.trim();
  const message = document.getElementById('simMessage').value.trim();

  if (!phone_number || !message) {
    showToast('Phone number and message are required');
    return;
  }

  try {
    const res = await fetch(API_BASE_URL + '/webhook/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number, customer_name: customer_name || undefined, message })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to simulate message');
    showToast('Message simulated — check the Traffic Manager dashboard');
    document.getElementById('simPanel').style.display = 'none';
    document.getElementById('simPhone').value = '';
    document.getElementById('simName').value = '';
    document.getElementById('simMessage').value = '';
  } catch (err) {
    showToast(err.message);
  }
}

loadUsers();
