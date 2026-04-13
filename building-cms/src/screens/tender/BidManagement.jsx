import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import callApi from '../../apis/handleApi';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import PageHeader from '../../components/layout/PageHeader';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import './BidManagement.css';

const BidManagement = () => {
  const { currentUser, logout } = useAuth();
  const [bids, setBids] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    id: '',
    tenderId: '',
    contractorId: '',
    bidAmount: '',
    bidDate: '',
    technicalScore: '',
    financialScore: '',
    status: 'pending'
  });
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTenderId, setFilterTenderId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const statusOptions = [
    { value: 'pending', label: 'Đang xét duyệt', editable: false },
    { value: 'approved', label: 'Đã chấp nhận', editable: false },
    { value: 'rejected', label: 'Từ chối', editable: true }
  ];

  useEffect(() => {
    fetchBids();
    fetchContractors();
    fetchTenders();
  }, []);

  const fetchBids = async () => {
    setLoading(true);
    try {
      const response = await callApi('/bids');
      setBids(response);
      setError('');
    } catch (err) {
      setError('Không thể tải dữ liệu hồ sơ dự thầu. Vui lòng thử lại sau.');
      console.error('Error fetching bids:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchContractors = async () => {
    try {
      const response = await callApi('/contractors');
      setContractors(response);
    } catch (err) {
      console.error('Error fetching contractors:', err);
    }
  };

  const fetchTenders = async () => {
    try {
      const response = await callApi('/tenders');
      setTenders(response);
    } catch (err) {
      console.error('Error fetching tenders:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const buildPayload = () => {
    const parseNumber = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
    return {
      ...formData,
      bidAmount: parseNumber(formData.bidAmount),
      technicalScore: parseNumber(formData.technicalScore),
      financialScore: parseNumber(formData.financialScore)
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = buildPayload();
      if (isEditing) {
        await callApi(`/bids/${formData.id}`, payload, 'put');
      } else {
        await callApi('/bids', payload, 'post');
      }
      resetForm();
      fetchBids();
      setShowForm(false);
    } catch (err) {
      setError(
        isEditing
          ? 'Không thể cập nhật hồ sơ dự thầu. Vui lòng thử lại.'
          : 'Không thể tạo hồ sơ dự thầu mới. Vui lòng thử lại.'
      );
      console.error('Error submitting bid:', err);
    }
  };

  const handleEdit = (bid) => {
    // Handle cả Id (uppercase) và id (lowercase) từ API
    const bidId = bid.id || bid.Id;
    if (!bidId) {
      console.error('Bid ID is missing:', bid);
      setError('Không thể xác định ID hồ sơ dự thầu');
      return;
    }
    
    setFormData({
      id: bidId,
      tenderId: bid.tenderId || bid.tenderId,
      contractorId: bid.contractorId || bid.contractorId,
      bidAmount: bid.bidAmount || bid.bidAmount,
      bidDate: bid.bidDate || bid.bidDate,
      technicalScore: bid.technicalScore || bid.technicalScore,
      financialScore: bid.financialScore || bid.financialScore,
      status: bid.status || bid.status || 'pending'
    });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa hồ sơ dự thầu này không?')) {
      try {
        await callApi(`/bids/${id}`, null, 'delete');
        fetchBids();
      } catch (err) {
        setError('Không thể xóa hồ sơ dự thầu. Vui lòng thử lại.');
        console.error('Error deleting bid:', err);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      tenderId: '',
      contractorId: '',
      bidAmount: '',
      bidDate: '',
      technicalScore: '',
      financialScore: '',
      status: 'pending'
    });
    setIsEditing(false);
  };

  const getStatusLabel = (status) => {
    const statusObj = statusOptions.find(option => option.value === status);
    return statusObj ? statusObj.label : status;
  };

  // Chỉ dùng nhà thầu đang hoạt động
  const activeContractors = contractors.filter(c => (c.status || '').toLowerCase() === 'active');

  const getContractorName = (contractorId) => {
    if (!contractorId) return 'N/A';
    const contractor = contractors.find(c => c.id === contractorId);
    return contractor ? contractor.name : `Nhà thầu #${contractorId}`;
  };

  const getTenderName = (tenderId) => {
    if (!tenderId) return 'N/A';
    const tender = tenders.find(t => t.id === tenderId);
    return tender ? tender.name : `Gói thầu #${tenderId}`;
  };

  // Chỉ hiển thị gói thầu đang OPEN để tránh chọn nhầm gói đã hủy/đóng
  const openTenders = tenders.filter(t => t.status === 'OPEN');

  // Lọc hồ sơ dự thầu theo tìm kiếm và bộ lọc
  const filteredBids = bids.filter(bid => {
    const tenderName = getTenderName(bid.tenderId);
    const contractorName = getContractorName(bid.contractorId);
    
    const searchFields = [
      tenderName,
      contractorName,
      bid.bidAmount?.toString(),
      bid.bidDate,
      bid.technicalScore?.toString(),
      bid.financialScore?.toString(),
      getStatusLabel(bid.status)
    ].map(field => field?.toLowerCase() || '');

    const matchesSearch = searchTerm === '' || 
      searchFields.some(field => field.includes(searchTerm.toLowerCase()));
    
    const matchesTenderFilter = !filterTenderId || bid.tenderId === parseInt(filterTenderId, 10);
    const matchesStatusFilter = !filterStatus || bid.status === filterStatus;
    
    return matchesSearch && matchesTenderFilter && matchesStatusFilter;
  });

  // Thêm phân trang
  const {
    currentItems: paginatedBids,
    currentPage,
    totalPages,
    totalItems,
    setCurrentPage
  } = usePagination(filteredBids);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleTenderFilterChange = (e) => {
    setFilterTenderId(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (e) => {
    setFilterStatus(e.target.value);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="bid-management-content">
      <div className="page-header-wrapper mb-4">
        <PageHeader
          title="Quản lý hồ sơ dự thầu"
          buttonText="Thêm hồ sơ dự thầu mới"
          onButtonClick={() => {
            resetForm();
            setShowForm(!showForm);
        }}
        />
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {showForm && (
        <div className="bid-form-container">
          <h2>{isEditing ? 'Cập nhật hồ sơ dự thầu' : 'Thêm hồ sơ dự thầu mới'}</h2>
          <form onSubmit={handleSubmit} className="bid-form">
            <div className="form-group">
              <label htmlFor="tenderId">Gói thầu</label>
              <select
                id="tenderId"
                name="tenderId"
                value={formData.tenderId}
                onChange={handleChange}
                required
              >
                <option value="">-- Chọn gói thầu --</option>
                {openTenders.map(tender => (
                  <option key={tender.id} value={tender.id}>
                    {tender.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="contractorId">Nhà thầu</label>
              <select
                id="contractorId"
                name="contractorId"
                value={formData.contractorId}
                onChange={handleChange}
                required
              >
                <option value="">-- Chọn nhà thầu --</option>
                {activeContractors.map(contractor => (
                  <option key={contractor.id} value={contractor.id}>
                    {contractor.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="bidAmount">Giá dự thầu (VNĐ)</label>
                <input
                  type="number"
                  id="bidAmount"
                  name="bidAmount"
                  value={formData.bidAmount}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="bidDate">Ngày nộp</label>
                <input
                  type="date"
                  id="bidDate"
                  name="bidDate"
                  value={formData.bidDate}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="technicalScore">Điểm kỹ thuật</label>
                <input
                  type="number"
                  id="technicalScore"
                  name="technicalScore"
                  value={formData.technicalScore}
                  onChange={handleChange}
                  min="0"
                  max="100"
                />
              </div>

              <div className="form-group">
                <label htmlFor="financialScore">Điểm tài chính</label>
                <input
                  type="number"
                  id="financialScore"
                  name="financialScore"
                  value={formData.financialScore}
                  onChange={handleChange}
                  min="0"
                  max="100"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="status">Trạng thái</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
              >
                {statusOptions.map(option => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={!option.editable}
                    title={
                      option.editable
                        ? 'Chỉ dùng khi cần từ chối hồ sơ'
                        : 'Hệ thống tự đặt trạng thái khi đủ/thiếu điểm'
                    }
                  >
                    {option.label} {option.editable ? '' : '(tự động)'}
                  </option>
                ))}
              </select>
              <small className="hint-text">
                Trạng thái được tự động xét theo điểm; chỉ cho phép chọn "Từ chối" khi cần loại bỏ hồ sơ.
              </small>
            </div>

            <div className="form-buttons">
              <button type="submit" className="btn-primary">
                {isEditing ? 'Cập nhật' : 'Thêm mới'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bid-list-container">
        <h2>Danh sách hồ sơ dự thầu</h2>
        
        {/* Search and Filter */}
        <div className="search-filter-container mb-3">
          <div className="search-box">
            <input
              type="text"
              placeholder="Tìm kiếm theo gói thầu, nhà thầu, giá, ngày nộp..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
          
          <div className="filter-box">
            <label>Lọc theo gói thầu:</label>
            <select value={filterTenderId} onChange={handleTenderFilterChange}>
              <option value="">Tất cả</option>
              {tenders.map(tender => (
                <option key={tender.id} value={tender.id}>
                  {tender.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-box">
            <label>Lọc theo trạng thái:</label>
            <select value={filterStatus} onChange={handleStatusFilterChange}>
              <option value="">Tất cả</option>
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredBids.length === 0 ? (
          <div className="no-data">Không có hồ sơ dự thầu nào</div>
        ) : (
          <>
            <table className="bid-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Gói thầu</th>
                  <th>Nhà thầu</th>
                  <th>Giá dự thầu (VNĐ)</th>
                  <th>Ngày nộp</th>
                  <th>Điểm kỹ thuật</th>
                  <th>Điểm tài chính</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBids.map((bid, index) => {
                  const bidId = bid.id || bid.Id;
                  return (
                    <tr key={bidId}>
                      <td>{(currentPage - 1) * 8 + index + 1}</td>
                      <td>{getTenderName(bid.tenderId)}</td>
                      <td>{getContractorName(bid.contractorId)}</td>
                      <td>{bid.bidAmount?.toLocaleString()}</td>
                      <td>{bid.bidDate}</td>
                      <td>{bid.technicalScore || '-'}</td>
                      <td>{bid.financialScore || '-'}</td>
                      <td>
                        <span className={`status-badge ${bid.status}`}>
                          {getStatusLabel(bid.status)}
                        </span>
                      </td>
                      <td className="actions">
                        <button
                          className="btn-edit"
                          onClick={() => handleEdit(bid)}
                          title="Chỉnh sửa"
                        >
                          <FaEdit />
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => handleDelete(bidId)}
                          title="Xóa"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredBids.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={totalItems}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BidManagement;
