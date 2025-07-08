import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import EventsPage from './pages/EventsPage';
import EventDetail from './pages/EventDetail'; 
import Login from './pages/login';
import Registration from './pages/registration';
import Profile from './pages/Profile';

import { ColorModeProvider } from "./components/ui/color-mode";


function App() {
  return (
    <ChakraProvider>
      {/* <ColorModeProvider> */}
        <Router>
          <Navbar />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/user/profile" element={<Profile />} />
            <Route path="/register" element={<Registration />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/events/:id" element={<EventDetail />} />
          </Routes>
        </Router>
      {/* </ColorModeProvider> */}
    </ChakraProvider>
  );
}



export default App;