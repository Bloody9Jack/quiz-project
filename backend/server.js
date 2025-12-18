const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 10000;

const app = express();
const server = http.createServer(app);

/* ===== SOCKET.IO ONLY CORS ===== */
const io = new Server(server, {
  cors: {
    origin: "https://resonant-6bb406.netlify.app",
    methods: ["GET", "POST"],
  },
});

/* ===== TEST ROUTE ===== */
app.get("/", (_, res) => {
  res.send("OK");
});

/* ===== SOCKET ===== */
io.on("connection", (socket) => {
  console.log("WS CONNECTED:", socket.id);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("SERVER RUNNING:", PORT);
});
