const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// Trust Render proxy (needed for secure cookies)
app.set("trust proxy", 1);

// Use env vars
const PORT = process.env.PORT || 5000;
const SESSION_SECRET = process.env.SESSION_SECRET || "fallback-secret";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Socket.IO with proper CORS
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
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,        // cookie only over HTTPS
      sameSite: "none",    // allow cross-site cookie (Vercel <-> Render)
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

let votes = { A: 0, B: 0, C: 0 };

// LOGIN route
app.post("/login", (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }
  req.session.user = { name, voted: false };
  res.json({ message: "Login successful", user: name });
});

// VOTE route
app.post("/vote", (req, res) => {
  const { option } = req.body;
  const user = req.session.user;

  if (!user) {
    return res.status(401).json({ message: "Please login first" });
  }

  if (user.voted) {
    return res.status(403).json({ message: "You already voted!" });
  }

  if (!votes.hasOwnProperty(option)) {
    return res.status(400).json({ message: "Invalid option" });
  }

  votes[option] += 1;
  user.voted = true;

  // Broadcast update to all clients
  io.emit("voteUpdate", votes);

  res.json({ message: `Vote casted for ${option}`, votes });
});

// RESULTS route
app.get("/results", (req, res) => {
  res.json({ votes });
});

// Socket.IO connections
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  socket.emit("voteUpdate", votes);
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
