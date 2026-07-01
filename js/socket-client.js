// Requires the socket.io client script (loaded via CDN in the HTML) to be
// present as the global `io()` before this file runs.
function connectSocket() {
  const token = getToken();
  if (!token) return null;

  // Must point at the Railway backend explicitly now that frontend/backend
  // are on different domains - default same-origin connection won't work.
  const socket = io(API_BASE_URL, {
    auth: { token }
  });

  socket.on('connect_error', (err) => {
    console.warn('Socket connection error:', err.message);
  });

  return socket;
}
