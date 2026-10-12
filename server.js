const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Setup SQLite Database (stored locally in database.sqlite)
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) console.error('Database opening error: ', err.message);
});

// Create notes table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS notes (
  path TEXT PRIMARY KEY,
  content TEXT
)`);

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// FIXED: Express 5 compatible catch-all route using a named wildcard or regex
app.get(/^(?!\/socket\.io\/).+/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket Real-time Connection
io.on('connection', (socket) => {
  socket.on('join-room', (roomPath) => {
    socket.join(roomPath);

    db.get(`SELECT content FROM notes WHERE path = ?`, [roomPath], (err, row) => {
      if (err) {
        console.error(err);
        return;
      }
      const content = row ? row.content : '';
      socket.emit('load-content', content);
    });
  });

  socket.on('text-change', ({ roomPath, content }) => {
    db.run(
      `INSERT INTO notes (path, content) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET content = ?`,
      [roomPath, content, content],
      (err) => {
        if (err) console.error(err);
      }
    );

    socket.to(roomPath).emit('receive-text-change', content);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running locally at http://localhost:${PORT}`);
});