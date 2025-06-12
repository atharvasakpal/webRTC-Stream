import React, { useState, useRef, useEffect } from 'react';

const MobileCamera = ({ socket, isConnected }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('user'); // 'user' or 'environment'
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // WebRTC configuration
  const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    if (!socket) return;

    // Handle incoming requests for offers
    socket.on('answer', async (data) => {
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(data.answer);
        }
      } catch (err) {
        console.error('Error setting remote description:', err);
        setError('Failed to establish connection');
      }
    });

    socket.on('ice-candidate', async (data) => {
      try {
        if (peerConnectionRef.current && data.candidate) {
          await peerConnectionRef.current.addIceCandidate(data.candidate);
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    });

    return () => {
      socket.off('answer');
      socket.off('ice-candidate');
    };
  }, [socket]);

  const startCamera = async () => {
    try {
      setError(null);
      
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsStreaming(true);
      
      // Create WebRTC connection
      await createPeerConnection(stream);
      
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError(`Camera access failed: ${err.message}`);
    }
  };

  const createPeerConnection = async (stream) => {
    try {
      const pc = new RTCPeerConnection(config);
      peerConnectionRef.current = pc;

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', {
            candidate: event.candidate
          });
        }
      };

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      if (socket) {
        socket.emit('offer', { offer });
      }

    } catch (err) {
      console.error('Error creating peer connection:', err);
      setError('Failed to create connection');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsStreaming(false);
  };

  const switchCamera = async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    
    if (isStreaming) {
      stopCamera();
      setTimeout(() => startCamera(), 500);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Mobile Camera</h2>
          
          {error && (
            <div className="alert alert-error">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="aspect-video bg-base-300 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                className={`btn flex-1 ${isStreaming ? 'btn-error' : 'btn-success'}`}
                onClick={isStreaming ? stopCamera : startCamera}
                disabled={!isConnected}
              >
                {isStreaming ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10h6v4H9z" />
                    </svg>
                    Stop Camera
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Start Camera
                  </>
                )}
              </button>
              
              <button
                className="btn btn-outline"
                onClick={switchCamera}
                disabled={!isConnected}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            <div className="text-sm text-base-content/70 text-center">
              Camera: {facingMode === 'user' ? 'Front' : 'Back'}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-sm text-base-content/60 text-center">
        <p>Make sure your dashboard is open on another device to view the stream.</p>
        <p className="mt-2">Status: {isStreaming ? 'Streaming' : 'Stopped'}</p>
      </div>
    </div>
  );
};

export default MobileCamera;