const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const PORT = process.env.PORT || 10000;
const QUESTIONS_LIMIT = 10;
const QUESTION_TIME = 10000;

const app = express();
const server = http.createServer(app);

/* ===== CORS ===== */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://YOUR_NETLIFY_SITE.netlify.app",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://YOUR_NETLIFY_SITE.netlify.app",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

/* ===== QUESTIONS ===== */
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
    question: "Which element has the chemical symbol 'K'?",
    answers: [
      { text: "Krypton", correct: false },
      { text: "Potassium", correct: true },
      { text: "Kryptonite", correct: false },
      { text: "Kallium", correct: false },
    ],
  },
  {
    question: "Which planet is known as the Red Planet?",
    answers: [
      { text: "Earth", correct: false },
      { text: "Mars", correct: true },
      { text: "Jupiter", correct: false },
      { text: "Venus", correct: false },
    ],
  },
];

const rooms = {};

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const pickQuestions = (all, n) => shuffle(all).slice(0, n);

/* ===== SOCKET ===== */
io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  socket.on("joinRoom", (roomId, name) => {
    if (!roomId || !name) return;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        questions: pickQuestions(
          questions,
          Math.min(QUESTIONS_LIMIT, questions.length)
        ),
        qIndex: 0,
        timer: null,
        started: false,
      };
    }

    const room = rooms[roomId];

    room.players.push({
      id: socket.id,
      name,
      score: 0,
      answerIndex: null,
    });

    io.to(roomId).emit(
      "scores",
      room.players.map((p) => ({ name: p.name, score: p.score }))
    );

    if (room.players.length >= 2 && !room.started) {
      room.started = true;
      setTimeout(() => askQuestion(roomId), 500);
    }
  });

  socket.on("submitAnswer", (roomId, idx) => {
    const room = rooms[roomId];
    if (!room) return;
    const p = room.players.find((x) => x.id === socket.id);
    if (!p || p.answerIndex !== null) return;
    p.answerIndex = Number(idx);
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

/* ===== GAME FLOW ===== */
function askQuestion(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  if (room.qIndex >= room.questions.length) {
    io.to(roomId).emit("gameFinished", {
      leaderboard: room.players.sort((a, b) => b.score - a.score),
    });
    delete rooms[roomId];
    return;
  }

  const q = room.questions[room.qIndex];
  const correct = q.answers.findIndex((a) => a.correct);

  room.players.forEach((p) => (p.answerIndex = null));

  io.to(roomId).emit("newQuestion", {
    question: q.question,
    answers: q.answers.map((a) => a.text),
    timer: QUESTION_TIME / 1000,
  });

  room.timer = setTimeout(() => {
    room.players.forEach((p) => {
      p.score += p.answerIndex === correct ? 1 : -1;
    });

    io.to(roomId).emit("answerResult", {
      correctAnswer: correct,
      scores: room.players,
    });

    room.qIndex++;
    setTimeout(() => askQuestion(roomId), 500);
  }, QUESTION_TIME);
}

server.listen(PORT, "0.0.0.0", () => {
  console.log("SERVER RUNNING:", PORT);
});
