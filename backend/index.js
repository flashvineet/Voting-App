const express = require("express");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);

// Use env vars
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(bodyParser.json());

let votes = { A: 0, B: 0, C: 0 };
let votedUsers = new Set(); // track who voted (by username)

// LOGIN route → issue JWT
app.post("/login", (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  const token = jwt.sign({ name }, JWT_SECRET, { expiresIn: "1d" });

  res.json({ message: "Login successful", token, user: name });
});

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
}

// VOTE route
app.post("/vote", authenticateToken, (req, res) => {
  const { option } = req.body;
  const username = req.user.name;

  if (votedUsers.has(username)) {
    return res.status(403).json({ message: "You already voted!" });
  }

  if (!votes.hasOwnProperty(option)) {
    return res.status(400).json({ message: "Invalid option" });
  }

  votes[option] += 1;
  votedUsers.add(username);

  io.emit("voteUpdate", votes);

  res.json({ message: `Vote casted for ${option}`, votes });
});

// RESULTS route
app.get("/results", (req, res) => {
  res.json({ votes });
});

// Socket.IO
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  socket.emit("voteUpdate", votes);
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
