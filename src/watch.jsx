import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import CONFIG from "./config";

const SOCKET_URL = CONFIG.SOCKET_URL;

function WatchPage() {
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [isMuted, setIsMuted] = useState(true);
  const [error, setError] = useState(null);

  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const RTCConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on("connect", () => {
      console.log("Socket connected:", socketRef.current.id);
      socketRef.current.emit("watcher");
    });

    socketRef.current.on("broadcaster-disconnected", () => {
      setConnectionStatus("disconnected");
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    });

    // Set up socket event listeners
    setupSocketListeners();

    return () => {
      cleanup();
    };
  }, []);

  const setupSocketListeners = () => {
    // Handle offer from broadcaster
    socketRef.current.on("offer", (id, description) => {
      peerConnectionRef.current = new RTCPeerConnection(RTCConfig);

      peerConnectionRef.current.ontrack = (event) => {
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
          setConnectionStatus("connected");
        }
      };

      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.emit("candidate", id, event.candidate);
        }
      };

      peerConnectionRef.current
        .setRemoteDescription(description)
        .then(() => peerConnectionRef.current.createAnswer())
        .then((sdp) => peerConnectionRef.current.setLocalDescription(sdp))
        .then(() => {
          socketRef.current.emit(
            "answer",
            id,
            peerConnectionRef.current.localDescription
          );
        })
        .catch((err) => {
          console.error("Error handling offer:", err);
          setError("Failed to connect to broadcast");
        });
    });

    // Handle ICE candidate from broadcaster
    socketRef.current.on("candidate", (id, candidate) => {
      peerConnectionRef.current
        ?.addIceCandidate(new RTCIceCandidate(candidate))
        .catch((err) => console.error("Error adding ICE candidate:", err));
    });
  };

  const cleanup = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
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
        muted={isMuted}
        className="w-full h-full object-cover"
      />

      {/* Connection Status */}
      <div className="absolute top-5 left-5 bg-black/70 px-4 py-2 rounded-full text-white">
        {connectionStatus === "connecting"
          ? "Connecting..."
          : connectionStatus === "connected"
          ? "Connected"
          : "Disconnected"}
      </div>

      {/* Controls */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-2 rounded-full">
        <button onClick={toggleMute} className="text-white">
          {isMuted ? "Unmute" : "Mute"}
        </button>
      </div>

      {/* Connection Message */}
      {connectionStatus !== "connected" && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="text-white text-center">
            <h2 className="text-2xl font-bold mb-4">
              {connectionStatus === "connecting"
                ? "Connecting to broadcast..."
                : "Broadcast ended"}
            </h2>
          </div>
        </div>
      )}
    </div>
  );
}

export default WatchPage;
