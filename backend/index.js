const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");  

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, 
});

const PORT = 5000;

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173", 
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(
  session({
    secret: "voting-secret",
    resave: false,
    saveUninitialized: true,
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

  // Broadcast update to all connected clients
  io.emit("voteUpdate", votes);

  res.json({ message: `Vote casted for ${option}`, votes });
});

// RESULTS route
app.get("/results", (req, res) => {
  res.json({ votes });
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  socket.emit("voteUpdate", votes);
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
