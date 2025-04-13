import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import AccountsList from './pages/AccountsList';
import AccountDetails from './pages/AccountDetails';
import AddAccount from './pages/AddAccount';
import NotFound from './pages/NotFound';
import './styles/App.css';

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navbar />
          <main className="container">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route 
                path="/accounts" 
                element={
                  <ProtectedRoute>
                    <AccountsList />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/accounts/:id" 
                element={
                  <ProtectedRoute>
                    <AccountDetails />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/add-account" 
                element={
                  <ProtectedRoute>
                    <AddAccount />
                  </ProtectedRoute>
                } 
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;