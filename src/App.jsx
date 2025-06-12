import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import MobileCamera from './components/MobileCamera.jsx';
import Dashboard from './components/Dashboard.jsx';

// Update the socket URL constant
// const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5050';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://192.168.1.93:5050';

function App() {
  const [socket, setSocket] = useState(null);
  const [deviceType, setDeviceType] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [clients, setClients] = useState([]);

  // Detect device type
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    setDeviceType(isMobile ? 'mobile' : 'dashboard');
  }, []);

  // Initialize socket connection
  useEffect(() => {
    if (!deviceType) return;

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      newSocket.emit('register', { type: deviceType });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('clients-update', (clientsList) => {
      setClients(clientsList);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [deviceType]);

  if (!deviceType) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <div className="navbar bg-primary text-primary-content">
        <div className="flex-1">
          <h1 className="text-xl font-bold">
            WebRTC Stream - {deviceType === 'mobile' ? 'Camera' : 'Dashboard'}
          </h1>
        </div>
        <div className="flex-none">
          <div className={`badge ${isConnected ? 'badge-success' : 'badge-error'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-4">
        {deviceType === 'mobile' ? (
          <MobileCamera socket={socket} isConnected={isConnected} />
        ) : (
          <Dashboard socket={socket} isConnected={isConnected} clients={clients} />
        )}
      </div>

      {/* Footer */}
      <footer className="footer footer-center p-4 bg-base-300 text-base-content">
        <div>
          <p>
            Connected clients: {clients.length} | 
            Status: {isConnected ? 'Online' : 'Offline'}
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;