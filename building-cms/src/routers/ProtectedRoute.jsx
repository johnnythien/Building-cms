import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // Hiển thị loading state
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Kiểm tra đăng nhập
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Trả về children nếu đã đăng nhập
  return children;
};

export default ProtectedRoute; 