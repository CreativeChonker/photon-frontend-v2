import React, { useState, useEffect } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Workspace from "./pages/Workspace";
import Assistant from "./pages/Assistant";
import Home from "./pages/Home";

function App() {
  const [code, setCode] = useState(() => {
    return localStorage.getItem("photon_code") || "";
  });

  useEffect(() => {
    localStorage.setItem("photon_code", code);
  }, [code]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/workspace" element={<Workspace code={code} setCode={setCode} />} />
        <Route path="/assistant" element={<Assistant code={code} setCode={setCode} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
