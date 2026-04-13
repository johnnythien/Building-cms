import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartLine, faNewspaper, faFileAlt, faBell, 
  faComments, faVoteYea, faAngleLeft, faAngleRight, 
  faUser, faSignOutAlt, faMoneyBillWave
} from '@fortawesome/free-solid-svg-icons';

// Icon component for menu items
const Icon = ({ icon }) => <span className="menu-icon"><FontAwesomeIcon icon={icon} /></span>;

const MediaConsultingLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef();
  
  // Toggle sidebar on mobile
  const toggleMobileSidebar = () => {
    setMobileOpen(!mobileOpen);
  };
  
  // Toggle sidebar collapse state
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
    localStorage.setItem('sidebarCollapsed', !sidebarCollapsed);
  };
  
  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user || !user.fullName) return 'MC';
    const nameParts = user.fullName.split(' ');
    if (nameParts.length > 1) {
      return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
    }
    return nameParts[0][0].toUpperCase();
  };
  
  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/');
  };
  
  // Check if menu item is active
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };
  
  // Load sidebar collapsed state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState !== null) {
      setSidebarCollapsed(savedState === 'true');
    }
    // Close mobile sidebar when changing routes
    setMobileOpen(false);

    // Close sidebar on mobile when clicking outside
    const handleClickOutside = (event) => {
      if (mobileOpen && !event.target.closest('.sidebar') && !event.target.closest('.mobile-toggle')) {
        setMobileOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [location.pathname, mobileOpen]);
  
  useEffect(() => {
    function handleClickOutside(event) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Menu items for Media Consulting Manager
  const menuItems = [
    { path: '/media-consulting/dashboard', label: 'Dashboard', icon: faChartLine },
    { path: '/media-consulting/news', label: 'Quản lý Tin tức', icon: faNewspaper },
    { path: '/media-consulting/posts', label: 'Quản lý Bài viết', icon: faFileAlt },
    { path: '/media-consulting/notifications', label: 'Quản lý Thông báo', icon: faBell },
    { path: '/media-consulting/comments', label: 'Quản lý Góp ý', icon: faComments },
    { path: '/media-consulting/votes', label: 'Quản lý Biểu quyết', icon: faVoteYea },
  ];

  // Get current page title
  const getPageTitle = () => {
    if (location.pathname === '/media-consulting/profile') {
      return 'Thông tin cá nhân';
    }
    const currentItem = menuItems.find(item => isActive(item.path));
    return currentItem ? currentItem.label : 'Dashboard';
  };

  return (
    <div className="app-container">
      {/* Mobile toggle button */}
      <button 
        className="mobile-toggle d-md-none btn btn-primary position-fixed"
        style={{ bottom: '20px', right: '20px', zIndex: 1050, borderRadius: '50%', width: '50px', height: '50px' }}
        onClick={toggleMobileSidebar}
      >
        <FontAwesomeIcon icon={faAngleRight} />
      </button>
      
      {/* Sidebar */}
      <div className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo" style={{display:'flex', alignItems:'center', gap:10}}>
            <img src="/images/logo.jpg" alt="Nhom1-Building Logo" style={{height:36}} />
            {!sidebarCollapsed && (
              <span style={{fontWeight:700, fontSize:'1.0rem', verticalAlign:'middle'}}>Media Consulting</span>
            )}
          </div>
          <button className="sidebar-toggle" onClick={toggleSidebar}>
            <FontAwesomeIcon icon={sidebarCollapsed ? faAngleRight : faAngleLeft} />
          </button>
        </div>
        <div className="sidebar-menu">
          {menuItems.map((item, index) => (
            <Link 
              key={index} 
              to={item.path} 
              className={`menu-item ${isActive(item.path) ? 'active' : ''}`}
            >
              <Icon icon={item.icon} />
              <span className="menu-text">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
      
      {/* Main content area */}
      <div className={`content-wrapper ${sidebarCollapsed ? 'content-wrapper-expanded' : ''}`}>
        {/* Header */}
        <div className="app-header">
          <div className="app-title">
            {getPageTitle()}
          </div>
          <div className="header-actions">
            {/* User profile */}
            <div className="user-profile" ref={userDropdownRef} style={{ position: 'relative' }}>
              <button
                className="bg-transparent border-0 d-flex align-items-center"
                type="button"
                onClick={() => setShowUserDropdown((prev) => !prev)}
                style={{ cursor: 'pointer' }}
              >
                <div className="avatar">{getUserInitials()}</div>
                <div className="user-info">
                  <div className="user-name">{user?.fullName || 'Người dùng'}</div>
                  <div className="user-role">Quản lý Truyền thông - Tư vấn</div>
                </div>
              </button>
              {showUserDropdown && (
                <ul className="dropdown-menu dropdown-menu-end custom-avatar-dropdown show" style={{
                  display: 'block', position: 'absolute', right: 0, top: 50, minWidth: 210,
                  borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,0.12)', padding: '8px 0', marginTop: 10,
                  zIndex: 1000, background: '#fff'
                }}>
                  <li>
                    <button 
                      className="dropdown-item d-flex align-items-center gap-2 profile-btn" 
                      type="button"
                      onClick={() => { navigate('/media-consulting/profile'); setShowUserDropdown(false); }}
                    >
                      <FontAwesomeIcon icon={faUser} style={{color: '#d4a574'}} />
                      Thông tin cá nhân
                    </button>
                  </li>
                  <li>
                    <button 
                      className="dropdown-item d-flex align-items-center gap-2" 
                      type="button"
                      onClick={() => { navigate('/my-salary'); setShowUserDropdown(false); }}
                    >
                      <FontAwesomeIcon icon={faMoneyBillWave} style={{color: '#d4a574'}} />
                      Lương của tôi
                    </button>
                  </li>
                  <li>
                    <button 
                      className="dropdown-item d-flex align-items-center gap-2 logout-btn" 
                      onClick={handleLogout}
                      type="button"
                    >
                      <FontAwesomeIcon icon={faSignOutAlt} className="text-danger" />
                      Đăng xuất
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
        {/* Page content */}
        <main className="fade-in">
          <Outlet />
        </main>
      </div>
      <style jsx>{`
      .custom-avatar-dropdown { 
        min-width: 210px; 
        border-radius: 12px; 
        box-shadow: 0 6px 24px rgba(0,0,0,0.12); 
        padding: 8px 0; 
        margin-top: 10px; 
        border: none;
      }
      .custom-avatar-dropdown .dropdown-item { 
        border-radius: 8px; 
        transition: all 0.2s ease; 
        font-weight: 500; 
        padding: 10px 18px; 
        border: none;
      }
      .custom-avatar-dropdown .dropdown-item.profile-btn {
        color: #d4a574;
      }
      .custom-avatar-dropdown .dropdown-item.profile-btn:hover { 
        background: rgba(212, 165, 116, 0.1);
        color: #d4a574 !important; 
        transform: translateX(4px);
      }
      .custom-avatar-dropdown .dropdown-item.profile-btn:hover svg,
      .custom-avatar-dropdown .dropdown-item.profile-btn:hover path {
        color: #d4a574 !important;
        fill: #d4a574 !important;
      }
      .custom-avatar-dropdown .logout-btn:hover { 
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444 !important; 
        transform: translateX(4px);
      }
      .custom-avatar-dropdown .logout-btn:hover svg,
      .custom-avatar-dropdown .logout-btn:hover path {
        color: #ef4444 !important;
        fill: #ef4444 !important;
      }
      .avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #c9a961 0%, #d4a574 100%);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 14px;
        margin-right: 12px;
        box-shadow: 0 4px 12px rgba(212, 165, 116, 0.3);
      }
      .app-header {
        background: white;
        padding: 16px 24px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        border-bottom: 1px solid #f3f4f6;
      }
      .app-title {
        font-size: 24px;
        font-weight: 600;
        color: var(--text-primary);
      }
      `}</style>
    </div>
  );
};

export default MediaConsultingLayout;
