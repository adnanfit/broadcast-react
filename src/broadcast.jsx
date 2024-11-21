import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

import CONFIG from "./config";

const SOCKET_URL = CONFIG.SOCKET_URL;

function BroadcastPage() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectedViewers, setConnectedViewers] = useState(0);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [error, setError] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionsRef = useRef({});

  const RTCConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(SOCKET_URL);

    // Socket event listeners
    socketRef.current.on("connect", () => {
      console.log("Socket connected:", socketRef.current.id);
      initializeStream();
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setError("Failed to connect to server");
    });

    return () => {
      cleanup();
    };
  }, []);

  const initializeStream = async () => {
    try {
      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Register as broadcaster
      socketRef.current.emit("broadcaster");
      setIsInitialized(true);

      // Set up socket event listeners for WebRTC
      setupSocketListeners();
    } catch (err) {
      console.error("Error accessing media devices:", err);
      setError("Failed to access camera/microphone");
    }
  };

  const setupSocketListeners = () => {
    // Handle new viewer connection
    socketRef.current.on("watcher", (id) => {
      console.log("New viewer connected:", id);
      setConnectedViewers((prev) => prev + 1);

      const peerConnection = new RTCPeerConnection(RTCConfig);
      peerConnectionsRef.current[id] = peerConnection;

      // Add local tracks to the connection
      streamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, streamRef.current);
      });

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.emit("candidate", id, event.candidate);
        }
      };

      // Create and send offer
      peerConnection
        .createOffer()
        .then((sdp) => peerConnection.setLocalDescription(sdp))
        .then(() => {
          socketRef.current.emit("offer", id, peerConnection.localDescription);
        })
        .catch((err) => console.error("Error creating offer:", err));
    });

    // Handle answer from viewer
    socketRef.current.on("answer", (id, description) => {
      peerConnectionsRef.current[id]?.setRemoteDescription(description);
    });

    // Handle ICE candidate from viewer
    socketRef.current.on("candidate", (id, candidate) => {
      peerConnectionsRef.current[id]?.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    });

    // Handle viewer disconnect
    socketRef.current.on("disconnectPeer", (id) => {
      if (peerConnectionsRef.current[id]) {
        peerConnectionsRef.current[id].close();
        delete peerConnectionsRef.current[id];
        setConnectedViewers((prev) => prev - 1);
      }
    });
  };

  const cleanup = () => {
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Close all peer connections
    Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const stopBroadcast = () => {
    if (window.confirm("Are you sure you want to stop broadcasting?")) {
      cleanup();
      // Navigate to home or another page if needed
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Error</h2>
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Controls Overlay */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Media Controls */}
          <div className="flex gap-4">
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full transition-colors ${
                isVideoEnabled ? "bg-blue-500" : "bg-red-500"
              }`}
            >
              <svg
                className="w-6 h-6 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
              </svg>
            </button>

            <button
              onClick={toggleAudio}
              className={`p-3 rounded-full transition-colors ${
                isAudioEnabled ? "bg-blue-500" : "bg-red-500"
              }`}
            >
              <svg
                className="w-6 h-6 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
          </div>

          {/* Info and Stop Button */}
          <div className="flex items-center gap-4">
            <div className="bg-black/50 px-4 py-2 rounded-full">
              {connectedViewers} viewer{connectedViewers !== 1 && "s"}
            </div>

            <button
              onClick={stopBroadcast}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Stop Broadcasting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BroadcastPage;
