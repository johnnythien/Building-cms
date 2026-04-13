import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import callApi from '../../../apis/handleApi';
import useMediaConsultingPath from '../../../hooks/useMediaConsultingPath';

const VoteDetails = () => {
  const { id } = useParams();
  const basePath = useMediaConsultingPath();
  const navigate = useNavigate();
  const [vote, setVote] = useState(null);
  const [voteResults, setVoteResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVote();
    fetchVoteResults();
  }, [id]);

  const fetchVote = async () => {
    try {
      setLoading(true);
      const response = await callApi(`/votes/${id}`);
      setVote(response);
    } catch (error) {
      console.error('Error fetching vote:', error);
      toast.error('Không tìm thấy biểu quyết');
    } finally {
      setLoading(false);
    }
  };

  const fetchVoteResults = async () => {
    try {
      const response = await callApi('/vote-results');
      const results = Array.isArray(response) ? response : [];
      setVoteResults(results.filter(r => r.VoteId === parseInt(id)));
    } catch (error) {
      console.error('Error fetching vote results:', error);
      setVoteResults([]);
    }
  };

  const getStatus = () => {
    if (!vote || !vote.StartDate || !vote.EndDate) return 'unknown';
    const now = new Date();
    const start = new Date(vote.StartDate);
    const end = new Date(vote.EndDate);
    if (start > now) return 'upcoming';
    if (end < now) return 'ended';
    return 'active';
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return { text: 'Đang diễn ra', class: 'bg-success' };
      case 'ended': return { text: 'Đã kết thúc', class: 'bg-danger' };
      case 'upcoming': return { text: 'Sắp diễn ra', class: 'bg-info' };
      default: return { text: 'Không xác định', class: 'bg-secondary' };
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

  if (!vote) {
    return (
      <div className="alert alert-warning">
        Không tìm thấy biểu quyết
      </div>
    );
  }

  const status = getStatus();
  const statusInfo = getStatusLabel(status);
  const participantCount = new Set(voteResults.map(r => r.UserId || r.Resident_id)).size;

  return (
    <div className="container-fluid">
      <div className="card shadow-sm">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h3 className="card-title mb-0">
            <i className="fas fa-vote-yea me-2"></i>Chi tiết Biểu quyết
          </h3>
          <div>
            <Link to={`${basePath}/votes/results/${id}`} className="btn btn-info btn-sm me-2">
              <i className="fas fa-chart-bar me-1"></i> Xem kết quả
            </Link>
            <Link to={`${basePath}/votes`} className="btn btn-secondary btn-sm">
              <i className="fas fa-arrow-left me-1"></i> Quay lại
            </Link>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-4">
            <h4 className="text-primary">{vote.Title}</h4>
            <div className="row mt-3">
              <div className="col-md-6">
                <p><strong>Người tạo:</strong> {vote.CreatedBy || 'Không rõ'}</p>
                <p><strong>Ngày bắt đầu:</strong> {vote.StartDate ? new Date(vote.StartDate).toLocaleString('vi-VN') : 'N/A'}</p>
                <p><strong>Ngày kết thúc:</strong> {vote.EndDate ? new Date(vote.EndDate).toLocaleString('vi-VN') : 'N/A'}</p>
              </div>
              <div className="col-md-6">
                <p><strong>Trạng thái:</strong> 
                  <span className={`badge ms-2 ${statusInfo.class}`}>
                    {statusInfo.text}
                  </span>
                </p>
                <p><strong>Số người tham gia:</strong> {vote.totalEligible || 0}</p>
                <p><strong>Tổng số phiếu:</strong> {voteResults.length}</p>
              </div>
            </div>
          </div>

          <hr />

          <div className="d-flex justify-content-end gap-2">
            <Link to={`${basePath}/votes/edit/${id}`} className="btn btn-warning">
              <i className="fas fa-edit me-1"></i> Chỉnh sửa
            </Link>
            <Link to={`${basePath}/votes/results/${id}`} className="btn btn-success">
              <i className="fas fa-chart-pie me-1"></i> Xem kết quả chi tiết
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoteDetails;

