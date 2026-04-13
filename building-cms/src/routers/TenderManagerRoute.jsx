import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TenderManagerRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // Bước 1: Hiển thị loading trong khi đợi user được load
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Bước 2: Nếu chưa đăng nhập, redirect về login
  if (!user) {
    return <Navigate to="/login" />;
  }

  // Bước 3: Kiểm tra quyền - cho phép tender_manager và admin
  if (user.role === 'tender_manager' || user.role === 'admin') {
    return children;
  }

  // Bước 4: Nếu không có quyền, redirect về trang chủ
  return <Navigate to="/" />;
};

export default TenderManagerRoute;
