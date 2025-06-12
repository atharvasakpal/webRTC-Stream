import React, { useState, useRef, useEffect } from 'react';

const Dashboard = ({ socket, isConnected, clients }) => {
  const [isReceiving, setIsReceiving] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('waiting');
  const [debugInfo, setDebugInfo] = useState([]);
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // WebRTC configuration
  const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Debug logging function
  const addDebugLog = (message) => {
    console.log(`[Dashboard Debug] ${message}`);
    setDebugInfo(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    if (!socket) return;

    // Handle incoming offers from mobile devices
    socket.on('offer', async (data) => {
      try {
        addDebugLog('Received offer from mobile device');
        setError(null);
        setConnectionStatus('connecting');
        await handleOffer(data.offer, data.from);
      } catch (err) {
        console.error('Error handling offer:', err);
        addDebugLog(`Error handling offer: ${err.message}`);
        setError('Failed to connect to mobile device');
        setConnectionStatus('error');
      }
    });

    socket.on('ice-candidate', async (data) => {
      try {
        if (peerConnectionRef.current && data.candidate) {
          addDebugLog('Adding ICE candidate');
          await peerConnectionRef.current.addIceCandidate(data.candidate);
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
        addDebugLog(`ICE candidate error: ${err.message}`);
      }
    });

    socket.on('user-disconnected', (userId) => {
      addDebugLog('Mobile device disconnected');
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      setIsReceiving(false);
      setConnectionStatus('disconnected');
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    });

    return () => {
      socket.off('offer');
      socket.off('ice-candidate');
      socket.off('user-disconnected');
    };
  }, [socket]);

  const handleOffer = async (offer, fromId) => {
    try {
      addDebugLog('Creating peer connection');
      const pc = new RTCPeerConnection(config);
      peerConnectionRef.current = pc;

      // Handle incoming stream
      pc.ontrack = (event) => {
        addDebugLog(`Received ${event.streams.length} stream(s) with ${event.streams[0]?.getTracks().length} tracks`);
        
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          addDebugLog(`Stream tracks: ${stream.getTracks().map(t => t.kind).join(', ')}`);
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            
            // Add event listeners to video element
            videoRef.current.onloadedmetadata = () => {
              addDebugLog('Video metadata loaded');
              setIsReceiving(true);
              setConnectionStatus('connected');
            };
            
            videoRef.current.oncanplay = () => {
              addDebugLog('Video can play');
            };
            
            videoRef.current.onerror = (e) => {
              addDebugLog(`Video error: ${e.message || 'Unknown error'}`);
            };
            
            // Force play the video
            videoRef.current.play().catch(err => {
              addDebugLog(`Video play error: ${err.message}`);
            });
          }
        } else {
          addDebugLog('No streams received in ontrack event');
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          addDebugLog('Sending ICE candidate');
          socket.emit('ice-candidate', {
            candidate: event.candidate,
            to: fromId
          });
        } else if (!event.candidate) {
          addDebugLog('ICE gathering complete');
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        addDebugLog(`Connection state: ${pc.connectionState}`);
        switch (pc.connectionState) {
          case 'connected':
            setConnectionStatus('connected');
            break;
          case 'disconnected':
          case 'failed':
            setConnectionStatus('disconnected');
            setIsReceiving(false);
            addDebugLog('Connection failed or disconnected');
            break;
          case 'connecting':
            setConnectionStatus('connecting');
            break;
          default:
            break;
        }
      };

      // Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        addDebugLog(`ICE connection state: ${pc.iceConnectionState}`);
      };

      // Set remote description and create answer
      addDebugLog('Setting remote description');
      await pc.setRemoteDescription(offer);
      
      addDebugLog('Creating answer');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer back
      if (socket) {
        addDebugLog('Sending answer to mobile device');
        socket.emit('answer', {
          answer: answer,
          to: fromId
        });
      }

    } catch (err) {
      console.error('Error in handleOffer:', err);
      addDebugLog(`HandleOffer error: ${err.message}`);
      setError('Failed to establish connection');
      setConnectionStatus('error');
    }
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <div className="badge badge-success">Connected</div>;
      case 'connecting':
        return <div className="badge badge-warning">Connecting...</div>;
      case 'disconnected':
        return <div className="badge badge-error">Disconnected</div>;
      case 'error':
        return <div className="badge badge-error">Error</div>;
      default:
        return <div className="badge badge-neutral">Waiting for mobile device</div>;
    }
  };

  const mobileClients = clients.filter(client => client.type === 'mobile');
  const dashboardClients = clients.filter(client => client.type === 'dashboard');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Video Area */}
        <div className="lg:col-span-3">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex justify-between items-center mb-4">
                <h2 className="card-title">Live Stream</h2>
                {getStatusBadge()}
              </div>

              {error && (
                <div className="alert alert-error mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="aspect-video bg-base-300 rounded-lg overflow-hidden">
                {isReceiving ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={false}
                    controls
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-base-content/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <p className="text-lg font-semibold text-base-content/70">No Stream Available</p>
                      <p className="text-sm text-base-content/50 mt-2">
                        {connectionStatus === 'waiting' 
                          ? 'Waiting for mobile device to start streaming...'
                          : 'Connect a mobile device to start streaming'
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {isReceiving && (
                <div className="flex justify-center mt-4">
                  <div className="flex items-center gap-2 text-sm text-success">
                    <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                    Live
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="space-y-4">
            {/* Debug Info */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body p-4">
                <h3 className="font-semibold mb-3">Debug Log</h3>
                <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
                  {debugInfo.length > 0 ? (
                    debugInfo.map((log, index) => (
                      <div key={index} className="text-base-content/70">{log}</div>
                    ))
                  ) : (
                    <div className="text-base-content/50">No debug info yet</div>
                  )}
                </div>
              </div>
            </div>

            {/* Connection Info */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body p-4">
                <h3 className="font-semibold mb-3">Connection Info</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className={`font-semibold ${isConnected ? 'text-success' : 'text-error'}`}>
                      {isConnected ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stream:</span>
                    <span className={`font-semibold ${isReceiving ? 'text-success' : 'text-base-content/70'}`}>
                      {isReceiving ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>WebRTC:</span>
                    <span className={`font-semibold ${peerConnectionRef.current ? 'text-success' : 'text-base-content/70'}`}>
                      {peerConnectionRef.current ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Connected Devices */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body p-4">
                <h3 className="font-semibold mb-3">Connected Devices</h3>
                
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-base-content/80 mb-2">
                      Mobile Cameras ({mobileClients.length})
                    </div>
                    {mobileClients.length > 0 ? (
                      <div className="space-y-1">
                        {mobileClients.map((client, index) => (
                          <div key={client.id} className="flex items-center gap-2 p-2 bg-base-200 rounded">
                            <div className="w-2 h-2 bg-success rounded-full"></div>
                            <span className="text-sm">Camera {index + 1}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-base-content/50">No mobile cameras connected</div>
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-medium text-base-content/80 mb-2">
                      Dashboards ({dashboardClients.length})
                    </div>
                    {dashboardClients.length > 0 ? (
                      <div className="space-y-1">
                        {dashboardClients.map((client, index) => (
                          <div key={client.id} className="flex items-center gap-2 p-2 bg-base-200 rounded">
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                            <span className="text-sm">Dashboard {index + 1}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-base-content/50">No other dashboards</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body p-4">
                <h3 className="font-semibold mb-3">Instructions</h3>
                <div className="text-sm text-base-content/70 space-y-2">
                  <p>1. Open this URL on your mobile device</p>
                  <p>2. Allow camera permissions</p>
                  <p>3. Click "Start Camera" on mobile</p>
                  <p>4. Stream will appear here automatically</p>
                </div>
              </div>
            </div>

            {/* Quality Info */}
            {isReceiving && (
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body p-4">
                  <h3 className="font-semibold mb-3">Stream Quality</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Resolution:</span>
                      <span className="font-mono">Auto</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Protocol:</span>
                      <span className="font-mono">WebRTC</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Latency:</span>
                      <span className="font-mono text-success">Low</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Statistics */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat bg-base-100 rounded-lg shadow">
          <div className="stat-title">Total Connections</div>
          <div className="stat-value text-primary">{clients.length}</div>
          <div className="stat-desc">Active devices</div>
        </div>
        
        <div className="stat bg-base-100 rounded-lg shadow">
          <div className="stat-title">Stream Status</div>
          <div className={`stat-value ${isReceiving ? 'text-success' : 'text-base-content/50'}`}>
            {isReceiving ? 'Live' : 'Offline'}
          </div>
          <div className="stat-desc">Current state</div>
        </div>
        
        <div className="stat bg-base-100 rounded-lg shadow">
          <div className="stat-title">Connection</div>
          <div className={`stat-value ${isConnected ? 'text-success' : 'text-error'}`}>
            {isConnected ? 'Stable' : 'Lost'}
          </div>
          <div className="stat-desc">Server connection</div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;