import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import useChatStore from './store/useChatStore';
import EmojiPicker from 'emoji-picker-react';

const socket = io('http://localhost:5000');

function Chat() {
  const {
    currentUser,
    selectedUser,
    messages,
    setMessages,
    addMessage,
    setCurrentUser,
    setSelectedUser,
  } = useChatStore();

  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [darkMode, setDarkMode] = useState(false);
  const messagesEndRef = useRef(null);

  // Theme colors
  const theme = {
    light: {
      background: '#ffffff',
      secondaryBackground: '#f9f9f9',
      headerBackground: '#f5f5f5',
      text: '#333333',
      secondaryText: '#888888',
      border: '#e0e0e0',
      sentMessage: '#dcf8c6',
      receivedMessage: '#ffffff',
      buttonPrimary: '#4CAF50',
      buttonSecondary: '#f0f0f0',
      shadow: 'rgba(0,0,0,0.1)',
      selectedChat: '#e6f7ff',
      unreadBadge: '#ff4d4f',
    },
    dark: {
      background: '#1a1a1a',
      secondaryBackground: '#2a2a2a',
      headerBackground: '#262626',
      text: '#e0e0e0',
      secondaryText: '#a0a0a0',
      border: '#444444',
      sentMessage: '#056162',
      receivedMessage: '#2a2a2a',
      buttonPrimary: '#45a049',
      buttonSecondary: '#3a3a3a',
      shadow: 'rgba(0,0,0,0.3)',
      selectedChat: '#333f48',
      unreadBadge: '#e74c3c',
    }
  };

  // Get current theme
  const currentTheme = darkMode ? theme.dark : theme.light;

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Apply dark/light mode to body
  useEffect(() => {
    document.body.style.backgroundColor = currentTheme.background;
    document.body.style.color = currentTheme.text;
    
    // Check user preference on first load
    const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDarkMode) {
      setDarkMode(true);
    }
  }, [darkMode, currentTheme.background, currentTheme.text]);

  useEffect(() => {
    if (!currentUser) return;

    socket.emit('join', currentUser);

    // Get all users
    socket.emit('get-users');

    socket.on('users-list', (users) => {
      // Filter out current user and sort: online first, then alphabetically
      const filteredUsers = users
        .filter(user => user.username !== currentUser)
        .sort((a, b) => {
          // Sort by online status first
          if (a.isOnline !== b.isOnline) {
            return a.isOnline ? -1 : 1;
          }
          // Then sort alphabetically
          return a.username.localeCompare(b.username);
        });
      
      setAllUsers(filteredUsers);
    });

    socket.on('user-connected', (username) => {
      if (username !== currentUser) {
        socket.emit('get-users'); // Refresh user list
      }
    });

    socket.on('user-disconnected', (username) => {
      socket.emit('get-users'); // Refresh user list
    });

    socket.on('unread-counts', (counts) => {
      setUnreadCounts(counts);
    });

    socket.on('private-message', (msg) => {
      addMessage(msg);
      
      // If message is incoming and we have the sender's chat open, mark as read immediately
      if (msg.sender === selectedUser && msg.receiver === currentUser) {
        socket.emit('mark-read', {
          reader: currentUser,
          sender: selectedUser,
        });
      } else if (msg.sender !== currentUser && msg.receiver === currentUser) {
        // Update unread count for this sender
        setUnreadCounts(prev => ({
          ...prev,
          [msg.sender]: (prev[msg.sender] || 0) + 1
        }));
        
        // Play notification sound for new message
        playNotificationSound();
      }
    });

    // Listen for read receipts
    socket.on('messages-read', ({ reader }) => {
      // Update UI when someone reads our messages
      if (reader === selectedUser) {
        setMessages(messages.map(msg => 
          msg.sender === currentUser && msg.receiver === reader ? { ...msg, read: true } : msg
        ));
      }
    });

    socket.on('error', (error) => {
      console.error("Socket error:", error.message);
      alert(error.message);
    });

    return () => {
      socket.off('private-message');
      socket.off('messages-read');
      socket.off('users-list');
      socket.off('user-connected');
      socket.off('user-disconnected');
      socket.off('unread-counts');
      socket.off('error');
    };
  }, [currentUser, selectedUser, messages]);

  useEffect(() => {
    if (currentUser && selectedUser) {
      // Fetch message history
      socket.emit('get-messages', {
        user1: currentUser,
        user2: selectedUser,
      });
  
      // Listen for chat history
      socket.on('chat-history', (msgs) => {
        setMessages(msgs);
      });
  
      // Mark messages from selectedUser as read
      socket.emit('mark-read', {
        reader: currentUser,
        sender: selectedUser,
      });
      
      // Reset unread count for selected user
      setUnreadCounts(prev => ({
        ...prev,
        [selectedUser]: 0
      }));
  
      return () => {
        socket.off('chat-history');
      };
    }
  }, [selectedUser]);
  
  const sendMessage = () => {
    if (message.trim()) {
      socket.emit('private-message', {
        sender: currentUser,
        receiver: selectedUser,
        text: message,
      });
      setMessage('');
    }
  };

  const playNotificationSound = () => {
    // Create a simple beep sound for notifications
    const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU');
    audio.play().catch(err => console.log('Audio play error:', err));
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatLastSeen = (date) => {
    const now = new Date();
    const lastSeen = new Date(date);
    
    const diffMs = now - lastSeen;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHrs < 24) return `${diffHrs} hr ago`;
    if (diffDays < 7) return `${diffDays} day ago`;
    
    return lastSeen.toLocaleDateString();
  };

  const handleUserRegistration = (e) => {
    e.preventDefault();
    const username = e.target.username.value.trim();
    if (username) {
      localStorage.setItem('currentUser', username);
      setCurrentUser(username);
      socket.emit('register-user', username);
    }
  };

  // Toggle dark/light mode
  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  if (!currentUser) {
    return (
      <div style={{ 
        maxWidth: 400, 
        margin: '100px auto', 
        padding: 20,
        boxShadow: `0 0 10px ${currentTheme.shadow}`,
        borderRadius: 8,
        backgroundColor: currentTheme.background,
        color: currentTheme.text
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ textAlign: 'center', margin: 0 }}>Welcome to Chat App</h2>
          <button
            onClick={toggleTheme}
            style={{
              padding: '5px 10px',
              backgroundColor: currentTheme.buttonSecondary,
              color: currentTheme.text,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
        <form onSubmit={handleUserRegistration}>
          <input 
            name="username"
            style={{ 
              width: '100%', 
              padding: 10, 
              marginBottom: 10, 
              borderRadius: 4,
              border: `1px solid ${currentTheme.border}`,
              backgroundColor: currentTheme.secondaryBackground,
              color: currentTheme.text
            }} 
            placeholder="Enter your username"
          />
          <button 
            type="submit"
            style={{
              width: '100%',
              padding: 10,
              backgroundColor: currentTheme.buttonPrimary,
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Join Chat
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh',
      width: '100%',
      overflow: 'hidden',
      backgroundColor: currentTheme.background,
      color: currentTheme.text
    }}>
      {/* Left sidebar - Users list */}
      
      <div style={{ 
        width: 280, 
        borderRight: `1px solid ${currentTheme.border}`,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: currentTheme.background
      }}>
        <div style={{ 
          padding: 15, 
          borderBottom: `1px solid ${currentTheme.border}`,
          backgroundColor: currentTheme.headerBackground,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0 }}> {currentUser}</h3>
          <button
            onClick={toggleTheme}
            style={{
              padding: '5px 10px',
              backgroundColor: currentTheme.buttonSecondary,
              color: currentTheme.text,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
        
        <div style={{ padding: 10, color: currentTheme.text }}>
          <h4 style={{ margin: '5px 0' }}>Users ({allUsers.length})</h4>
        </div>
        <div className="search-container">
            <div className="search-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search users..."
                className="search-input"
              />
            </div>
          </div>
        
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {allUsers.map((user) => (
            <div 
              key={user.username} 
              onClick={() => setSelectedUser(user.username)}
              style={{ 
                padding: '10px 15px',
                cursor: 'pointer',
                backgroundColor: selectedUser === user.username ? currentTheme.selectedChat : 'transparent',
                borderBottom: `1px solid ${currentTheme.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'relative', marginRight: 10 }}>
                  <img
                    src={`https://ui-avatars.com/api/?name=${user.username}&background=random`}
                    alt={user.username}
                    style={{ width: 40, height: 40, borderRadius: '50%' }}
                  />
                  {user.isOnline && (
                    <span style={{ 
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 12,
                      height: 12,
                      backgroundColor: '#4CAF50',
                      borderRadius: '50%',
                      border: `2px solid ${currentTheme.background}`
                    }}></span>
                  )}
                </div>
                <div>
                  <div style={{ color: currentTheme.text }}>{user.username}</div>
                  <div style={{ fontSize: 12, color: currentTheme.secondaryText }}>
                    {user.isOnline ? 'Online' : `Last seen ${formatLastSeen(user.lastSeen)}`}
                  </div>
                </div>
              </div>
              
              {unreadCounts[user.username] > 0 && (
                <span style={{ 
                  backgroundColor: currentTheme.unreadBadge, 
                  color: 'white', 
                  borderRadius: '50%', 
                  minWidth: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 'bold',
                  padding: '0 6px'
                }}>
                  {unreadCounts[user.username]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right side - Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedUser ? (
          <>
            <div style={{ 
              padding: 15,
              borderBottom: `1px solid ${currentTheme.border}`,
              backgroundColor: currentTheme.headerBackground,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'relative', marginRight: 10 }}>
                  <img
                    src={`https://ui-avatars.com/api/?name=${selectedUser}&background=random`}
                    alt={selectedUser}
                    style={{ width: 40, height: 40, borderRadius: '50%' }}
                  />
                  {allUsers.find(u => u.username === selectedUser)?.isOnline && (
                    <span style={{ 
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 12,
                      height: 12,
                      backgroundColor: '#4CAF50',
                      borderRadius: '50%',
                      border: `2px solid ${currentTheme.headerBackground}`
                    }}></span>
                  )}
                </div>
                <div>
                  <h3 style={{ margin: 0, color: currentTheme.text }}>{selectedUser}</h3>
                  <div style={{ fontSize: 12, color: currentTheme.secondaryText }}>
                    {allUsers.find(u => u.username === selectedUser)?.isOnline 
                      ? 'Online' 
                      : `Last seen ${formatLastSeen(allUsers.find(u => u.username === selectedUser)?.lastSeen)}`}
                  </div>
                </div>
              </div>
            </div>
            
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: 15,
              backgroundColor: currentTheme.secondaryBackground
            }}>
              {messages.length === 0 ? (
                <div style={{ 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexDirection: 'column',
                  color: currentTheme.secondaryText
                }}>
                  <img
                    src={`https://ui-avatars.com/api/?name=${selectedUser}&size=80&background=random`}
                    alt={selectedUser}
                    style={{ borderRadius: '50%', marginBottom: 10 }}
                  />
                  <p>No messages yet. Say hello!</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  // Group consecutive messages from same sender
                  const isFirstInGroup = i === 0 || messages[i-1].sender !== msg.sender;
                  const isLastInGroup = i === messages.length - 1 || messages[i+1].sender !== msg.sender;
                  
                  return (
                    <div key={i} style={{ 
                      display: 'flex', 
                      justifyContent: msg.sender === currentUser ? 'flex-end' : 'flex-start',
                      marginBottom: isLastInGroup ? 10 : 2
                    }}>
                      <div style={{ 
                        maxWidth: '70%',
                        backgroundColor: msg.sender === currentUser ? currentTheme.sentMessage : currentTheme.receivedMessage,
                        borderRadius: 8,
                        padding: '8px 12px',
                        boxShadow: `0 1px 2px ${currentTheme.shadow}`,
                        position: 'relative',
                        color: msg.sender === currentUser && darkMode ? '#e0e0e0' : currentTheme.text
                      }}>
                        {isFirstInGroup && msg.sender !== currentUser && (
                          <div style={{ 
                            fontWeight: 'bold', 
                            fontSize: 12, 
                            marginBottom: 2, 
                            color: currentTheme.secondaryText 
                          }}>
                            {msg.sender}
                          </div>
                        )}
                        <div style={{ wordBreak: 'break-word' }}>{msg.text}</div>
                        <div style={{ 
                          fontSize: 11, 
                          color: currentTheme.secondaryText, 
                          marginTop: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end'
                        }}>
                          {formatTime(msg.timestamp)}
                          {msg.sender === currentUser && (
                            <span style={{ 
                              marginLeft: 4, 
                              color: msg.read ? '#4CAF50' : currentTheme.secondaryText 
                            }}>
                              {msg.read ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <div style={{ 
              padding: 10,
              borderTop: `1px solid ${currentTheme.border}`,
              backgroundColor: currentTheme.background,
              display: 'flex',
              position: 'relative'
            }}>
              <input
                style={{ 
                  flex: 1, 
                  padding: 10,
                  borderRadius: 20,
                  border: `1px solid ${currentTheme.border}`,
                  marginRight: 10,
                  backgroundColor: currentTheme.secondaryBackground,
                  color: currentTheme.text
                }}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type message..."
              />
              <button 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                style={{ 
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: currentTheme.buttonSecondary,
                  marginRight: 10,
                  cursor: 'pointer'
                }}
              >
                😀
              </button>
              <button 
                onClick={sendMessage}
                style={{ 
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: currentTheme.buttonPrimary,
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                ➤
              </button>
              
              {showEmojiPicker && (
                <div style={{ position: 'absolute', bottom: 60, right: 10, zIndex: 10 }}>
                  <EmojiPicker
                    onEmojiClick={(emojiData) => setMessage(message + emojiData.emoji)}
                    theme={darkMode ? 'dark' : 'light'}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: currentTheme.secondaryBackground,
            flexDirection: 'column'
          }}>
            <img 
              src="https://ui-avatars.com/api/?name=Chat&size=128&background=random" 
              alt="Select a chat"
              style={{ marginBottom: 20, borderRadius: '50%' }}
            />
            <h2 style={{ color: currentTheme.secondaryText }}>Select a user to start chatting</h2>
            <p style={{ color: currentTheme.secondaryText }}>
              {allUsers.length === 0 
                ? 'No other users registered yet.' 
                : 'Click on a user from the sidebar to start a conversation.'}  
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;