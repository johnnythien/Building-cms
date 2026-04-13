import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import callApi from '../../../apis/handleApi';
import { useAuth } from '../../../context/AuthContext';
import useMediaConsultingPath from '../../../hooks/useMediaConsultingPath';

const FeedbackForm = () => {
  const { id } = useParams();
  const basePath = useMediaConsultingPath();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [comment, setComment] = useState(null);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComment();
  }, [id]);

  const fetchComment = async () => {
    try {
      setLoading(true);
      const response = await callApi(`/comments/${id}`);
      setComment(response);
    } catch (error) {
      console.error('Error fetching comment:', error);
      toast.error('Không tìm thấy góp ý');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!response.trim()) {
      setError('Vui lòng nhập nội dung phản hồi.');
      return;
    }

    try {
      const feedbacks = Array.isArray(comment.feedbacks) ? comment.feedbacks : [];
      const newFeedback = {
        content: response,
        author: user?.fullName || user?.email || 'Ban quản lý',
        createdAt: new Date().toISOString()
      };

      const updatedComment = {
        ...comment,
        status: 'resolved',
        feedbacks: [...feedbacks, newFeedback]
      };

      await callApi(`/comments/${id}`, updatedComment, 'put');
      toast.success('Phản hồi đã được gửi thành công!');
      setTimeout(() => navigate(`${basePath}/comments`), 1500);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Không thể gửi phản hồi');
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

  if (!comment) {
    return (
      <div className="alert alert-warning m-4">Không tìm thấy góp ý để phản hồi.</div>
    );
  }

  const feedbacks = Array.isArray(comment.feedbacks) ? comment.feedbacks : [];
  const feedbackCount = feedbacks.length;

  return (
    <div className="container-fluid">
      <div className="card shadow-sm">
        <div className="card-header bg-primary text-white">
          <h3 className="card-title mb-0">
            Phản hồi góp ý{feedbackCount > 0 ? ` lần ${feedbackCount + 1}` : ' lần 1'}
          </h3>
        </div>
        <div className="card-body">
          <h5 className="mb-3">Tiêu đề: {comment.title || 'Không có tiêu đề'}</h5>
          <p className="mb-2"><strong>Nội dung góp ý:</strong> {comment.content}</p>
          <div className="mb-3">
            <p><strong>Loại:</strong> {comment.type || 'Không rõ'}</p>
            <p><strong>Người tạo:</strong> {comment.creator || 'Không rõ'}</p>
            <p><strong>Trạng thái:</strong> 
              <span className={`badge ms-2 ${comment.status === 'resolved' ? 'bg-success' : 'bg-warning'}`}>
                {comment.status === 'resolved' ? 'Đã xử lý' : 'Chờ xử lý'}
              </span>
            </p>
          </div>

          {feedbacks.length > 0 && (
            <div className="mb-3">
              <h6>Phản hồi trước đó:</h6>
              <div className="list-group">
                {feedbacks.map((feedback, index) => (
                  <div key={index} className="list-group-item">
                    <div className="d-flex justify-content-between">
                      <strong>{feedback.author || feedback.sender || 'Không rõ'}</strong>
                      <small className="text-muted">
                        {feedback.createdAt ? new Date(feedback.createdAt).toLocaleString('vi-VN') : 'N/A'}
                      </small>
                    </div>
                    <p className="mb-0 mt-2">{feedback.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Nội dung phản hồi</label>
              <textarea
                className="form-control"
                rows={5}
                value={response}
                onChange={e => setResponse(e.target.value)}
                placeholder="Nhập nội dung phản hồi..."
                required
              />
              {error && <div className="text-danger mt-2">{error}</div>}
            </div>
            <div className="d-flex justify-content-end">
              <Link to={`${basePath}/comments`} className="btn btn-secondary me-2">
                <i className="fas fa-arrow-left me-1"></i> Quay lại
              </Link>
              <button type="submit" className="btn btn-success">
                <i className="fas fa-reply me-1"></i> Gửi phản hồi
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FeedbackForm;

