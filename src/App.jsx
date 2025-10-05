import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Workspace from './pages/Workspace';
import Assistant from './pages/Assistant';
import Login from './Login';
import Dashboard from './Dashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/assistant" element={<Assistant />} />
      </Routes>
    </Router>
  );
}

export default App;
