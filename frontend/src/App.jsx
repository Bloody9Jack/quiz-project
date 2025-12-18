import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

/* ===== SOCKET ===== */
const socket = io(import.meta.env.VITE_SOCKET_URL, {
  transports: ["websocket"],
  withCredentials: true,
});

/* ===== APP ===== */
export default function App() {
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

  /* ===== SOCKET EVENTS ===== */
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
      setAnswered(false);
      setSelectedIndex(null);
    });

    socket.on("answerResult", (data) => {
      setScores(data.scores);
      setAnswered(true);
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

  /* ===== TIMER ===== */
  useEffect(() => {
    if (seconds === null || seconds <= 0) return;

    const timer = setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds]);

  /* ===== ACTIONS ===== */
  const joinRoom = (e) => {
    e.preventDefault();
    if (!name || !room) return;
    socket.emit("joinRoom", room, name);
    setJoined(true);
  };

  const answer = (idx) => {
    if (answered) return;
    setAnswered(true);
    setSelectedIndex(idx);
    socket.emit("submitAnswer", room, idx);
  };

  /* ===== RENDER ===== */
  if (finalLeaderboard) {
    return (
      <div className="App">
        <h1>🏆 Leaderboard</h1>
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
      {!joined ? (
        <form onSubmit={joinRoom} className="join">
          <h1>Quiz</h1>

          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <input
            placeholder="Room ID"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            required
          />

          <button type="submit">Join</button>
        </form>
      ) : (
        <div className="game">
          <h2>Room: {room}</h2>

          {question ? (
            <>
              <p>⏳ Time left: {seconds}</p>
              <h3>{question}</h3>

              <div className="answers">
                {options.map((o, i) => (
                  <button
                    key={i}
                    disabled={answered}
                    className={
                      selectedIndex === i ? "answer selected" : "answer"
                    }
                    onClick={() => answer(i)}
                  >
                    {o}
                  </button>
                ))}
              </div>

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
        </div>
      )}
    </div>
  );
}
