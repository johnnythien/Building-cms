import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ManagerRoute = ({ children }) => {
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
    return <Navigate to="/login" />;
  }
  // Kiểm tra quyền Manager/Admin
  if (user.role !== 'manager' && user.role !== 'admin') {
    return <Navigate to="/unauthorized" />;
  }

  // Trả về children nếu có quyền
  return children;
};

export default ManagerRoute; 