const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5003; // ← ВАЖНО

app.use(cors());

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// ... ВЕСЬ ОСТАЛЬНОЙ КОД

server.listen(PORT, () => {
  console.log(`SERVER running on ${PORT}`);
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
  // добавь остальные вопросы сюда
];

/* ================= ROOMS ================= */
const rooms = {};

/* ================= HELPERS ================= */
function shuffle(array) {
  const arr = [...array]; // не мутируем оригинал
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
  console.log("CONNECTED", socket.id);

  socket.on("joinRoom", (roomId, name) => {
    if (!roomId || !name) return;
    socket.join(roomId);
    console.log(`Socket ${socket.id} join ${roomId} as ${name}`);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        questions: pickQuestions(questions, Math.min(QUESTIONS_LIMIT, questions.length)),
        qIndex: 0,
        timer: null,
        started: false,
      };
    }

    // avoid duplicates for same socket
    const already = rooms[roomId].players.find(p => p.id === socket.id);
    if (!already) {
      rooms[roomId].players.push({
        id: socket.id,
        name,
        score: 0,
        answerIndex: null, // store numeric index or null
      });
    }

    io.to(roomId).emit("message", `${name} joined`);

    // start when >= 2 players and not started
    if (rooms[roomId].players.length >= 2 && !rooms[roomId].started) {
      rooms[roomId].started = true;
      // small delay to let clients subscribe
      setTimeout(() => askQuestion(roomId), 300);
    }
  });

  // player submits answer index (number or numeric string)
  socket.on("submitAnswer", (roomId, answerIndex) => {
    const room = rooms[roomId];
    if (!room || !room.started) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    // only first answer counts for the question
    if (player.answerIndex !== null) return;

    const idx = Number(answerIndex);
    if (!Number.isNaN(idx) && Number.isFinite(idx)) {
      // validate bounds
      const q = room.questions[room.qIndex];
      if (q && idx >= 0 && idx < q.answers.length) {
        player.answerIndex = idx;
      } else {
        // invalid index -> ignore (leave null)
        player.answerIndex = null;
      }
    } else {
      // not numeric -> ignore (leave null)
      player.answerIndex = null;
    }

    console.log(`Room ${roomId}: player ${player.name} answered ${player.answerIndex}`);
  });

  socket.on("disconnect", () => {
    console.log("DISCONNECT", socket.id);
    for (const roomId of Object.keys(rooms)) {
      const room = rooms[roomId];
      const before = room.players.length;
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length !== before) {
        io.to(roomId).emit("message", `A player left`);
      }
      if (room.players.length === 0) {
        if (room.timer) clearTimeout(room.timer);
        delete rooms[roomId];
        console.log(`Room ${roomId} removed (empty)`);
      }
    }
  });
});

/* ================= GAME FLOW ================= */
function askQuestion(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  // if finished
if (room.qIndex >= room.questions.length || room.qIndex >= QUESTIONS_LIMIT) {
  if (room.timer) clearTimeout(room.timer);

  // 🔒 ФИКСИРУЕМ leaderboard
  const leaderboard = room.players
    .map(p => ({
      name: p.name,
      score: p.score,
    }))
    .sort((a, b) => b.score - a.score);

  // 🏁 ОТПРАВЛЯЕМ ОДИН РАЗ
  io.to(roomId).emit("gameFinished", {
    leaderboard,
  });

  console.log("FINAL LEADERBOARD:", leaderboard);

  // 🧹 УДАЛЯЕМ КОМНАТУ ПОСЛЕ ОТПРАВКИ
  setTimeout(() => {
    delete rooms[roomId];
  }, 1000);

  return;
}

  const q = room.questions[room.qIndex];
  const correctIndex = q.answers.findIndex(a => a.correct === true);

  // reset stored answers for this question
  room.players.forEach(p => (p.answerIndex = null));

  // send question
  io.to(roomId).emit("newQuestion", {
    question: q.question,
    answers: q.answers.map(a => a.text),
    timer: Math.floor(QUESTION_TIME / 1000),
  });

  // schedule scoring when timer expires
  if (room.timer) clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    // scoring
    const results = room.players.map(p => {
      const chosen = p.answerIndex;
      const isCorrect = (typeof chosen === "number") && (chosen === correctIndex);
      if (isCorrect) {
        p.score += 1;
      } else {
        p.score -= 1;
      }
      return {
        id: p.id,
        name: p.name,
        answerIndex: p.answerIndex,
        isCorrect,
        score: p.score,
      };
    });

    // emit results + updated scores + correct index
    io.to(roomId).emit("answerResult", {
      correctAnswer: correctIndex,
      results,
      scores: room.players.map(p => ({ name: p.name, score: p.score })),
    });

    // next question (advance index THEN call next)
    room.qIndex += 1;
    // small pause before next question to give clients time to show result
    setTimeout(() => askQuestion(roomId), 600);
  }, QUESTION_TIME);
}

