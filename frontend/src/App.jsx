// src/App.jsx
import { ChakraProvider, Center, Spinner } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Navbar from './components/Navbar';
import EventsPage from './pages/EventsPage';
import EventDetail from './pages/EventDetail';
import Login from './pages/login';
import Registration from './pages/registration';
import Profile from './pages/Profile';
import HomePage from './pages/HomePage';

// Admin-only create page + user hook
import AdminEventCreate from './pages/AdminEventCreate';
import useMe from './hooks/useMe';

// (optional import you already had; not required to wrap here)
// import { ColorModeProvider } from "./components/ui/color-mode";

// Small wrapper that only renders children if the user is the admin email.
// Otherwise redirects to /login.
function AdminRoute({ children }) {
  const { loading, isAdmin } = useMe();

  if (loading) {
    return (
      <Center py={10}>
        <Spinner />
      </Center>
    );
  }
  return isAdmin ? children : <Navigate to="/login" replace />;
}

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

          {/* Admin */}
          <Route
            path="/admin/create-event"
            element={
              <AdminRoute>
                <AdminEventCreate />
              </AdminRoute>
            }
          />

          {/* Fallback: send anything unknown to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ChakraProvider>
  );
}

export default App;
