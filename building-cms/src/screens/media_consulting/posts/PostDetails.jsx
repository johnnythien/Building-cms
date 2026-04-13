import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import callApi from '../../../apis/handleApi';
import { toast } from 'react-toastify';
import useMediaConsultingPath from '../../../hooks/useMediaConsultingPath';

const TOPIC_LABELS = {
  'news': 'Tin tức',
  'event': 'Sự kiện',
  'promotion': 'Khuyến mãi',
  'announcement': 'Thông báo',
  'feedback': 'Phản ánh'
};

const formatDate = (isoString) => {
  const d = new Date(isoString);
  return d.toLocaleString('vi-VN', { dateStyle: 'long', timeStyle: 'short' });
};

export default function PostDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const basePath = useMediaConsultingPath();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoomedImage, setZoomedImage] = useState(null);

  useEffect(() => {
    fetchPost();
  }, [id]);

  // Đóng modal khi nhấn ESC
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && zoomedImage) {
        setZoomedImage(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [zoomedImage]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      const response = await callApi(`/posts/${id}`);
      setPost(response);
    } catch (error) {
      console.error('Error fetching post:', error);
      toast.error('Không thể tải bài viết');
      navigate(`${basePath}/posts`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container">
        <p className="text-center mt-4">Bài viết không tồn tại.</p>
        <div className="text-center">
          <button className="btn btn-primary" onClick={() => navigate(`${basePath}/posts`)}>
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card shadow-sm">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h3 className="mb-0">Chi tiết bài viết</h3>
          <button
            className="btn btn-light btn-sm"
            onClick={() => navigate(`${basePath}/posts`)}
          >
            &larr; Quay lại
          </button>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <div><strong>Người gửi:</strong> {post.senderName || 'Không rõ'}</div>
            
            {/* hiển thị Chủ đề */}
            <div><strong>Chủ đề:</strong> {TOPIC_LABELS[post.topic] || post.topic || 'Chưa chọn'}</div>
            
            <div><strong>Ngày đăng:</strong> {post.createdAt ? formatDate(post.createdAt) : 'Không rõ'}</div>
            <div><strong>Trạng thái:</strong> {post.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}</div>
          </div>

          <h1 className="mb-3">{post.title}</h1>

          <div className="mb-3" style={{ whiteSpace: 'pre-wrap' }}>{post.content}</div>

          {post.imageUrl && (
            <img
              src={post.imageUrl}
              alt={post.title}
              className="img-fluid rounded"
              style={{ 
                maxWidth: '500px', 
                maxHeight: '400px', 
                objectFit: 'contain',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}
              onClick={() => setZoomedImage(post.imageUrl)}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            />
          )}
        </div>
      </div>

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{
            zIndex: 1050,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            cursor: 'pointer'
          }}
          onClick={() => setZoomedImage(null)}
        >
          <div 
            className="position-relative" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '90vh' }}
          >
            <img
              src={zoomedImage}
              alt="Zoomed"
              className="img-fluid rounded shadow-lg"
              style={{
                maxHeight: '90vh',
                maxWidth: '90vw',
                objectFit: 'contain'
              }}
            />
            <button
              className="btn btn-light position-absolute top-0 end-0 m-2"
              onClick={() => setZoomedImage(null)}
              style={{
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 'bold'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#dc3545'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}