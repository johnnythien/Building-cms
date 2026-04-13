import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import callApi from '../../apis/handleApi';
import useToast from '../../hooks/useToast';
import './BidCriteriaScores.css';

const BidCriteriaScores = ({ tenderId, bidId, onScoresUpdated }) => {
  const { user } = useAuth();
  const toast = useToast();
  const ToastContainer = toast.ToastContainer;
  const [criteria, setCriteria] = useState([]);
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (tenderId && bidId) {
      fetchCriteria();
      fetchScores();
    }
  }, [tenderId, bidId]);

  const fetchCriteria = async () => {
    try {
      const response = await callApi(`/tenders/${tenderId}/criteria?type=TECHNICAL`);
      setCriteria(response || []);
    } catch (err) {
      setError('Không thể tải danh sách tiêu chí');
    }
  };

  const fetchScores = async () => {
    try {
      const response = await callApi(`/bids/${bidId}/criteria-scores`);
      const scoresMap = {};
      (response || []).forEach(score => {
        scoresMap[score.criteriaId] = score.score;
      });
      setScores(scoresMap);
    } catch (err) {
      // Có thể chưa có điểm, không cần báo lỗi
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (criteriaId, value) => {
    const maxScore = criteria.find(c => c.Id === criteriaId)?.MaxScore || 0;
    const numValue = parseFloat(value) || 0;
    
    if (numValue > maxScore) {
      setError(`Điểm không được vượt quá ${maxScore}`);
      return;
    }
    
    setScores({...scores, [criteriaId]: numValue});
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const scoresArray = Object.entries(scores).map(([criteriaId, score]) => ({
        criteriaId: parseInt(criteriaId),
        score: parseFloat(score) || 0
      }));

      const response = await callApi(
        `/bids/${bidId}/criteria-scores`,
        { scores: scoresArray },
        'post'
      );
      const successMessage = 'Lưu điểm thành công. Điểm kỹ thuật đã được tính lại tự động.';
      setSuccess(successMessage);
      toast.success(successMessage);
      fetchScores(); // Reload điểm chi tiết
      
      // Gọi callback để refresh BidList và các component khác
      if (onScoresUpdated) {
        // Delay một chút để đảm bảo backend đã tính xong
        setTimeout(() => {
          onScoresUpdated();
        }, 500);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 
                           err.response?.data?.error ||
                           err.message || 
                           'Lỗi lưu điểm';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  if (!tenderId || !bidId) {
    return <div className="bid-criteria-scores">Vui lòng chọn gói thầu và hồ sơ dự thầu</div>;
  }

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (
    <div className="bid-criteria-scores">
      <ToastContainer />
      <h4>Chấm điểm chi tiết</h4>
      
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {criteria.length === 0 ? (
        <div className="no-data">Chưa có tiêu chí kỹ thuật nào</div>
      ) : (
        <form onSubmit={handleSubmit}>
          <table className="scores-table">
            <thead>
              <tr>
                <th>Tiêu chí</th>
                <th>Điểm tối đa</th>
                <th>Trọng số</th>
                <th>Điểm chấm</th>
              </tr>
            </thead>
            <tbody>
              {criteria.map(c => (
                <tr key={c.Id}>
                  <td>{c.Name}</td>
                  <td>{c.MaxScore}</td>
                  <td>{c.Weight}%</td>
                  <td>
                    <input
                      type="number"
                      value={scores[c.Id] || ''}
                      onChange={(e) => handleScoreChange(c.Id, e.target.value)}
                      min="0"
                      max={c.MaxScore}
                      step="0.01"
                      required
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Lưu điểm
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default BidCriteriaScores;

