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

  const API_BASE = 'http://localhost:5000';

  const initializeSocket = useCallback(() => {
    try {
      if (typeof io !== 'undefined') {
        socketRef.current = io(API_BASE);
        
        socketRef.current.on('connect', () => {
          console.log('Connected to server');
          setIsConnected(true);
        });

        socketRef.current.on('disconnect', () => {
          console.log('Disconnected from server');
          setIsConnected(false);
        });

        socketRef.current.on('voteUpdate', (newResults) => {
          console.log('Received vote update:', newResults);
          updateResults(newResults);
        });

        socketRef.current.on('connect_error', (error) => {
          console.log('Socket connection error:', error);
          setIsConnected(false);
          startPolling();
        });
      } else {
        console.log('Socket.io not available, using polling');
        setIsConnected(false);
        startPolling();
      }
    } catch (error) {
      console.log('Socket initialization failed, using polling fallback');
      setIsConnected(false);
      startPolling();
    }
  }, []);

  const startPolling = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    
    refreshIntervalRef.current = setInterval(() => {
      if (isLoggedIn) {
        fetchResults();
      }
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
    const response = await fetch(`${API_BASE}/results`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      updateResults(data.votes);
    } else {
      console.error('Failed to fetch results');
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
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ name: username.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentUser(username.trim());
        setIsLoggedIn(true);
        fetchResults();
      } else {
        setLoginError(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  const handleVote = async (option) => {
    if (hasVoted) {
      setVoteMessage({ type: 'warning', text: 'You have already voted!' });
      return;
    }

    if (!isLoggedIn) {
      setVoteError('Please log in first');
      return;
    }

    setIsVoting(true);
    setVoteError('');

    try {
      const response = await fetch(`${API_BASE}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ option })
      });

      const data = await response.json();

      if (response.ok) {
        setHasVoted(true);
        setVotedOption(option);
        setVoteMessage({ 
          type: 'success', 
          text: `Thanks for voting for Option ${option}!` 
        });
        setTimeout(() => fetchResults(), 500);
      } else {
        setVoteError(data.message || 'Vote failed');
      }
    } catch (error) {
      console.error('Vote error:', error);
      setVoteError('Connection error. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  useEffect(() => {
    if (loginError) {
      const timer = setTimeout(() => setLoginError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [loginError]);

  useEffect(() => {
    if (voteError) {
      const timer = setTimeout(() => setVoteError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [voteError]);

  useEffect(() => {
    if (voteMessage.text) {
      const timer = setTimeout(() => setVoteMessage({ type: '', text: '' }), 5000);
      return () => clearTimeout(timer);
    }
  }, [voteMessage]);

  useEffect(() => {
    initializeSocket();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [initializeSocket]);

  useEffect(() => {
    if (isLoggedIn && !isConnected) {
      startPolling();
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [isLoggedIn, isConnected, startPolling]);

  const chartData = [
    { name: 'Option A', votes: results.A, fill: '#667eea' },
    { name: 'Option B', votes: results.B, fill: '#764ba2' },
    { name: 'Option C', votes: results.C, fill: '#6366f1' },
  ];

  const getPercentage = (votes) => {
    return totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
  };

  return (
    <div className="voting-app">
      <div className="voting-container">
        <header className="voting-header">
          <h1 className="voting-title">
             Real-Time Voting App
          </h1>
          {isLoggedIn && (
            <div className="user-welcome">
              <span>Welcome, {currentUser}!</span>
            </div>
          )}
        </header>

        {!isLoggedIn && (
          <div className="voting-card">
            <h2 className="card-title">
              Login to Vote
            </h2>
            <div className="login-container">
              <div className="form-group">
                <label className="form-label">
                  Enter your name:
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Your name"
                  className="form-input"
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="btn btn-primary"
              >
                {isLoading ? (
                  <>
                    <div className="spinner"></div>
                    Joining...
                  </>
                ) : (
                  'Join Voting'
                )}
              </button>
              {loginError && (
                <div className="message error">
                  {loginError}
                </div>
              )}
            </div>
          </div>
        )}

        {isLoggedIn && (
          <div className="voting-card">
            <h2 className="card-title">
              Cast Your Vote
            </h2>
            <div className="voting-options">
              {['A', 'B', 'C'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleVote(option)}
                  disabled={hasVoted || isVoting}
                  className={`vote-option ${
                    votedOption === option
                      ? 'voted'
                      : hasVoted
                      ? 'disabled'
                      : ''
                  }`}
                >
                  <span className="option-label">Option {option}</span>
                  <span className="option-desc">Choice {option}</span>
                </button>
              ))}
            </div>

            {voteMessage.text && (
              <div className={`message ${voteMessage.type}`}>
                {voteMessage.text}
              </div>
            )}

            {voteError && (
              <div className="message error">
                {voteError}
              </div>
            )}
          </div>
        )}

        {isLoggedIn && (
          <div className="voting-card">
            <div className="results-header">
              <h2 className="card-title" style={{ marginBottom: 0 }}>
                Live Results
              </h2>
              <div className="results-info">
                <span className="total-votes">
                  Total Votes: <span className="total-count">{totalVotes}</span>
                </span>
                <div className="connection-status">
                  <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
                  <span>
                    {isConnected ? 'Live Updates' : 'Polling Mode'}
                  </span>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => {
                      const percentage = totalVotes > 0 ? ((value / totalVotes) * 100).toFixed(1) : 0;
                      return [`${value} votes (${percentage}%)`, 'Votes'];
                    }}
                  />
                  <Bar dataKey="votes" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="progress-section">
              {['A', 'B', 'C'].map((option) => (
                <div key={option} className="progress-row">
                  <span className="progress-label">
                    Option {option}
                  </span>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${getPercentage(results[option])}%` }}
                    ></div>
                  </div>
                  <span className="progress-count">
                    {results[option]}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer Info */}
            <div className="results-footer">
              <span>
                Last updated: {lastUpdated || 'Never'}
              </span>
              <button
                onClick={fetchResults}
                className="btn btn-secondary"
              >
                Refresh Now
              </button>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isVoting && (
          <div className="loading-overlay">
            <div className="loading-content">
              <div className="loading-spinner"></div>
              <p className="loading-text">Processing your vote...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VotingApp;