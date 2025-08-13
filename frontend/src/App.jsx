import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import EventsPage from './pages/EventsPage';
import EventDetail from './pages/EventDetail'; 
import Login from './pages/login';
import Registration from './pages/registration';
import Profile from './pages/Profile';
import HomePage from "./pages/HomePage";
import { ColorModeProvider } from "./components/ui/color-mode";


function App() {
  return (
    <ChakraProvider>
      <Router>
        <Navbar />
        <Routes>
          {/* Home */}
          <Route path="/" element={<HomePage />} />

          {/* Events */}
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:id" element={<EventDetail />} />

          {/* Auth / Profile */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/user/profile" element={<Profile />} />

          {/* Fallback: send anything unknown to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ChakraProvider>
  );
}

export default App;