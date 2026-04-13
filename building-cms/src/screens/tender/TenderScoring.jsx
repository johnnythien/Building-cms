import React, { useState } from 'react';
import callApi from '../../apis/handleApi';
import useToast from '../../hooks/useToast';
import './TenderScoring.css';

const TenderScoring = ({ tenderId, onScoresCalculated }) => {
  const toast = useToast();
  const ToastContainer = toast.ToastContainer;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [results, setResults] = useState(null);

  const handleCalculateScores = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    setResults(null);

    try {
      const response = await callApi(
        `/tenders/${tenderId}/calculate-scores`,
        {},
        'post'
      );
      setResults(response.results);
      const successMessage = response.message || 'Tính điểm thành công';
      setSuccess(successMessage);
      toast.success(successMessage);
      if (onScoresCalculated) onScoresCalculated();
    } catch (err) {
      const errorMessage = err.response?.data?.message || 
                           err.response?.data?.error ||
                           err.message || 
                           'Tính điểm thất bại';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!tenderId) {
    return <div className="tender-scoring">Vui lòng chọn gói thầu</div>;
  }

  return (
    <div className="tender-scoring">
      <ToastContainer />
      <h3>Tính điểm tự động</h3>
      
      <div className="scoring-info">
        <p>
          Hệ thống sẽ tự động tính:
        </p>
        <ul>
          <li><strong>Điểm tài chính:</strong> (Giá thấp nhất / Giá nhà thầu) × 100</li>
          <li><strong>Điểm kỹ thuật:</strong> Từ điểm chi tiết các tiêu chí</li>
          <li><strong>Tổng điểm:</strong> (Điểm kỹ thuật × Weight) + (Điểm tài chính × Weight)</li>
          <li><strong>Xếp hạng:</strong> Sắp xếp theo tổng điểm giảm dần</li>
        </ul>
      </div>

      <button 
        className="btn btn-primary"
        onClick={handleCalculateScores}
        disabled={loading}
      >
        {loading ? 'Đang tính...' : 'Tính điểm tự động'}
      </button>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {results && (
        <div className="scoring-results">
          <h4>Kết quả:</h4>
          <ul>
            <li>Đã cập nhật điểm tài chính: {results.financial} hồ sơ</li>
            <li>Đã cập nhật điểm kỹ thuật: {results.technical} hồ sơ</li>
            <li>Đã cập nhật tổng điểm và xếp hạng: {results.total} hồ sơ</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default TenderScoring;

