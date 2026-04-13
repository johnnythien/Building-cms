import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HomeScreen = () => {
  const { user, isAuthenticated } = useAuth();

  // Xác định đường dẫn dashboard dựa trên quyền người dùng
  const getDashboardPath = () => {
    if (!user) return '/login';
    
    if (user.role === 'admin') return '/admin/dashboard';
    if (user.role === 'tender_manager') return '/tender/dashboard';
    return '/manager/dashboard';
  };
}

export default HomeScreen;