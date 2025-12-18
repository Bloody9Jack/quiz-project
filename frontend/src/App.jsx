// App.jsx
import React, { useState, useEffect } from "react";
import "./App.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_SOCKET_URL);

function App() {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [joined, setJoined] = useState(false);

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState([]);
  const [seconds, setSeconds] = useState(null);

  const [selectedIndex, setSelectedIndex] = useState(null);
  const [answered, setAnswered] = useState(false);

  const [scores, setScores] = useState([]);
  const [finalLeaderboard, setFinalLeaderboard] = useState(null);

  /* ================= SOCKET ================= */
  useEffect(() => {
    socket.on("connect", () => {
      console.log("CONNECTED:", socket.id);
    });

    socket.on("scores", (list) => {
      setScores(list);
    });

    socket.on("newQuestion", (data) => {
      setQuestion(data.question);
      setOptions(data.answers);
      setSeconds(data.timer);
      setSelectedIndex(null);
      setAnswered(false);
    });

    socket.on("answerResult", (data) => {
      setScores(data.scores);
    });

    socket.on("gameFinished", (data) => {
      setFinalLeaderboard(data.leaderboard);
    });

    return () => {
      socket.off("connect");
      socket.off("scores");
      socket.off("newQuestion");
      socket.off("answerResult");
      socket.off("gameFinished");
    };
  }, []);

  /* ================= TIMER ================= */
  useEffect(() => {
    if (typeof seconds !== "number" || seconds <= 0) return;
    const t = setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [seconds]);

  /* ================= ACTIONS ================= */
  const handleJoin = (e) => {
    e.preventDefault();
    socket.emit("joinRoom", room, name);
    setJoined(true);
  };

  const handleAnswer = (idx) => {
    if (answered) return;
    setAnswered(true);
    setSelectedIndex(idx);
    socket.emit("submitAnswer", room, idx);
  };

  /* ================= RENDER ================= */
  if (finalLeaderboard) {
    return (
      <div className="App">
        <h1>Leaderboard</h1>
        {finalLeaderboard.map((p, i) => (
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
        <form onSubmit={handleJoin}>
          <h1>Quiz</h1>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <input value={room} onChange={(e) => setRoom(e.target.value)} required />
          <button>Join</button>
        </form>
      ) : (
        <>
          <h2>Room: {room}</h2>

          {question ? (
            <>
              <p>Time left: {seconds}</p>
              <h3>{question}</h3>

              {options.map((o, i) => (
                <button
                  key={i}
                  disabled={answered}
                  className={selectedIndex === i ? "selected" : ""}
                  onClick={() => handleAnswer(i)}
                >
                  {o}
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
            <p>Waiting for question…</p>
          )}
        </>
      )}
    </div>
  );
}

export default App;
