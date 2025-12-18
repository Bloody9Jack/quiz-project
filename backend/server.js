const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5003;

/* ================== CORS ================== */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
}));

/* ================== HEALTHCHECK ================== */
// ⚠️ ОБЯЗАТЕЛЬНО для Render
app.get("/", (req, res) => {
  res.send("QuizClash backend is running");
});

/* ================== SOCKET.IO ================== */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"], // ВАЖНО ДЛЯ RENDER
});

/* ================= QUESTIONS ================= */
const QUESTIONS_LIMIT = 5;
const QUESTION_TIME = 10000;

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
];

/* ================= ROOMS ================= */
const rooms = {};

/* ================= HELPERS ================= */
function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function pickQuestions(all, n) {
  return shuffle(all).slice(0, n);
}

/* ================= SOCKET LOGIC ================= */
io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  socket.on("joinRoom", (roomId, name) => {
    if (!roomId || !name) return;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        questions: pickQuestions(questions, QUESTIONS_LIMIT),
        qIndex: 0,
        started: false,
        timer: null,
      };
    }

    const room = rooms[roomId];

    if (!room.players.find(p => p.id === socket.id)) {
      room.players.push({
        id: socket.id,
        name,
        score: 0,
        answerIndex: null,
      });
    }

    io.to(roomId).emit("scores", room.players);

    if (room.players.length >= 2 && !room.started) {
      room.started = true;
      setTimeout(() => askQuestion(roomId), 500);
    }
  });

  socket.on("submitAnswer", (roomId, index) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.answerIndex !== null) return;

    player.answerIndex = Number(index);
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      rooms[roomId].players =
        rooms[roomId].players.filter(p => p.id !== socket.id);

      if (rooms[roomId].players.length === 0) {
        clearTimeout(rooms[roomId].timer);
        delete rooms[roomId];
      }
    }
  });
});

/* ================= GAME FLOW ================= */
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
  const correctIndex = q.answers.findIndex(a => a.correct);

  room.players.forEach(p => (p.answerIndex = null));

  io.to(roomId).emit("newQuestion", {
    question: q.question,
    answers: q.answers.map(a => a.text),
    timer: QUESTION_TIME / 1000,
  });

  room.timer = setTimeout(() => {
    room.players.forEach(p => {
      if (p.answerIndex === correctIndex) p.score += 1;
      else p.score -= 1;
    });

    io.to(roomId).emit("answerResult", {
      correctAnswer: correctIndex,
      scores: room.players,
    });

    room.qIndex++;
    setTimeout(() => askQuestion(roomId), 800);
  }, QUESTION_TIME);
}

/* ================= START ================= */
server.listen(PORT, () => {
  console.log("SERVER RUNNING ON", PORT);
});
