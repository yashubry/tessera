import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import EventsPage from './pages/EventsPage';
import EventDetail from './pages/EventDetail'; 

import { ColorModeProvider } from "./components/ui/color-mode";


function App() {
  return (
    <ChakraProvider>
      {/* <ColorModeProvider> */}
        <Router>
          <Navbar />
          <Routes>
            <Route path="/events" element={<EventsPage />} />
            <Route path="/" element={<Navigate to="/events" replace />} />
            <Route path="/events/:id" element={<EventDetail />} />
          </Routes>
        </Router>
      {/* </ColorModeProvider> */}
    </ChakraProvider>
  );
}



export default App;