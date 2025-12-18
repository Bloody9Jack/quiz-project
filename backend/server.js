const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;

/* ================= CORS ================= */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);

/* ================= SOCKET.IO ================= */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket"], // 🔥 КРИТИЧНО (убираем polling)
});

/* ================= QUESTIONS ================= */
const QUESTIONS_LIMIT = 5;
const QUESTION_TIME = 8000;

const questions = [
  {
    question: "What is the largest ocean on Earth?",
    answers: [
      { text: "Atlantic Ocean", correct: false },
      { text: "Indian Ocean", correct: false },
      { text: "Arctic Ocean", correct: false },
      { text: "Pacific Ocean", correct: true },
    ],
  },
  {
    question: "Which element has the symbol K?",
    answers: [
      { text: "Potassium", correct: true },
      { text: "Krypton", correct: false },
      { text: "Calcium", correct: false },
      { text: "Carbon", correct: false },
    ],
  },
];

/* ================= ROOMS ================= */
const rooms = {};

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

/* ================= SOCKET EVENTS ================= */
io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  socket.on("joinRoom", ({ roomId, name }) => {
    if (!roomId || !name) return;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        questions: shuffle(questions).slice(0, QUESTIONS_LIMIT),
        index: 0,
        started: false,
        timer: null,
      };
    }

    const room = rooms[roomId];

    if (!room.players.find((p) => p.id === socket.id)) {
      room.players.push({
        id: socket.id,
        name,
        score: 0,
        answer: null,
      });
    }

    io.to(roomId).emit("players", room.players);

    if (room.players.length >= 2 && !room.started) {
      room.started = true;
      setTimeout(() => sendQuestion(roomId), 500);
    }
  });

  socket.on("answer", ({ roomId, index }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (player && player.answer === null) {
      player.answer = index;
    }
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      rooms[roomId].players = rooms[roomId].players.filter(
        (p) => p.id !== socket.id
      );
      if (rooms[roomId].players.length === 0) {
        clearTimeout(rooms[roomId].timer);
        delete rooms[roomId];
      }
    }
  });
});

/* ================= GAME FLOW ================= */
function sendQuestion(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  if (room.index >= room.questions.length) {
    io.to(roomId).emit("gameFinished", {
      leaderboard: room.players.sort((a, b) => b.score - a.score),
    });
    delete rooms[roomId];
    return;
  }

  const q = room.questions[room.index];
  const correctIndex = q.answers.findIndex((a) => a.correct);

  room.players.forEach((p) => (p.answer = null));

  io.to(roomId).emit("question", {
    question: q.question,
    answers: q.answers.map((a) => a.text),
    time: QUESTION_TIME / 1000,
  });

  room.timer = setTimeout(() => {
    room.players.forEach((p) => {
      if (p.answer === correctIndex) p.score++;
      else p.score--;
    });

    io.to(roomId).emit("result", {
      correctIndex,
      scores: room.players,
    });

    room.index++;
    setTimeout(() => sendQuestion(roomId), 1000);
  }, QUESTION_TIME);
}

/* ================= START ================= */
server.listen(PORT, () => {
  console.log("SERVER running on", PORT);
});
