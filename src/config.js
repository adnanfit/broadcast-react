// src/config.js
const CONFIG = {
  SOCKET_URL: process.env.REACT_APP_SOCKET_URL || "http://localhost:5001",

  ICE_SERVERS: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
  ICE_CANDIDATE_POOL_SIZE: 10,
  BUNDLE_POLICY: "max-bundle",
};

export default CONFIG;
