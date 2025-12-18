const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;

app.use(cors({
  origin: "*",
}));

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

/* ===== DATA ===== */
const QUESTION_TIME = 8000;
const rooms = {};
const questions = [
  {
    question: "Largest ocean?",
    answers: [
      { text: "Atlantic", correct: false },
      { text: "Pacific", correct: true },
    ],
  },
];

io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  socket.on("joinRoom", ({ roomId, name }) => {
    socket.join(roomId);

    rooms[roomId] ??= { players: [], index: 0 };

    rooms[roomId].players.push({
      id: socket.id,
      name,
      score: 0,
      answer: null,
    });

    if (rooms[roomId].players.length >= 2) {
      sendQuestion(roomId);
    }
  });

  socket.on("answer", ({ roomId, index }) => {
    const player = rooms[roomId]?.players.find(p => p.id === socket.id);
    if (player) player.answer = index;
  });
});

function sendQuestion(roomId) {
  const room = rooms[roomId];
  const q = questions[room.index];

  io.to(roomId).emit("question", {
    question: q.question,
    answers: q.answers.map(a => a.text),
    time: QUESTION_TIME / 1000,
  });

  setTimeout(() => {
    room.players.forEach(p => {
      if (q.answers[p.answer]?.correct) p.score++;
    });

    io.to(roomId).emit("result", { scores: room.players });
  }, QUESTION_TIME);
}

server.listen(PORT, "0.0.0.0", () => {
  console.log("SERVER running on", PORT);
});
