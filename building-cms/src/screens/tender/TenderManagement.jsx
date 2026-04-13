import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import callApi from '../../apis/handleApi';
import { FaPlus, FaPen, FaTrash, FaEye, FaList, FaClipboardList, FaExchangeAlt, FaFileAlt, FaCalculator, FaEdit } from 'react-icons/fa';
import { Container, Tab, Tabs } from 'react-bootstrap';
import { getStatusLabel, getStatusBadgeClass, getStatusOptions, TENDER_STATUS } from '../../utils/tenderStatusHelper';
import TenderStatusTransition from './TenderStatusTransition';
import TenderCriteriaManagement from './TenderCriteriaManagement';
import TenderScoring from './TenderScoring';
import BidList from './BidList';
import BidCriteriaScores from './BidCriteriaScores';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import './TenderManagement.css';

const TenderManagement = () => {
  const { user } = useAuth();
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTenderId, setSelectedTenderId] = useState(null);
  const [selectedBidId, setSelectedBidId] = useState(null);
  const [activeTab, setActiveTab] = useState('list');
  const [bidListRefreshTrigger, setBidListRefreshTrigger] = useState(0);
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);
  const [contractors, setContractors] = useState([]);
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidFormData, setBidFormData] = useState({
    contractorId: '',
    bidAmount: '',
    bidDate: new Date().toISOString().split('T')[0]
  });
  const [formData, setFormData] = useState({
    id: '',
    code: '',
    name: '',
    description: '',
    estimatedBudget: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    status: TENDER_STATUS.DRAFT,
    documents: []
  });
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const statusOptions = getStatusOptions();

  // Lọc gói thầu theo tìm kiếm và bộ lọc
  const filteredTenders = tenders.filter(tender => {
    const searchFields = [
      tender.code,
      tender.name,
      tender.description,
      tender.estimatedBudget?.toString(),
      getStatusLabel(tender.status)
    ].map(field => field?.toLowerCase() || '');

    const matchesSearch = searchTerm === '' || 
      searchFields.some(field => field.includes(searchTerm.toLowerCase()));
    
    const matchesFilter = !filterStatus || tender.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  // Thêm phân trang
  const {
    currentItems: paginatedTenders,
    currentPage,
    totalPages,
    totalItems,
    setCurrentPage
  } = usePagination(filteredTenders);

  useEffect(() => {
    fetchTenders();
    fetchContractors();
  }, []);

  const fetchContractors = async () => {
    try {
      const response = await callApi('/contractors');
      setContractors(response);
    } catch (err) {
      console.error('Error fetching contractors:', err);
    }
  };

  const fetchTenders = async () => {
    setLoading(true);
    try {
      const response = await callApi('/tenders');
      setTenders(response);
      setError('');
    } catch (err) {
      setError('Không thể tải dữ liệu gói thầu. Vui lòng thử lại sau.');
      console.error('Error fetching tenders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      createdBy: user.id,
      createdAt: new Date().toISOString().split('T')[0],
      estimatedBudget: parseFloat(formData.estimatedBudget)
    };
    try {
      if (isEditing) {
        await callApi(`/tenders/${formData.id}`, payload, 'put');
      } else {
        await callApi('/tenders', payload, 'post');
      }
      resetForm();
      fetchTenders();
      setShowForm(false);
      // Nếu đang xem chi tiết, refresh lại
      if (selectedTenderId) {
        fetchTenders();
      }
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      const fallback = isEditing
        ? 'Không thể cập nhật gói thầu khi đã mở hoặc đã đóng. Vui lòng kiểm tra trạng thái.'
        : 'Không thể tạo gói thầu mới. Vui lòng thử lại.';
      setError(apiMessage || fallback);
      console.error('Error submitting tender:', err);
    }
  };

  const handleEdit = (tender) => {
    setFormData({
      id: tender.id,
      code: tender.code,
      name: tender.name,
      description: tender.description || '',
      estimatedBudget: tender.estimatedBudget,
      startDate: tender.startDate,
      endDate: tender.endDate,
      status: tender.status,
      documents: tender.documents || []
    });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleViewDetails = (tenderId) => {
    setSelectedTenderId(tenderId);
    setSelectedBidId(null);
    setActiveTab('details');
    setShowForm(false);
  };

  const handleBackToList = () => {
    setSelectedTenderId(null);
    setSelectedBidId(null);
    setActiveTab('list');
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterChange = (e) => {
    setFilterStatus(e.target.value);
    setCurrentPage(1);
  };

  const handleBidSelected = (bidId) => {
    setSelectedBidId(bidId);
    setActiveTab('scoring-detail');
  };

  const handleAddBid = () => {
    setBidFormData({
      contractorId: '',
      bidAmount: '',
      bidDate: new Date().toISOString().split('T')[0]
    });
    setShowBidForm(true);
  };

  const handleBidFormChange = (e) => {
    const { name, value } = e.target;
    setBidFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleBidSubmit = async (e) => {
    e.preventDefault();
    try {
      await callApi('/bids', {
        tenderId: selectedTenderId,
        contractorId: parseInt(bidFormData.contractorId, 10),
        bidAmount: parseFloat(bidFormData.bidAmount),
        bidDate: bidFormData.bidDate
      }, 'post');
      setShowBidForm(false);
      setBidListRefreshTrigger(prev => prev + 1);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tạo hồ sơ dự thầu. Vui lòng thử lại.');
      console.error('Error submitting bid:', err);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa gói thầu này không?')) {
      try {
        await callApi(`/tenders/${id}`, null, 'delete');
        fetchTenders();
      } catch (err) {
        setError('Không thể xóa gói thầu. Vui lòng thử lại.');
        console.error('Error deleting tender:', err);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      code: '',
      name: '',
      description: '',
      estimatedBudget: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      status: TENDER_STATUS.DRAFT,
      documents: []
    });
    setIsEditing(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN').format(date);
  };


  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  const selectedTender = tenders.find(t => t.id === selectedTenderId);

  return (
    <Container fluid className="tender-management-content">
      <div className="page-header-wrapper mb-4">
        <div className="page-header">
          <h1 className="page-title">Quản lý gói thầu</h1>
          {selectedTenderId ? (
            <div className="tender-header">
              <button className="btn btn-secondary btn-back" onClick={handleBackToList}>
                <span className="btn-icon">←</span>
                <span className="btn-text">Quay lại danh sách</span>
              </button>
              <h2 className="selected-tender-name">{selectedTender?.name || `Gói thầu #${selectedTenderId}`}</h2>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}>
              Thêm gói thầu mới
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {!selectedTenderId ? (
        <>
          {showForm && (
        <div className="tender-form-container">
          <h2>{isEditing ? 'Cập nhật gói thầu' : 'Tạo gói thầu mới'}</h2>
          <form onSubmit={handleSubmit} className="tender-form">
            <div className="form-group">
              <label htmlFor="code">Mã gói thầu</label>
              <input
                type="text"
                id="code"
                name="code"
                value={formData.code}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="name">Tên gói thầu</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Mô tả</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
              />
            </div>

            <div className="form-group">
              <label htmlFor="estimatedBudget">Ngân sách dự kiến (VND)</label>
              <input
                type="number"
                id="estimatedBudget"
                name="estimatedBudget"
                value={formData.estimatedBudget}
                onChange={handleChange}
                min="0"
                step="1000000"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="startDate">Ngày bắt đầu</label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="endDate">Ngày kết thúc</label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  required
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
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-buttons">
              <button type="submit" className="btn-primary">
                {isEditing ? 'Cập nhật' : 'Tạo mới'}
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

      <div className="tender-list-container">
        <h2>Danh sách gói thầu</h2>
        
        {/* Search and Filter */}
        <div className="search-filter-container mb-3">
          <div className="search-box">
            <input
              type="text"
              placeholder="Tìm kiếm theo mã, tên, mô tả, ngân sách..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
          
          <div className="filter-box">
            <label>Lọc theo trạng thái:</label>
            <select value={filterStatus} onChange={handleFilterChange}>
              <option value="">Tất cả</option>
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredTenders.length === 0 ? (
          <div className="no-data">Không có gói thầu nào</div>
        ) : (
          <>
            <table className="tender-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Mã</th>
                  <th>Tên gói thầu</th>
                  <th>Ngân sách</th>
                  <th>Ngày bắt đầu</th>
                  <th>Ngày kết thúc</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTenders.map((tender, index) => (
                  <tr key={tender.id}>
                    <td>{(currentPage - 1) * 8 + index + 1}</td>
                    <td>{tender.code}</td>
                    <td>{tender.name}</td>
                    <td>{formatCurrency(tender.estimatedBudget)}</td>
                    <td>{formatDate(tender.startDate)}</td>
                    <td>{formatDate(tender.endDate)}</td>
                    <td>
                      <span className={`status-badge ${tender.status.toLowerCase()}`}>
                        {getStatusLabel(tender.status)}
                      </span>
                    </td>
                    <td className="actions">
                      <button
                        className="btn-edit"
                        onClick={() => {
                          handleEdit(tender);
                          // Scroll to form after a short delay to ensure it's rendered
                          setTimeout(() => {
                            const formElement = document.querySelector('.tender-form-container');
                            if (formElement) {
                              formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }, 100);
                        }}
                        title="Chỉnh sửa"
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(tender.id)}
                        title="Xóa"
                      >
                        <FaTrash />
                      </button>
                      <button
                        className="btn-view"
                        onClick={() => handleViewDetails(tender.id)}
                        title="Xem chi tiết"
                      >
                        <FaEye />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredTenders.length > 0 && (
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
        </>
      ) : (
        <Tabs
          id="tender-details-tabs"
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k)}
          className="mb-3 tender-details-tabs"
        >
          <Tab
            eventKey="details"
            title={
              <span>
                <FaList className="me-2" />
                Thông tin chung
              </span>
            }
          >
            <div className="tab-content">
              {showForm && (
                <div className="tender-form-container">
                  <h2>{isEditing ? 'Cập nhật gói thầu' : 'Tạo gói thầu mới'}</h2>
                  <form onSubmit={handleSubmit} className="tender-form">
                    <div className="form-group">
                      <label htmlFor="code">Mã gói thầu</label>
                      <input
                        type="text"
                        id="code"
                        name="code"
                        value={formData.code}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="name">Tên gói thầu</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="description">Mô tả</label>
                      <textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows="3"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="estimatedBudget">Ngân sách dự kiến (VND)</label>
                      <input
                        type="number"
                        id="estimatedBudget"
                        name="estimatedBudget"
                        value={formData.estimatedBudget}
                        onChange={handleChange}
                        min="0"
                        step="1000000"
                        required
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="startDate">Ngày bắt đầu</label>
                        <input
                          type="date"
                          id="startDate"
                          name="startDate"
                          value={formData.startDate}
                          onChange={handleChange}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="endDate">Ngày kết thúc</label>
                        <input
                          type="date"
                          id="endDate"
                          name="endDate"
                          value={formData.endDate}
                          onChange={handleChange}
                          required
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
                        disabled={formData.status !== TENDER_STATUS.DRAFT}
                      >
                        {statusOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {formData.status !== TENDER_STATUS.DRAFT && (
                        <small className="form-text text-muted">
                          Chỉ có thể sửa trạng thái qua tab "Chuyển trạng thái"
                        </small>
                      )}
                    </div>

                    <div className="form-buttons">
                      <button type="submit" className="btn-primary">
                        {isEditing ? 'Cập nhật' : 'Tạo mới'}
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
              {!showForm && selectedTender && (
                <div className="tender-info-card">
                  <h3>Thông tin gói thầu</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Mã gói thầu:</label>
                      <span>{selectedTender.code}</span>
                    </div>
                    <div className="info-item">
                      <label>Tên gói thầu:</label>
                      <span>{selectedTender.name}</span>
                    </div>
                    <div className="info-item">
                      <label>Mô tả:</label>
                      <span>{selectedTender.description || 'Không có'}</span>
                    </div>
                    <div className="info-item">
                      <label>Ngân sách:</label>
                      <span>{formatCurrency(selectedTender.estimatedBudget)}</span>
                    </div>
                    <div className="info-item">
                      <label>Ngày bắt đầu:</label>
                      <span>{formatDate(selectedTender.startDate)}</span>
                    </div>
                    <div className="info-item">
                      <label>Ngày kết thúc:</label>
                      <span>{formatDate(selectedTender.endDate)}</span>
                    </div>
                    <div className="info-item">
                      <label>Trạng thái:</label>
                      <span className={`status-badge ${selectedTender.status.toLowerCase()}`}>
                        {getStatusLabel(selectedTender.status)}
                      </span>
                    </div>
                  </div>
                  <div className="info-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        handleEdit(selectedTender);
                        setShowForm(true);
                        // Scroll to form after a short delay to ensure it's rendered
                        setTimeout(() => {
                          const formElement = document.querySelector('.tender-form-container');
                          if (formElement) {
                            formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }, 100);
                      }}
                    >
                      <FaEdit /> Chỉnh sửa
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Tab>

          <Tab
            eventKey="criteria"
            title={
              <span>
                <FaClipboardList className="me-2" />
                Tiêu chí chấm thầu
              </span>
            }
          >
            <div className="tab-content">
              <TenderCriteriaManagement 
                tenderId={selectedTenderId}
                onCriteriaChanged={() => setStatusRefreshKey(prev => prev + 1)}
              />
            </div>
          </Tab>

          <Tab
            eventKey="status"
            title={
              <span>
                <FaExchangeAlt className="me-2" />
                Chuyển trạng thái
              </span>
            }
          >
            <div className="tab-content">
              <TenderStatusTransition 
                tenderId={selectedTenderId} 
                refreshKey={statusRefreshKey}
                onStatusChanged={() => {
                  fetchTenders();
                  // Refresh selected tender
                  const updated = tenders.find(t => t.id === selectedTenderId);
                  if (updated) {
                    setSelectedTenderId(null);
                    setTimeout(() => setSelectedTenderId(selectedTenderId), 100);
                  }
                }}
              />
            </div>
          </Tab>

          <Tab
            eventKey="bids"
            title={
              <span>
                <FaFileAlt className="me-2" />
                Hồ sơ dự thầu
              </span>
            }
          >
            <div className="tab-content">
              <BidList 
                tenderId={selectedTenderId} 
                onBidSelect={handleBidSelected}
                refreshTrigger={bidListRefreshTrigger}
                tenderStatus={selectedTender?.status}
                onAddBid={handleAddBid}
              />
              {showBidForm && (
                <div className="modal-overlay" onClick={() => setShowBidForm(false)}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <h3>Thêm hồ sơ dự thầu mới</h3>
                    <form onSubmit={handleBidSubmit}>
                      <div className="form-group">
                        <label htmlFor="contractorId">Nhà thầu *</label>
                        <select
                          id="contractorId"
                          name="contractorId"
                          value={bidFormData.contractorId}
                          onChange={handleBidFormChange}
                          required
                        >
                          <option value="">-- Chọn nhà thầu --</option>
                          {contractors.map(contractor => (
                            <option key={contractor.Id} value={contractor.Id}>
                              {contractor.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="bidAmount">Giá dự thầu (VNĐ) *</label>
                        <input
                          type="number"
                          id="bidAmount"
                          name="bidAmount"
                          value={bidFormData.bidAmount}
                          onChange={handleBidFormChange}
                          min="0"
                          step="1000"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="bidDate">Ngày nộp hồ sơ *</label>
                        <input
                          type="date"
                          id="bidDate"
                          name="bidDate"
                          value={bidFormData.bidDate}
                          onChange={handleBidFormChange}
                          required
                        />
                      </div>
                      <div className="form-buttons">
                        <button type="submit" className="btn-primary">
                          Tạo hồ sơ
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setShowBidForm(false)}
                        >
                          Hủy
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </Tab>

          <Tab
            eventKey="scoring"
            title={
              <span>
                <FaCalculator className="me-2" />
                Tính điểm
              </span>
            }
          >
            <div className="tab-content">
              <TenderScoring 
                tenderId={selectedTenderId}
                onScoresCalculated={() => {
                  fetchTenders();
                }}
              />
            </div>
          </Tab>

          {selectedBidId && (
            <Tab
              eventKey="scoring-detail"
              title={
                <span>
                  <FaEdit className="me-2" />
                  Chấm điểm chi tiết
                </span>
              }
            >
              <div className="tab-content">
                <BidCriteriaScores 
                  tenderId={selectedTenderId}
                  bidId={selectedBidId}
                  onScoresUpdated={() => {
                    // Refresh tender list để cập nhật điểm mới
                    fetchTenders();
                    // Trigger refresh BidList để cập nhật điểm ngay lập tức
                    setBidListRefreshTrigger(prev => prev + 1);
                  }}
                />
              </div>
            </Tab>
          )}
        </Tabs>
      )}
    </Container>
  );
};

export default TenderManagement;
