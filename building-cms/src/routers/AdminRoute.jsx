import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // Bước 1: Chờ loading xong đã
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Bước 2: Nếu chưa có user => redirect về login
  if (!user) {
    return <Navigate to="/login" />;
  }

  // Bước 3: Kiểm tra quyền admin
  if (user.role === 'admin') {
    return children;
  }

  // Nếu không phải admin => redirect về trang chủ
  return <Navigate to="/" />;
};

export default AdminRoute;
