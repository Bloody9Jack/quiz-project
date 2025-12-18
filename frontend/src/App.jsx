// App.jsx
import React, { useState, useEffect } from 'react';
import './App.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_SOCKET_URL, {
  transports: ["websocket"],
});

function App() {
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [joined, setJoined] = useState(false);

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState([]);
  const [seconds, setSeconds] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [answered, setAnswered] = useState(false);

  const [scores, setScores] = useState([]);
  const [finalLeaderboard, setFinalLeaderboard] = useState(null);
  const [myId, setMyId] = useState(null);

  useEffect(() => {
    socket.on('connect', () => setMyId(socket.id));

    socket.on('message', (m) => {
      toast.info(String(m));
    });

    socket.on('newQuestion', (data) => {
      setQuestion(data.question);
      setOptions(data.answers || []);
      setSeconds(data.timer ?? null);
      setSelectedIndex(null);
      setAnswered(false);
    });

    socket.on('answerResult', (data) => {
      // update scores display
      if (data.scores) setScores(data.scores);

      // personal result: find my result in data.results
      if (data.results && myId) {
        const me = data.results.find(r => r.id === myId);
        if (me) {
          if (me.isCorrect) toast.success('Correct! +1');
          else toast.error('Wrong or no answer. -1');
        }
      }
    });

    socket.on('gameFinished', (data) => {
      if (data.leaderboard) setFinalLeaderboard(data.leaderboard);
    });

    return () => {
      socket.off('connect');
      socket.off('message');
      socket.off('newQuestion');
      socket.off('answerResult');
      socket.off('gameFinished');
    };
  }, [myId]);

  // timer countdown
  useEffect(() => {
    if (typeof seconds !== 'number') return;
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!name || !room) return;
    socket.emit('joinRoom', room, name);
    setJoined(true);
  };

  const handleAnswer = (idx) => {
    if (answered) return;
    setSelectedIndex(idx);
    setAnswered(true);
    // send numeric index
    socket.emit('submitAnswer', room, idx);
  };

  if (finalLeaderboard) {
  const winner = finalLeaderboard[0];

  return (
    <div className="App leaderboard-screen">
      <h1 className="leaderboard-title">Leaderboard</h1>

      <div className="winner-card">
        <div className="winner-label">WINNER</div>
        <div className="winner-name">{winner.name}</div>
        <div className="winner-score">{winner.score} pts</div>
      </div>

      <div className="leaderboard-list">
        {finalLeaderboard.map((p, i) => (
          <div
            key={i}
            className={`leaderboard-row ${i === 0 ? 'winner-row' : ''}`}
          >
            <span className="rank">#{i + 1}</span>
            <span className="player">{p.name}</span>
            <span className="score">{p.score}</span>
          </div>
        ))}
      </div>
      <span className='forgivness'>с наступающим блин</span>
    </div>
  );
}


  return (
    <div className="App">
      {!joined ? (
        <div className="join-div">
          <h1>pre-New Year's Quiz</h1>
          <form onSubmit={handleJoin}>
            <input required placeholder="Enter your name" value={name} onChange={e => setName(e.target.value)} />
            <input required placeholder="Enter room no" value={room} onChange={e => setRoom(e.target.value)} />
            <button type="submit">JOIN</button>
          </form>
          <div className="snow">
  {Array.from({ length: 40 }).map((_, i) => (
    <span
      key={i}
      style={{
        left: `${Math.random() * 100}%`,
        animationDuration: `${5 + Math.random() * 5}s`,
        animationDelay: `${Math.random() * 5}s`,
      }}
    />
  ))}
  <div className="bottom-decor">
  <div className="lights">
    {Array.from({ length: 8 }).map((_, i) => (
      <span key={i} />
    ))}
  </div>
  <div className="trees">
  <div className="tree small" />
  <div className="tree" />
  <div className="tree big" />
  <div className="tree" />
  <div className="tree small" />
</div>

</div>

</div>

        </div>
      ) : (
        <div>
          <h1>QuizClash</h1>
          <p>Room: {room}</p>
          <ToastContainer />
          {question ? (
            <div className="quiz-div">
              <p>Remaining Time: {seconds}</p>
              <div className="question"><p>{question}</p></div>
              <ul>
                {options.map((opt, i) => (
                  <li key={i}>
                    <button
                      disabled={answered}
                      className={selectedIndex === i ? 'selected' : 'answer-btn' }
                      onClick={() => handleAnswer(i)}
                    >
                      {opt}
                    </button>
                  </li>
                ))}
              </ul>

              <div className="scores">
                <h3>Scores</h3>
                {scores.map(s => <div key={s.name}>{s.name}: {s.score}</div>)}
              </div>
            </div>
          ) : (
            <div>
              <p>Waiting for question...</p>
              <div className="scores">
                <h3>Scores</h3>
                {scores.map(s => <div key={s.name}>{s.name}: {s.score}</div>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
