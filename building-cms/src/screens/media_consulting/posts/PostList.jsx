import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import callApi from '../../../apis/handleApi';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faPlus, faEye, faEdit, faTrash, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import useMediaConsultingPath from '../../../hooks/useMediaConsultingPath';
import '../MediaConsulting.css';

const TOPIC_LABELS = {
  'news': 'Tin tức',
  'event': 'Sự kiện',
  'promotion': 'Khuyến mãi',
  'announcement': 'Thông báo',
  'feedback': 'Phản ánh'
};

const formatDate = (isoString) => {
  const d = new Date(isoString);
  return d.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function PostList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const basePath = useMediaConsultingPath();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTopic, setFilterTopic] = useState('Tất cả');
  const [filterStatus, setFilterStatus] = useState('Tất cả');
  const [sortOption, setSortOption] = useState('pending-first');

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await callApi('/posts');
      setPosts(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Không thể tải danh sách bài viết');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa bài viết này không?')) return;
    try {
      await callApi(`/posts/${id}`, null, 'delete');
      setPosts(prev => prev.filter(p => p.id !== id));
      toast.success('Xóa bài viết thành công!');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Không thể xóa bài viết');
    }
  };

  const updatePost = async (id, updatedData) => {
    try {
      const post = posts.find(p => p.id === id);
      const updatedPost = { ...post, ...updatedData };
      await callApi(`/posts/${id}`, updatedPost, 'put');
      setPosts(prev => prev.map(p => p.id === id ? updatedPost : p));
      toast.success('Cập nhật bài viết thành công!');
    } catch (error) {
      console.error('Error updating post:', error);
      toast.error('Không thể cập nhật bài viết');
    }
  };

  // Lấy danh sách topic unique từ data
  const allTopics = ['Tất cả', ...Array.from(new Set(posts.map(p => p.topic || '').filter(Boolean)))];
  const isManager = user?.role === 'media_consulting_manager';

  const filteredPosts = posts
    .filter(p => {
      const matchesSearch = p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.senderName?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTopic = filterTopic === 'Tất cả' || p.topic === filterTopic;

      const matchesStatus = filterStatus === 'Tất cả' || p.status === filterStatus;

      return matchesSearch && matchesTopic && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortOption) {
        case 'pending-first':
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (a.status !== 'pending' && b.status === 'pending') return 1;
          return new Date(b.createdAt) - new Date(a.createdAt);
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
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
          Danh sách Bài Viết
        </h1>
        <div className="mc-btn-group">
          <button
            className="mc-btn mc-btn-primary"
            onClick={() => navigate(`${basePath}/posts/create`)}
          >
            <FontAwesomeIcon icon={faPlus} />
            Tạo mới
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="mc-filter-section">
        <div className="mc-filter-row">
          <input
            type="text"
            className="mc-form-control"
            placeholder="Tìm kiếm theo tiêu đề hoặc người gửi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          {/* Dropdown lọc chủ đề hiển thị Label */}
          <select
            className="mc-form-select"
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
          >
            {allTopics.map(topic => (
              <option key={topic} value={topic}>
                {topic === 'Tất cả' ? 'Tất cả chủ đề' : (TOPIC_LABELS[topic] || topic)}
              </option>
            ))}
          </select>

          <select
            className="mc-form-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="Tất cả">Tất cả trạng thái</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
          </select>
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="mc-empty-container">
          <div className="mc-empty-icon">
            <FontAwesomeIcon icon={faFileAlt} />
          </div>
          <div className="mc-empty-title">Không tìm thấy bài viết</div>
          <div className="mc-empty-text">Chưa có bài viết phù hợp với bộ lọc của bạn</div>
        </div>
      ) : (
        <div className="mc-card-grid">
          {filteredPosts.map(post => (
            <div
              key={post.id}
              className="mc-item-card"
              onMouseEnter={() => setHovered(post.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {post.imageUrl ? (
                <img src={post.imageUrl} alt={post.title} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
              ) : (
                <div className="d-flex align-items-center justify-content-center" style={{ height: '200px', background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)' }}>
                  <FontAwesomeIcon icon={faFileAlt} size="3x" style={{ color: '#d1d5db' }} />
                </div>
              )}
              <div className="mc-item-card-body">
                <h5 className="mb-3" style={{ fontWeight: 600, color: '#1f2937' }}>{post.title}</h5>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  <div className="mb-2">
                    <strong>Người gửi:</strong> {post.senderName || 'Không rõ'}
                  </div>
                  
                  {/* hiển thị Chủ đề */}
                  <div className="mb-2">
                    <strong>Chủ đề:</strong> {TOPIC_LABELS[post.topic] || post.topic || 'Chưa chọn'}
                  </div>

                  <div className="mb-2">
                    <strong>Ngày đăng:</strong> {post.createdAt ? formatDate(post.createdAt) : 'Không rõ'}
                  </div>
                  <div>
                    <strong>Trạng thái:</strong>{' '}
                    <span className={post.status === 'approved' ? 'mc-badge mc-badge-approved' : 'mc-badge mc-badge-pending'}>
                      {post.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mc-item-card-footer">
                <div className="mc-action-buttons">
                  {isManager && post.status !== 'approved' && (
                    <button
                      onClick={() => updatePost(post.id, { status: 'approved' })}
                      className="mc-btn-icon mc-btn-icon-approve"
                      title="Duyệt bài"
                    >
                      <FontAwesomeIcon icon={faCheckCircle} />
                    </button>
                  )}
                  <Link to={`${basePath}/posts/${post.id}`} className="mc-btn-icon mc-btn-icon-view" title="Xem">
                    <FontAwesomeIcon icon={faEye} />
                  </Link>
                  <Link to={`${basePath}/posts/edit/${post.id}`} className="mc-btn-icon mc-btn-icon-edit" title="Sửa">
                    <FontAwesomeIcon icon={faEdit} />
                  </Link>
                  <button
                    onClick={() => deletePost(post.id)}
                    className="mc-btn-icon mc-btn-icon-delete"
                    title="Xóa bài viết"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}