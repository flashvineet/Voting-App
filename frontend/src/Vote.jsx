import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { io } from "socket.io-client";
import './Vote.css';

const VotingApp = () => {
  const [currentUser, setCurrentUser] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [votedOption, setVotedOption] = useState(null);
  const [username, setUsername] = useState('');
  const [results, setResults] = useState({ A: 0, B: 0, C: 0 });
  const [totalVotes, setTotalVotes] = useState(0);
  const [lastUpdated, setLastUpdated] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [voteError, setVoteError] = useState('');
  const [voteMessage, setVoteMessage] = useState({ type: '', text: '' });

  const socketRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const initializeSocket = useCallback(() => {
    try {
      socketRef.current = io(API_BASE, {
        transports: ["websocket", "polling"]
      });

      socketRef.current.on('connect', () => setIsConnected(true));
      socketRef.current.on('disconnect', () => setIsConnected(false));
      socketRef.current.on('voteUpdate', (newResults) => updateResults(newResults));
      socketRef.current.on('connect_error', () => startPolling());
    } catch {
      startPolling();
    }
  }, []);

  const startPolling = useCallback(() => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    refreshIntervalRef.current = setInterval(() => {
      if (isLoggedIn) fetchResults();
    }, 5000);
  }, [isLoggedIn]);

  const updateResults = useCallback((newResults) => {
    setResults(newResults);
    const total = newResults.A + newResults.B + newResults.C;
    setTotalVotes(total);
    setLastUpdated(new Date().toLocaleTimeString());
  }, []);

  const fetchResults = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/results`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        updateResults(data.votes);
      }
    } catch (error) {
      console.error("Error fetching results:", error);
    }
  }, [updateResults]);

  const handleLogin = async () => {
    if (!username.trim()) {
      setLoginError('Please enter your name');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: username.trim() })
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("token", data.token);
        setCurrentUser(username.trim());
        setIsLoggedIn(true);
        fetchResults();
      } else {
        setLoginError(data.message || "Login failed");
      }
    } catch {
      setLoginError("Connection error. Please try again.");
    }
    setIsLoading(false);
  };

  const handleVote = async (option) => {
    if (hasVoted) {
      setVoteMessage({ type: "warning", text: "You already voted!" });
      return;
    }
    const token = localStorage.getItem("token");
    setIsVoting(true);
    try {
      const response = await fetch(`${API_BASE}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ option }),
      });
      const data = await response.json();
      if (response.ok) {
        setHasVoted(true);
        setVotedOption(option);
        setVoteMessage({ type: "success", text: `Thanks for voting for Option ${option}!` });
        fetchResults();
      } else {
        setVoteError(data.message || "Vote failed");
      }
    } catch {
      setVoteError("Connection error. Please try again.");
    }
    setIsVoting(false);
  };

  useEffect(() => {
    initializeSocket();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [initializeSocket]);

  const chartData = [
    { name: "Option A", votes: results.A, fill: "#667eea" },
    { name: "Option B", votes: results.B, fill: "#764ba2" },
    { name: "Option C", votes: results.C, fill: "#6366f1" },
  ];

  return (
    <div className="voting-app">
      <h1>Real-Time Voting App</h1>
      {!isLoggedIn ? (
        <div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter name"
          />
          <button onClick={handleLogin} disabled={isLoading}>
            {isLoading ? "Joining..." : "Join Voting"}
          </button>
          {loginError && <p style={{ color: "red" }}>{loginError}</p>}
        </div>
      ) : (
        <div>
          <h2>Welcome, {currentUser}!</h2>
          <div>
            {["A", "B", "C"].map((opt) => (
              <button
                key={opt}
                onClick={() => handleVote(opt)}
                disabled={hasVoted || isVoting}
              >
                Vote {opt}
              </button>
            ))}
          </div>
          {voteMessage.text && <p>{voteMessage.text}</p>}
          {voteError && <p style={{ color: "red" }}>{voteError}</p>}
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="votes" />
            </BarChart>
          </ResponsiveContainer>
          <p>Total Votes: {totalVotes}</p>
        </div>
      )}
    </div>
  );
};

export default VotingApp;
