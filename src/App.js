import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Watch from "./watch";
import LiveBroadcastStudio from "./broadcast";
import "./App.css";

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Watch />} />
          <Route path="/broadcast" element={<LiveBroadcastStudio />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
