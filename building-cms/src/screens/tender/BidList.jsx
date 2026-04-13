import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import callApi from '../../apis/handleApi';
import { FaLock, FaUnlock, FaExclamationTriangle, FaTrophy, FaEdit } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './BidList.css';

const BidList = ({ tenderId, onBidSelect, refreshTrigger, tenderStatus, onAddBid }) => {
  const { user } = useAuth();
  const [bids, setBids] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAuditWarning, setShowAuditWarning] = useState(false);

  useEffect(() => {
    if (tenderId) {
      fetchBids();
    }
  }, [tenderId, refreshTrigger]); // Thêm refreshTrigger vào dependency

  const fetchBids = async (forceShow = false) => {
    setLoading(true);
    try {
      const url = `/tenders/${tenderId}/bids${forceShow ? '?forceShow=true' : ''}`;
      const response = await callApi(url);
      setBids(response.bids || []);
      setMetadata(response.metadata || {});
      setError('');
      
      // Hiển thị toast notification nếu có security alert
      if (response.metadata?.hasSecurityAlert && response.metadata?.securityAlertMessage) {
        toast.warning(response.metadata.securityAlertMessage, {
          position: "top-right",
          autoClose: 8000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          style: {
            backgroundColor: '#fff3cd',
            color: '#856404',
            border: '1px solid #ffc107',
            fontSize: '14px',
            fontWeight: '500'
          }
        });

        // Phát tín hiệu để các tab khác kiểm tra ngay lập tức
        try {
          localStorage.setItem('newSecurityAlertTrigger', JSON.stringify({
            timestamp: Date.now(),
            tenderId
          }));
        } catch (storageErr) {
          console.warn('[BidList] Could not broadcast security alert trigger:', storageErr);
        }
      }
      
      // Hiển thị cảnh báo nếu admin override (fallback)
      if (forceShow && response.metadata?.isAmountHidden) {
        setShowAuditWarning(true);
        setTimeout(() => setShowAuditWarning(false), 5000);
      }
    } catch (err) {
      setError('Không thể tải danh sách hồ sơ dự thầu');
      console.error('Error fetching bids:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleForceShow = () => {
    if (window.confirm('Bạn có chắc chắn muốn xem giá dự thầu? Hành động này sẽ được ghi vào audit log.')) {
      fetchBids(true);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '***';
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: 'VND' 
    }).format(amount);
  };

  if (!tenderId) {
    return <div className="bid-list">Vui lòng chọn gói thầu</div>;
  }

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  const isAdmin = user?.role === 'admin';
  const isAmountHidden = metadata?.isAmountHidden;
  const isOpen = tenderStatus === 'OPEN';

  return (
    <div className="bid-list">
      <div className="bid-list-header">
        <h3>Danh sách hồ sơ dự thầu</h3>
        <div className="bid-list-actions">
          {isAdmin && isAmountHidden && (
            <button 
              className="btn btn-warning"
              onClick={handleForceShow}
              title="Xem giá dự thầu (sẽ được ghi vào audit log)"
            >
              <FaLock /> Xem giá (Admin Override)
            </button>
          )}
        </div>
      </div>

      {showAuditWarning && (
        <div className="alert alert-warning">
          <FaExclamationTriangle /> 
          Hành động này đã được ghi vào audit log.
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      {bids.length === 0 ? (
        <div className="no-data">Không có hồ sơ dự thầu nào</div>
      ) : (
        <table className="bid-table">
          <thead>
            <tr>
              <th>Nhà thầu</th>
              <th>Giá dự thầu</th>
              <th>Điểm kỹ thuật</th>
              <th>Điểm tài chính</th>
              <th>Tổng điểm</th>
              <th>Xếp hạng</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {bids.map(bid => (
              <tr key={bid.Id} className={bid.isWinner ? 'winner-row' : ''}>
                <td>{bid.contractorName}</td>
                <td>
                  {bid.isAmountHidden || (bid.bidAmount === null || bid.bidAmount === undefined) ? (
                    <span className="sealed-bid">
                      <FaLock /> Giá đã được niêm phong
                    </span>
                  ) : (
                    formatCurrency(bid.bidAmount)
                  )}
                </td>
                <td>{bid.technicalScore?.toFixed(2) || '-'}</td>
                <td>{bid.financialScore?.toFixed(2) || '-'}</td>
                <td><strong>{bid.totalScore?.toFixed(2) || '-'}</strong></td>
                <td>
                  {bid.ranking ? (
                    <span className={`ranking-badge rank-${bid.ranking}`}>
                      #{bid.ranking}
                    </span>
                  ) : '-'}
                </td>
                <td>
                  {bid.isWinner && (
                    <span className="badge badge-success">
                      <FaTrophy /> Thắng thầu
                    </span>
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => onBidSelect && onBidSelect(bid.Id)}
                    title="Chấm điểm chi tiết"
                  >
                    <FaEdit /> Chấm điểm
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default BidList;

