import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faEye, faTrash, faReply } from '@fortawesome/free-solid-svg-icons';
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

const commentTypes = [
  'Vệ sinh và Môi trường',
  'An ninh và An toàn',
  'Kỹ thuật và Bảo trì',
  'Tiện ích Chung',
  'Phí Dịch vụ và Tài chính',
  'Quy định và Nội quy',
  'Thái độ Nhân viên và Dịch vụ Quản lý',
  'Giao tiếp và Thông tin',
  'Khác',
];

const truncateTitle = (title) => {
  if (!title) return '';
  if (title.length <= 40) return title;
  return title.substring(0, 40) + '...';
};

const CommentList = () => {
  const basePath = useMediaConsultingPath();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFeedbackCount, setFilterFeedbackCount] = useState('');
  const [sortOption, setSortOption] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    fetchComments();
    if (location.state?.successMessage) {
      toast.success(location.state.successMessage);
    }
  }, [location.state]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await callApi('/comments');
      const allComments = Array.isArray(response) ? response : [];
      const visibleComments = allComments.filter((c) => !c.isDeletedByAdmin);
      setComments(visibleComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Không thể tải danh sách góp ý');
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm('Bạn có chắc chắn muốn xóa góp ý này không?');
    if (!confirmDelete) return;
    try {
      await callApi(`/comments/${id}`, { isDeletedByAdmin: true }, 'put');
      setComments(prev => prev.filter(c => c.id !== id));
      setSelectedIds(prev => prev.filter(i => i !== id));
      toast.success('Xóa góp ý thành công!');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Không thể xóa góp ý');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một góp ý để xóa.');
      return;
    }
    const confirmDelete = window.confirm('Bạn có chắc chắn muốn xóa các góp ý đã chọn?');
    if (confirmDelete) {
      try {
        await Promise.all(selectedIds.map(id => callApi(`/comments/${id}`, { isDeletedByAdmin: true }, 'put')));
        setComments(prev => prev.filter(c => !selectedIds.includes(c.id)));
        setSelectedIds([]);
        toast.success('Đã xóa các góp ý đã chọn!');
      } catch (error) {
        console.error('Error bulk deleting comments:', error);
        toast.error('Không thể xóa một số góp ý');
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
      setSelectedIds(displayComments.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  let displayComments = comments;

  if (searchQuery) {
    displayComments = displayComments.filter(
      (c) =>
        normalizeString(c.title || '').includes(normalizeString(searchQuery)) ||
        normalizeString(c.creator || '').includes(normalizeString(searchQuery)) ||
        normalizeString(c.type || '').includes(normalizeString(searchQuery))
    );
  }
  if (filterType) {
    displayComments = displayComments.filter((c) => c.type === filterType);
  }
  if (filterDate) {
    displayComments = displayComments.filter((c) => {
      const commentDate = new Date(c.createdAt).toISOString().split('T')[0];
      return commentDate === filterDate;
    });
  }
  if (filterStatus) {
    displayComments = displayComments.filter((c) => {
      if (filterStatus === 'resolved') return c.status === 'resolved';
      if (filterStatus === 'pending') return c.status === 'pending';
      return true;
    });
  }
  if (filterFeedbackCount) {
    const count = parseInt(filterFeedbackCount);
    displayComments = displayComments.filter((c) => {
      const feedbackCount = c.feedbacks?.length || 0;
      if (filterFeedbackCount === '0') return feedbackCount === 0;
      if (filterFeedbackCount === '1-5') return feedbackCount >= 1 && feedbackCount <= 5;
      if (filterFeedbackCount === '6-10') return feedbackCount >= 6 && feedbackCount <= 10;
      if (filterFeedbackCount === '10+') return feedbackCount > 10;
      return true;
    });
  }
  if (!sortOption || sortOption === 'newest') {
    displayComments = [...displayComments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sortOption === 'oldest') {
    displayComments = [...displayComments].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (sortOption === 'a-z') {
    displayComments = [...displayComments].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (sortOption === 'z-a') {
    displayComments = [...displayComments].sort((a, b) => (b.title || '').localeCompare(a.title || ''));
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
          Danh sách Góp Ý
        </h1>
      </div>

      {/* Filter Section */}
      <div className="mc-filter-section">
        <input
          type="text"
          className="mc-form-control mb-3"
          placeholder="Tìm kiếm theo tiêu đề, người tạo hoặc loại..."
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
            {commentTypes.map((type) => (
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
            <option value="resolved">Đã xử lý</option>
            <option value="pending">Chờ xử lý</option>
          </select>
          <select
            value={filterFeedbackCount}
            onChange={(e) => setFilterFeedbackCount(e.target.value)}
            className="mc-form-select"
          >
            <option value="">Số lượng phản hồi</option>
            <option value="0">0</option>
            <option value="1-5">1-5</option>
            <option value="6-10">6-10</option>
            <option value="10+">10+</option>
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
              checked={selectedIds.length === displayComments.length && displayComments.length > 0}
              onChange={handleSelectAll}
              className="me-2"
            />
            Chọn tất cả
          </label>
          {selectedIds.length > 0 && (
            <button className="mc-btn mc-btn-danger mc-btn-sm" onClick={handleDeleteSelected}>
              <FontAwesomeIcon icon={faTrash} />
              Xóa {selectedIds.length} góp ý
            </button>
          )}
        </div>
      </div>

      {displayComments.length === 0 ? (
        <div className="mc-empty-container">
          <div className="mc-empty-icon">
            <FontAwesomeIcon icon={faComments} />
          </div>
          <div className="mc-empty-title">Chưa có góp ý nào</div>
          <div className="mc-empty-text">Chưa có góp ý phù hợp với bộ lọc của bạn</div>
        </div>
      ) : (
        <div className="mc-data-card">
          <div className="mc-table-wrapper">
            <table className="mc-table">
              <thead>
                <tr>
                  <th style={{ width: '5%' }}></th>
                  <th style={{ width: '30%' }}>Tiêu đề</th>
                  <th style={{ width: '15%' }}>Người tạo</th>
                  <th style={{ width: '10%' }}>Loại</th>
                  <th style={{ width: '15%' }}>Ngày tạo</th>
                  <th style={{ width: '10%' }}>Trạng thái</th>
                  <th style={{ width: '15%' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {displayComments.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => handleSelect(c.id)}
                      />
                    </td>
                    <td><strong>{truncateTitle(c.title)}</strong></td>
                    <td>{c.creator || 'Không rõ'}</td>
                    <td>{c.type || 'Không rõ'}</td>
                    <td>{c.createdAt ? new Date(c.createdAt).toLocaleString('vi-VN') : 'N/A'}</td>
                    <td>
                      <span className={c.status === 'resolved' ? 'mc-badge mc-badge-resolved' : 'mc-badge mc-badge-pending'}>
                        {c.status === 'resolved' ? 'Đã xử lý' : 'Chờ xử lý'}
                      </span>
                    </td>
                    <td>
                      <div className="mc-action-buttons">
                        <Link to={`${basePath}/comments/${c.id}`} className="mc-btn-icon mc-btn-icon-view" title="Xem">
                          <FontAwesomeIcon icon={faEye} />
                        </Link>
                        <Link 
                          to={c.status === 'pending' ? `${basePath}/comments/feedback/${c.id}` : '#'} 
                          className={`mc-btn-icon mc-btn-icon-approve ${c.status === 'resolved' ? 'mc-btn-disabled' : ''}`}
                          title={c.status === 'resolved' ? 'Đã xử lý' : 'Phản hồi'}
                          onClick={(e) => c.status === 'resolved' && e.preventDefault()}
                        >
                          <FontAwesomeIcon icon={faReply} />
                        </Link>
                        <button onClick={() => handleDelete(c.id)} className="mc-btn-icon mc-btn-icon-delete" title="Xóa">
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentList;

