import React from 'react';
import { useAuth } from '../context/AuthContext';
import './ProfileScreen.css';

export const ProfileContent = () => {
  const { user } = useAuth();

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>Thông tin cá nhân</h1>
      </div>
      
      <div className="profile-content">
        <div className="profile-card">
          <div className="profile-avatar">
            <div className="avatar-circle">
              {user?.fullName?.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
          </div>
          
          <div className="profile-info">
            <div className="info-group">
              <label>Họ và tên</label>
              <div className="info-value">{user?.fullName || 'Chưa cập nhật'}</div>
            </div>
            
            <div className="info-group">
              <label>Email</label>
              <div className="info-value">{user?.email || 'Chưa cập nhật'}</div>
            </div>
            
            <div className="info-group">
              <label>Vai trò</label>
              <div className="info-value">
                {user?.role === 'admin' ? 'Quản trị viên' : 
                 user?.role === 'manager' ? 'Quản lý' : 
                 user?.role === 'tender_manager' ? 'Quản lý đấu thầu' : 
                 user?.role === 'media_consulting_manager' ? 'Quản lý Truyền thông - Tư vấn' : 'Chưa cập nhật'}
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
};

// ProfileScreen component - không wrap MainLayout vì MainRouter đã wrap rồi
const ProfileScreen = () => {
  return <ProfileContent />;
};

export default ProfileScreen;