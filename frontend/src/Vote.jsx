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

      socketRef.current.on('connect', () => {
        setIsConnected(true);
      });

      socketRef.current.on('disconnect', () => {
        setIsConnected(false);
      });

      socketRef.current.on('voteUpdate', (newResults) => {
        updateResults(newResults);
      });
    } catch (error) {
      console.error('Socket initialization failed:', error);
    }
  }, []);

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
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });

      if (response.ok) {
        const data = await response.json();
        updateResults(data.votes);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
    }
  }, [updateResults]);

  const handleLogin = async () => {
    if (!username.trim()) {
      setLoginError('Please enter your name');
      return;
    }

    setIsLoading(true);
    setLoginError('');

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: username.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token); // save JWT
        setCurrentUser(data.user);
        setIsLoggedIn(true);
        fetchResults();
      } else {
        setLoginError(data.message || 'Login failed');
      }
    } catch (error) {
      setLoginError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (option) => {
    if (hasVoted) {
      setVoteMessage({ type: 'warning', text: 'You already voted!' });
      return;
    }

    if (!isLoggedIn) {
      setVoteError('Please log in first');
      return;
    }

    setIsVoting(true);
    setVoteError('');

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ option })
      });

      const data = await response.json();

      if (response.ok) {
        setHasVoted(true);
        setVotedOption(option);
        setVoteMessage({ type: 'success', text: `Thanks for voting for Option ${option}!` });
        setTimeout(() => fetchResults(), 500);
      } else {
        setVoteError(data.message || 'Vote failed');
      }
    } catch (error) {
      setVoteError('Connection error. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  useEffect(() => {
    // auto-login if token exists
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      fetchResults();
    }
  }, [fetchResults]);

  useEffect(() => {
    initializeSocket();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [initializeSocket]);

  const chartData = [
    { name: 'Option A', votes: results.A, fill: '#667eea' },
    { name: 'Option B', votes: results.B, fill: '#764ba2' },
    { name: 'Option C', votes: results.C, fill: '#6366f1' },
  ];

  return (
    <div className="voting-app">
      <div className="voting-container">
        <header className="voting-header">
          <h1 className="voting-title">Real-Time Voting App</h1>
          {isLoggedIn && (
            <div className="user-welcome">
              <span>Welcome, {currentUser}!</span>
            </div>
          )}
        </header>

        {!isLoggedIn && (
          <div className="voting-card">
            <h2 className="card-title">Login to Vote</h2>
            <div className="login-container">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your name"
                className="form-input"
              />
              <button onClick={handleLogin} disabled={isLoading} className="btn btn-primary">
                {isLoading ? "Joining..." : "Join Voting"}
              </button>
              {loginError && <div className="message error">{loginError}</div>}
            </div>
          </div>
        )}

        {isLoggedIn && (
          <>
            <div className="voting-card">
              <h2 className="card-title">Cast Your Vote</h2>
              <div className="voting-options">
                {['A', 'B', 'C'].map((option) => (
                  <button
                    key={option}
                    onClick={() => handleVote(option)}
                    disabled={hasVoted || isVoting}
                    className={`vote-option ${votedOption === option ? 'voted' : ''}`}
                  >
                    Option {option}
                  </button>
                ))}
              </div>
              {voteMessage.text && <div className={`message ${voteMessage.type}`}>{voteMessage.text}</div>}
              {voteError && <div className="message error">{voteError}</div>}
            </div>

            <div className="voting-card">
              <h2 className="card-title">Live Results</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="votes" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div>Total Votes: {totalVotes}</div>
              <div>Last Updated: {lastUpdated || "Never"}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VotingApp;
