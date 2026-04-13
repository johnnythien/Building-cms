import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import callApi from '../../apis/handleApi';
import { getStatusLabel, TENDER_STATUS } from '../../utils/tenderStatusHelper';
import useToast from '../../hooks/useToast';
import './TenderStatusTransition.css';

const TenderStatusTransition = ({ tenderId, onStatusChanged, refreshKey = 0 }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [statusInfo, setStatusInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelledReason, setCancelledReason] = useState('');

  useEffect(() => {
    if (tenderId) {
      fetchStatusInfo();
    }
  }, [tenderId, refreshKey]);

  const fetchStatusInfo = async () => {
    setLoading(true);
    try {
      const response = await callApi(`/tenders/${tenderId}/status-info`);
      
      setStatusInfo(response);
      setError('');
    } catch (err) {
      const errorMessage = err.message || 'Không thể tải thông tin trạng thái';
      setError(errorMessage);
      console.error('[ERROR] Error fetching status info:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTransition = async (newStatus) => {
    if (newStatus === TENDER_STATUS.CANCELLED) {
      setShowCancelForm(true);
      return;
    }

    try {
      setError('');
      setSuccess('');
      const response = await callApi(
        `/tenders/${tenderId}/transition`,
        { newStatus, cancelledReason: null },
        'post'
      );
      const successMessage = response.message || 'Chuyển trạng thái thành công';
      setSuccess(successMessage);
      toast.success(successMessage);
      if (onStatusChanged) onStatusChanged();
      fetchStatusInfo();
    } catch (err) {
      console.error('[ERROR] Transition error:', err);
      
      // Lấy error message từ API response
      const errorMessage = err.response?.data?.message || 
                           err.response?.data?.error ||
                           err.message || 
                           'Chuyển trạng thái thất bại';
      
      setError(errorMessage);
      toast.error(errorMessage);
      
      // Scroll to top để user thấy error message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCancel = async () => {
    if (!cancelledReason.trim()) {
      setError('Vui lòng nhập lý do hủy');
      return;
    }

    try {
      setError('');
      setSuccess('');
      const response = await callApi(
        `/tenders/${tenderId}/transition`,
        { newStatus: TENDER_STATUS.CANCELLED, cancelledReason },
        'post'
      );
      const successMessage = response.message || 'Hủy gói thầu thành công';
      setSuccess(successMessage);
      toast.success(successMessage);
      setShowCancelForm(false);
      setCancelledReason('');
      if (onStatusChanged) onStatusChanged();
      fetchStatusInfo();
    } catch (err) {
      const errorMessage = err.response?.data?.message || 
                           err.response?.data?.error ||
                           err.message || 
                           'Hủy gói thầu thất bại';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  if (!tenderId) {
    return <div className="tender-status-transition">Vui lòng chọn gói thầu</div>;
  }

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  if (!statusInfo) {
    return <div className="error">Không tìm thấy thông tin gói thầu</div>;
  }

  // Thêm default values để tránh lỗi undefined
  const { tender, canTransitionTo = [], validation = {} } = statusInfo || {};
  
  if (!tender) {
    return <div className="error">Không tìm thấy thông tin gói thầu</div>;
  }
  
  const currentStatus = tender.status;

  const ToastContainer = toast.ToastContainer;

  return (
    <div className="tender-status-transition">
      <ToastContainer />
      <h3>Quản lý trạng thái</h3>
      
      <div className="current-status">
        <label>Trạng thái hiện tại:</label>
        <span className={`status-badge ${currentStatus?.toLowerCase() || ''}`}>
          {getStatusLabel(currentStatus)}
        </span>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Validation Info */}
      {currentStatus === TENDER_STATUS.DRAFT && (
        <div className="validation-info">
          <h4>Điều kiện để mở thầu:</h4>
          <ul>
            <li className={(tender.technicalCriteriaCount || 0) > 0 ? 'valid' : 'invalid'}>
              Có ít nhất 1 tiêu chí kỹ thuật ({tender.technicalCriteriaCount || 0})
            </li>
            <li className={(tender.financialCriteriaCount || 0) > 0 ? 'valid' : 'invalid'}>
              Có ít nhất 1 tiêu chí tài chính ({tender.financialCriteriaCount || 0})
            </li>
            <li className={Math.abs(parseFloat(tender.technicalWeight || 0) - 100) < 0.01 ? 'valid' : 'invalid'}>
              Tổng Weight kỹ thuật = 100% ({parseFloat(tender.technicalWeight || 0).toFixed(2)}%)
            </li>
            <li className={Math.abs(parseFloat(tender.financialWeight || 0) - 100) < 0.01 ? 'valid' : 'invalid'}>
              Tổng Weight tài chính = 100% ({parseFloat(tender.financialWeight || 0).toFixed(2)}%)
            </li>
          </ul>
          {!validation.readyForOpen && (
            <div className="validation-hint">
              <p><strong>💡 Hướng dẫn:</strong></p>
              <p>Để mở thầu, bạn cần:</p>
              <ol>
                <li>Vào tab <strong>"Tiêu chí chấm thầu"</strong> để tạo các tiêu chí kỹ thuật và tài chính</li>
                <li>Đảm bảo tổng Weight của tiêu chí kỹ thuật = 100%</li>
                <li>Đảm bảo tổng Weight của tiêu chí tài chính = 100%</li>
                <li>Sau khi đủ điều kiện, nút <strong>"→ Mở thầu"</strong> sẽ xuất hiện ở dưới</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {currentStatus === TENDER_STATUS.CLOSED && (
        <div className="validation-info">
          <p>
            Số hồ sơ dự thầu hợp lệ: <strong>{tender.validBidCount || 0}</strong>
          </p>
        </div>
      )}

      {currentStatus === TENDER_STATUS.GRADING && (
        <div className="validation-info">
          <p>
            Hồ sơ đã chấm đầy đủ: <strong>{tender.bidsWithCompleteScores || 0}</strong> / {tender.validBidCount || 0}
          </p>
          <p>
            Có người thắng: <strong>{tender.winnerCount > 0 ? 'Có' : 'Chưa'}</strong>
          </p>
        </div>
      )}

      {/* Transition Buttons */}
      <div className="transition-buttons">
        <h4>Chuyển trạng thái:</h4>
        {canTransitionTo && canTransitionTo.length > 0 ? (
          canTransitionTo.map(status => (
            <button
              key={status}
              className={`btn btn-primary transition-btn`}
              onClick={() => handleTransition(status)}
              disabled={status === TENDER_STATUS.CANCELLED && user?.role !== 'admin'}
            >
              → {getStatusLabel(status)}
            </button>
          ))
        ) : (
          <div className="no-transitions">
            <p>Không có trạng thái nào có thể chuyển đổi</p>
            {currentStatus === TENDER_STATUS.DRAFT && !validation.readyForOpen && (
              <p className="hint-text">
                Vui lòng hoàn thành các điều kiện ở trên để có thể mở thầu
              </p>
            )}
          </div>
        )}
        
        {/* Hiển thị nút OPEN bị disabled nếu chưa đủ điều kiện */}
        {currentStatus === TENDER_STATUS.DRAFT && !validation.readyForOpen && !canTransitionTo.includes('OPEN') && (
          <div className="disabled-transition-hint">
            <button
              className="btn btn-secondary transition-btn"
              disabled
              title="Chưa đủ điều kiện để mở thầu. Vui lòng kiểm tra các điều kiện ở trên."
            >
              → {getStatusLabel('OPEN')} (Chưa đủ điều kiện)
            </button>
            <p className="hint-text-small">
              Nút này sẽ được kích hoạt khi bạn hoàn thành tất cả các điều kiện ở trên
            </p>
          </div>
        )}
      </div>

      {/* Cancel Form */}
      {showCancelForm && (
        <div className="cancel-form">
          <h4>Hủy gói thầu</h4>
          <textarea
            value={cancelledReason}
            onChange={(e) => setCancelledReason(e.target.value)}
            placeholder="Nhập lý do hủy..."
            rows="3"
            required
          />
          <div className="form-actions">
            <button className="btn btn-danger" onClick={handleCancel}>
              Xác nhận hủy
            </button>
            <button className="btn btn-secondary" onClick={() => {
              setShowCancelForm(false);
              setCancelledReason('');
            }}>
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenderStatusTransition;

