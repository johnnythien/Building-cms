import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import callApi from '../../apis/handleApi';
import { FaFileAlt, FaUsers, FaFileInvoiceDollar, FaCheckCircle } from 'react-icons/fa';
import { TENDER_STATUS } from '../../utils/tenderStatusHelper';
import './TenderDashboard.css';

const TenderDashboard = () => {
  const { currentUser, logout } = useAuth();
  const [tenders, setTenders] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tendersResponse, contractorsResponse, bidsResponse] = await Promise.all([
        callApi('/tenders'),
        callApi('/contractors'),
        callApi('/bids')
      ]);

      setTenders(tendersResponse);
      setContractors(contractorsResponse);
      setBids(bidsResponse);
      setError('');
    } catch (err) {
      setError('Không thể tải dữ liệu. Vui lòng thử lại sau.');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getContractorName = (contractorId) => {
    const contractor = contractors.find(c => c.id === parseInt(contractorId));
    return contractor ? contractor.name : 'Không xác định';
  };

  const getTenderName = (tenderId) => {
    const tender = tenders.find(t => t.id === parseInt(tenderId));
    return tender ? tender.name : 'Không xác định';
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN').format(date);
  };

  const openTenders = tenders.filter(t => t.status === TENDER_STATUS.OPEN).length;
  const closedTenders = tenders.filter(t => t.status === TENDER_STATUS.CLOSED).length;
  const submittedBids = bids.filter(b => b.status === 'pending').length;
  const approvedBids = bids.filter(b => b.isWinner === true || b.isWinner === 1).length;

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="tender-dashboard-content">
      <div className="page-header-wrapper mb-4">
        <div className="page-header">
          <h1 className="page-title">Tổng quan đấu thầu</h1>
        </div>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <div className="stats-cards">
        <div className="stats-card">
          <FaFileAlt className="stats-icon" />
          <div className="stats-content">
            <h3>Gói thầu đang mở</h3>
            <p className="stats-value">{openTenders}</p>
          </div>
        </div>

        <div className="stats-card">
          <FaUsers className="stats-icon" />
          <div className="stats-content">
            <h3>Nhà thầu</h3>
            <p className="stats-value">{contractors.length}</p>
          </div>
        </div>

        <div className="stats-card">
          <FaFileInvoiceDollar className="stats-icon" />
          <div className="stats-content">
            <h3>Hồ sơ đã nộp</h3>
            <p className="stats-value">{submittedBids}</p>
          </div>
        </div>

        <div className="stats-card">
          <FaCheckCircle className="stats-icon" />
          <div className="stats-content">
            <h3>Trúng thầu</h3>
            <p className="stats-value">{approvedBids}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Gói thầu đang mở</h2>
            <Link to="/tender/tenders" className="view-all-btn">Xem tất cả</Link>
          </div>

          {tenders.filter(t => t.status === TENDER_STATUS.OPEN).length === 0 ? (
            <div className="no-data">Không có gói thầu đang mở</div>
          ) : (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên gói thầu</th>
                  <th>Ngân sách</th>
                  <th>Thời hạn</th>
                </tr>
              </thead>
              <tbody>
                {tenders
                  .filter(t => t.status === TENDER_STATUS.OPEN)
                  .slice(0, 3)
                  .map(t => (
                    <tr key={t.id}>
                      <td>{t.code}</td>
                      <td>{t.name}</td>
                      <td>{formatCurrency(t.estimatedBudget)}</td>
                      <td>{formatDate(t.endDate)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <h2>Hồ sơ dự thầu gần đây</h2>
            <Link to="/tender/bids" className="view-all-btn">Xem tất cả</Link>
          </div>

          {bids.length === 0 ? (
            <div className="no-data">Không có hồ sơ dự thầu</div>
          ) : (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Gói thầu</th>
                  <th>Nhà thầu</th>
                  <th>Giá đề xuất</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {bids
                  .sort((a, b) => new Date(b.bidDate) - new Date(a.bidDate))
                  .slice(0, 3)
                  .map(bid => (
                    <tr key={bid.id}>
                      <td>{getTenderName(bid.tenderId)}</td>
                      <td>{getContractorName(bid.contractorId)}</td>
                      <td>{formatCurrency(bid.bidAmount)}</td>
                      <td>
                        <span className={`bid-status ${bid.status}`}>
                          {bid.status === 'pending' && 'Chờ duyệt'}
                          {bid.status === 'approved' && 'Đã duyệt'}
                          {bid.status === 'rejected' && 'Từ chối'}
                          {bid.status !== 'pending' &&
                            bid.status !== 'approved' &&
                            bid.status !== 'rejected' &&
                            (bid.statusDescription || bid.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default TenderDashboard;
