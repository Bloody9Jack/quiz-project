import React, { useState, useEffect } from "react";
import "./App.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_SOCKET_URL, {
  transports: ["websocket"],
  withCredentials: true,
});

function App() {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [joined, setJoined] = useState(false);

  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [time, setTime] = useState(null);

  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState(null);

  const [scores, setScores] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);

  /* ================= SOCKET ================= */

  useEffect(() => {
    socket.on("question", (data) => {
      setQuestion(data.question);
      setAnswers(data.answers);
      setTime(data.time);
      setAnswered(false);
      setSelected(null);
    });

    socket.on("result", (data) => {
      setScores(data.scores);

      const me = data.scores.find((p) => p.name === name);
      if (me) {
        toast.info(`Your score: ${me.score}`);
      }
    });

    socket.on("gameFinished", (data) => {
      setLeaderboard(data.leaderboard);
    });

    return () => {
      socket.off("question");
      socket.off("result");
      socket.off("gameFinished");
    };
  }, [name]);

  /* ================= TIMER ================= */

  useEffect(() => {
    if (time === null) return;
    if (time <= 0) return;

    const t = setInterval(() => {
      setTime((v) => (v > 0 ? v - 1 : 0));
    }, 1000);

    return () => clearInterval(t);
  }, [time]);

  /* ================= ACTIONS ================= */

  const join = (e) => {
    e.preventDefault();
    socket.emit("joinRoom", { roomId: room, name });
    setJoined(true);
  };

  const answer = (idx) => {
    if (answered) return;
    setAnswered(true);
    setSelected(idx);
    socket.emit("answer", { roomId: room, index: idx });
  };

  /* ================= RENDER ================= */

  if (leaderboard) {
    return (
      <div className="App">
        <h1>Leaderboard</h1>
        {leaderboard.map((p, i) => (
          <div key={i}>
            {i + 1}. {p.name} — {p.score}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="App">
      <ToastContainer />

      {!joined ? (
        <form onSubmit={join}>
          <h1>QuizClash</h1>
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            placeholder="Room"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            required
          />
          <button>Join</button>
        </form>
      ) : (
        <>
          <h2>Room: {room}</h2>

          {question ? (
            <>
              <p>Time left: {time}</p>
              <h3>{question}</h3>
              {answers.map((a, i) => (
                <button
                  key={i}
                  disabled={answered}
                  className={selected === i ? "selected" : ""}
                  onClick={() => answer(i)}
                >
                  {a}
                </button>
              ))}

              <h3>Scores</h3>
              {scores.map((s) => (
                <div key={s.name}>
                  {s.name}: {s.score}
                </div>
              ))}
            </>
          ) : (
            <p>Waiting for players / question…</p>
          )}
        </>
      )}
    </div>
  );
}

export default App;
