const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

/* ================= CONFIG ================= */
const PORT = process.env.PORT || 10000;
const QUESTIONS_LIMIT = 10;      // сколько вопросов в игре
const QUESTION_TIME = 10000;     // время на вопрос (мс)

/* ================= APP ================= */
const app = express();
const server = http.createServer(app);

app.use(cors());

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

/* ================= QUESTIONS ================= */
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

/* ================= ROOMS ================= */
const rooms = {};

/* ================= HELPERS ================= */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickQuestions(all, n) {
  return shuffle(all).slice(0, n);
}

/* ================= SOCKET ================= */
io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  socket.on("joinRoom", (roomId, name) => {
    if (!roomId || !name) return;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        questions: pickQuestions(questions, Math.min(QUESTIONS_LIMIT, questions.length)),
        qIndex: 0,
        timer: null,
        started: false,
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

    io.to(roomId).emit("scores", room.players.map(p => ({
      name: p.name,
      score: p.score,
    })));

    console.log(`Room ${roomId}: ${room.players.length} players`);

    if (room.players.length >= 2 && !room.started) {
      room.started = true;
      setTimeout(() => askQuestion(roomId), 300);
    }
  });

  socket.on("submitAnswer", (roomId, answerIndex) => {
    const room = rooms[roomId];
    if (!room || !room.started) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.answerIndex !== null) return;

    const idx = Number(answerIndex);
    if (!Number.isNaN(idx)) {
      player.answerIndex = idx;
    }
  });

  socket.on("disconnect", () => {
    console.log("DISCONNECT:", socket.id);

    for (const roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter(p => p.id !== socket.id);

      if (room.players.length === 0) {
        if (room.timer) clearTimeout(room.timer);
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
      leaderboard: room.players
        .map(p => ({ name: p.name, score: p.score }))
        .sort((a, b) => b.score - a.score),
    });

    delete rooms[roomId];
    return;
  }

  const q = room.questions[room.qIndex];
  const correctIndex = q.answers.findIndex(a => a.correct);

  room.players.forEach(p => p.answerIndex = null);

  io.to(roomId).emit("newQuestion", {
    question: q.question,
    answers: q.answers.map(a => a.text),
    timer: QUESTION_TIME / 1000,
  });

  room.timer = setTimeout(() => {
    room.players.forEach(p => {
      if (p.answerIndex === correctIndex) {
        p.score += 1;
      } else {
        p.score -= 1;
      }
    });

    io.to(roomId).emit("answerResult", {
      correctAnswer: correctIndex,
      scores: room.players.map(p => ({
        name: p.name,
        score: p.score,
      })),
    });

    room.qIndex += 1;
    setTimeout(() => askQuestion(roomId), 600);
  }, QUESTION_TIME);
}

/* ================= START SERVER ================= */
server.listen(PORT, () => {
  console.log(`SERVER running on ${PORT}`);
});