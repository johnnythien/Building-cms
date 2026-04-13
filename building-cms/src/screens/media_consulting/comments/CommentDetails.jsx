import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import callApi from '../../../apis/handleApi';
import { toast } from 'react-toastify';
import useMediaConsultingPath from '../../../hooks/useMediaConsultingPath';

const CommentDetails = () => {
  const { id } = useParams();
  const basePath = useMediaConsultingPath();
  const [comment, setComment] = useState(null);
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
      <div className="alert alert-warning">
        Không tìm thấy góp ý
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="card shadow-sm">
        <div className="card-header bg-primary text-white">
          <h3 className="card-title mb-0">Chi tiết Góp Ý</h3>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <h4>Tiêu đề</h4>
            <p className="fs-5">{comment.title}</p>
          </div>
          <div className="mb-3">
            <h4>Nội dung</h4>
            <p>{comment.content}</p>
          </div>
          <div className="mb-3">
            <p><strong>Loại:</strong> {comment.type || 'Không rõ'}</p>
            <p>
              <strong>Người tạo:</strong> {comment.creator || 'Không rõ'}
            </p>
            <p>
              <strong>Ngày tạo:</strong>{' '}
              {comment.createdAt ? new Date(comment.createdAt).toLocaleString('vi-VN') : 'N/A'}
            </p>
            <p>
              <strong>Trạng thái:</strong>{' '}
              <span className={`badge ${comment.status === 'resolved' ? 'bg-success' : 'bg-warning'}`}>
                {comment.status === 'resolved' ? 'Đã xử lý' : 'Chờ xử lý'}
              </span>
            </p>
          </div>
          {comment.feedbacks && comment.feedbacks.length > 0 && (
            <div className="mb-3">
              <h4>Phản hồi ({comment.feedbacks.length})</h4>
              <div className="list-group">
                {comment.feedbacks.map((feedback, index) => (
                  <div key={index} className="list-group-item">
                    <div className="d-flex justify-content-between">
                      <strong>{feedback.author || 'Không rõ'}</strong>
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
          <div className="mt-3 d-flex justify-content-between">
            <Link to={`${basePath}/comments`} className="btn btn-secondary">
              <i className="fas fa-arrow-left me-2"></i>
              Quay lại
            </Link>
            <Link to={`${basePath}/comments/feedback/${id}`} className="btn btn-success">
              <i className="fas fa-reply me-2"></i>
              Phản hồi
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommentDetails;

