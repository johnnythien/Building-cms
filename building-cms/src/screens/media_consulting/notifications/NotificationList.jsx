import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faPlus, faEye, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import callApi from '../../../apis/handleApi';
import useMediaConsultingPath from '../../../hooks/useMediaConsultingPath';
import '../MediaConsulting.css';

const normalizeString = (str) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
};

const notificationTypes = [
  'Chung',
  'Khẩn Cấp',
  'Sự kiện',
  'Bảo trì',
  'Vệ sinh',
  'Thanh toán phí',
  'An ninh',
  'Cuộc họp',
  'Cảnh báo thời tiết',
  'Giới thiệu dịch vụ',
  'Mất đồ / Tìm đồ',
];

const truncateTitle = (title) => {
  if (!title) return '';
  if (title.length <= 40) return title;
  return title.substring(0, 40) + '...';
};

const NotificationList = () => {
  const basePath = useMediaConsultingPath();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortOption, setSortOption] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    fetchNotifications();
    if (location.state?.successMessage) {
      toast.success(location.state.successMessage);
    }
  }, [location.state]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await callApi('/notifications');
      const allNotifications = Array.isArray(response) ? response : [];
      
      // Lọc ra các thông báo cũ (phiên bản đã được chỉnh sửa và có phiên bản mới hơn)
      // Một thông báo được coi là cũ nếu nó có editedToId VÀ editedToId đó KHÔNG phải là ID của chính nó
      // (tức là editedToId trỏ đến một thông báo khác - phiên bản mới hơn)
      const editedIds = new Set();
      
      allNotifications.forEach(n => {
        // Chỉ coi là "phiên bản cũ" nếu editedToId trỏ đến một ID khác (không phải chính nó)
        if (n.editedToId && n.editedToId !== n.id) {
          editedIds.add(n.id);
        }
      });
      
      // Lọc: loại bỏ các thông báo là phiên bản cũ (có editedToId trỏ đến thông báo khác)
      // và các thông báo không active
      const latestNotifications = allNotifications.filter(n => {
        const isOldVersion = editedIds.has(n.id);
        const isInactive = n.isActive === false;
        return !isOldVersion && !isInactive;
      });
      
      setNotifications(latestNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Không thể tải danh sách thông báo');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm('Bạn có chắc chắn muốn xóa thông báo này không?');
    if (!confirmDelete) return;
    try {
      await callApi(`/notifications/${id}`, null, 'delete');
      setNotifications(prev => prev.filter(n => n.id !== id));
      setSelectedIds(prev => prev.filter(i => i !== id));
      toast.success('Xóa thông báo thành công!');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Không thể xóa thông báo');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một thông báo để xóa.');
      return;
    }
    const confirmDelete = window.confirm('Bạn có chắc chắn muốn xóa các thông báo đã chọn?');
    if (confirmDelete) {
      try {
        await Promise.all(selectedIds.map(id => callApi(`/notifications/${id}`, null, 'delete')));
        setNotifications(prev => prev.filter(n => !selectedIds.includes(n.id)));
        setSelectedIds([]);
        toast.success('Đã xóa các thông báo đã chọn!');
      } catch (error) {
        console.error('Error bulk deleting notifications:', error);
        toast.error('Không thể xóa một số thông báo');
      }
    }
  };

  const handleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(displayNotifications.map((n) => n.id));
    } else {
      setSelectedIds([]);
    }
  };

  let displayNotifications = notifications;

  if (searchQuery) {
    displayNotifications = displayNotifications.filter(
      (n) =>
        normalizeString(n.title || '').includes(normalizeString(searchQuery)) ||
        normalizeString(n.type || '').includes(normalizeString(searchQuery))
    );
  }
  if (filterType) {
    displayNotifications = displayNotifications.filter((n) => n.type === filterType);
  }
  if (filterDate) {
    displayNotifications = displayNotifications.filter((n) => {
      const notificationDate = new Date(n.sendDate).toISOString().split('T')[0];
      return notificationDate === filterDate;
    });
  }
  if (filterStatus) {
    displayNotifications = displayNotifications.filter((n) => {
      const now = new Date();
      const isSent = n.sendDate && new Date(n.sendDate) <= now;
      return filterStatus === 'sent' ? isSent : !isSent;
    });
  }
  if (!sortOption || sortOption === 'newest') {
    displayNotifications = [...displayNotifications].sort((a, b) => new Date(b.sendDate) - new Date(a.sendDate));
  } else if (sortOption === 'oldest') {
    displayNotifications = [...displayNotifications].sort((a, b) => new Date(a.sendDate) - new Date(b.sendDate));
  } else if (sortOption === 'a-z') {
    displayNotifications = [...displayNotifications].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (sortOption === 'z-a') {
    displayNotifications = [...displayNotifications].sort((a, b) => (b.title || '').localeCompare(a.title || ''));
  }

  if (loading) {
    return (
      <div className="mc-spinner">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mc-news-list-container mc-fade-in">
      {/* Page Header */}
      <div className="mc-page-header">
        <h1 className="mc-page-title" style={{margin: 0, color: '#2a3f54', fontSize: '1.75rem', fontWeight: 600}}>
          Danh sách Thông Báo
        </h1>
        <div className="mc-btn-group">
          <Link to={`${basePath}/notifications/create`} className="mc-btn mc-btn-success">
            <FontAwesomeIcon icon={faPlus} />
            Tạo mới
          </Link>
          {selectedIds.length > 0 && (
            <button className="mc-btn mc-btn-danger" onClick={handleDeleteSelected}>
              <FontAwesomeIcon icon={faTrash} />
              Xóa {selectedIds.length} thông báo
            </button>
          )}
        </div>
      </div>

      {/* Filter Section */}
      <div className="mc-filter-section">
        <input
          type="text"
          className="mc-form-control mb-3"
          placeholder="Tìm kiếm theo tiêu đề hoặc loại..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="mc-filter-row">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="mc-form-control"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="mc-form-select"
          >
            <option value="">Chọn loại</option>
            {notificationTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="mc-form-select"
          >
            <option value="">Chọn trạng thái</option>
            <option value="sent">Đã gửi</option>
            <option value="not-sent">Chưa gửi</option>
          </select>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="mc-form-select"
          >
            <option value="">Sắp xếp</option>
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="a-z">A-Z</option>
            <option value="z-a">Z-A</option>
          </select>
        </div>
        <div className="mt-3 d-flex align-items-center gap-3">
          <label style={{ margin: 0, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={selectedIds.length === displayNotifications.length && displayNotifications.length > 0}
              onChange={handleSelectAll}
              className="me-2"
            />
            Chọn tất cả
          </label>
        </div>
      </div>

      {displayNotifications.length === 0 ? (
        <div className="mc-empty-container">
          <div className="mc-empty-icon">
            <FontAwesomeIcon icon={faBell} />
          </div>
          <div className="mc-empty-title">Chưa có thông báo nào</div>
          <div className="mc-empty-text">Chưa có thông báo phù hợp với bộ lọc của bạn</div>
        </div>
      ) : (
        <div className="mc-data-card">
          <div className="mc-table-wrapper">
            <table className="mc-table">
              <thead>
                <tr>
                  <th style={{ width: '5%' }}></th>
                  <th style={{ width: '30%' }}>Tiêu đề</th>
                  <th style={{ width: '10%' }}>Loại</th>
                  <th style={{ width: '20%' }}>Ngày gửi</th>
                  <th style={{ width: '15%' }}>Trạng thái</th>
                  <th style={{ width: '20%' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {displayNotifications.map((n) => {
                  const isSent = n.sendDate && new Date(n.sendDate) <= new Date();
                  return (
                    <tr key={n.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(n.id)}
                          onChange={() => handleSelect(n.id)}
                        />
                      </td>
                      <td><strong>{truncateTitle(n.title)}</strong></td>
                      <td>{n.type}</td>
                      <td>{n.sendDate ? new Date(n.sendDate).toLocaleString('vi-VN') : 'Chưa gửi'}</td>
                      <td>
                        <span className={isSent ? 'mc-badge mc-badge-approved' : 'mc-badge mc-badge-pending'}>
                          {isSent ? 'Đã gửi' : 'Chưa gửi'}
                        </span>
                      </td>
                      <td>
                        <div className="mc-action-buttons">
                          <Link to={`${basePath}/notifications/${n.id}`} className="mc-btn-icon mc-btn-icon-view" title="Xem">
                            <FontAwesomeIcon icon={faEye} />
                          </Link>
                          <Link to={`${basePath}/notifications/edit/${n.id}`} className="mc-btn-icon mc-btn-icon-edit" title="Sửa">
                            <FontAwesomeIcon icon={faEdit} />
                          </Link>
                          <button onClick={() => handleDelete(n.id)} className="mc-btn-icon mc-btn-icon-delete" title="Xóa">
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationList;

