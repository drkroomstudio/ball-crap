const { WebSocketServer } = require('ws');
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 10000;
const HEARTBEAT_INTERVAL = 30000; // 30s ping to keep connections alive

// Room storage: { code: { host: ws|null, guest: ws|null } }
const rooms = {};

const server = http.createServer((req, res) => {
  // Health check endpoint for Render
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const params = url.parse(req.url, true).query;
  const room = (params.room || '').toUpperCase();
  const role = params.role; // 'host' or 'guest'

  if (!room || !role || (role !== 'host' && role !== 'guest')) {
    ws.close(4000, 'Missing room or role');
    return;
  }

  // Initialize room if needed
  if (!rooms[room]) rooms[room] = { host: null, guest: null };

  const entry = rooms[room];

  // Reject if slot already taken
  if (entry[role] && entry[role].readyState === 1) {
    ws.close(4001, 'Role already taken');
    return;
  }

  // Assign this connection
  entry[role] = ws;
  ws._room = room;
  ws._role = role;
  ws.isAlive = true;

  console.log(`[${room}] ${role} joined`);

  // Notify both sides if opponent is already here
  const opponent = role === 'host' ? entry.guest : entry.host;
  if (opponent && opponent.readyState === 1) {
    ws.send(JSON.stringify({ type: 'OPPONENT_JOINED' }));
    opponent.send(JSON.stringify({ type: 'OPPONENT_JOINED' }));
    console.log(`[${room}] match started`);
  }

  // Forward all game messages to the other player
  ws.on('message', (data) => {
    const other = role === 'host' ? entry.guest : entry.host;
    if (other && other.readyState === 1) {
      other.send(data.toString());
    }
  });

  // Handle pong for heartbeat
  ws.on('pong', () => { ws.isAlive = true; });

  // Clean up on disconnect
  ws.on('close', () => {
    console.log(`[${room}] ${role} left`);
    if (entry[role] === ws) entry[role] = null;

    // Notify opponent
    const other = role === 'host' ? entry.guest : entry.host;
    if (other && other.readyState === 1) {
      other.send(JSON.stringify({ type: 'OPPONENT_LEFT' }));
    }

    // Clean up empty rooms
    if (!entry.host && !entry.guest) {
      delete rooms[room];
      console.log(`[${room}] room deleted`);
    }
  });
});

// Heartbeat: ping all clients every 30s, close unresponsive ones
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) { ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log(`Ball Crap relay listening on port ${PORT}`);
});
