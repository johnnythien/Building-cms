import React, { useState, useEffect } from 'react';
import callApi from '../../apis/handleApi';
import { FaPlus, FaEdit, FaTrash, FaCopy } from 'react-icons/fa';
import useToast from '../../hooks/useToast';
import './TenderCriteriaManagement.css';

const TenderCriteriaManagement = ({ tenderId, onCriteriaChanged }) => {
  const toast = useToast();
  const ToastContainer = toast.ToastContainer;
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [tenders, setTenders] = useState([]);
  const [selectedSourceTenderId, setSelectedSourceTenderId] = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [formData, setFormData] = useState({
    Name: '',
    Description: '',
    MaxScore: '',
    Weight: '',
    Type: 'TECHNICAL',
    Order: 0,
    IsActive: true
  });

  useEffect(() => {
    if (tenderId) {
      fetchCriteria();
    }
  }, [tenderId]);

  useEffect(() => {
    if (showCloneModal) {
      fetchTenders();
    }
  }, [showCloneModal]);

  useEffect(() => {
    if (selectedSourceTenderId) {
      fetchPreviewInfo(selectedSourceTenderId);
    } else {
      setPreviewInfo(null);
    }
  }, [selectedSourceTenderId]);

  const fetchCriteria = async () => {
    setLoading(true);
    try {
      const response = await callApi(`/tenders/${tenderId}/criteria`);
      setCriteria(response || []);
      setError('');
    } catch (err) {
      setError('Không thể tải danh sách tiêu chí');
      console.error('Error fetching criteria:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenders = async () => {
    try {
      const response = await callApi('/tenders');
      // Filter tenders to exclude the current one and only show those with criteria
      const filteredTenders = (response || []).filter(t => t.id !== tenderId && t.criteriaCount > 0);
      setTenders(filteredTenders);
    } catch (err) {
      console.error('Error fetching tenders for cloning:', err);
      toast.error('Không thể tải danh sách gói thầu mẫu.');
    }
  };

  const fetchPreviewInfo = async (sourceTenderId) => {
    try {
      const response = await callApi(`/tenders/${sourceTenderId}/criteria`);
      if (response && response.length > 0) {
        const technicalCount = response.filter(c => c.Type === 'TECHNICAL').length;
        const financialCount = response.filter(c => c.Type === 'FINANCIAL').length;
        setPreviewInfo({
          total: response.length,
          technical: technicalCount,
          financial: financialCount
        });
      } else {
        setPreviewInfo(null);
      }
    } catch (err) {
      console.error('Error fetching preview info:', err);
      setPreviewInfo(null);
    }
  };

  const notifyChanged = () => {
    if (onCriteriaChanged) onCriteriaChanged();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await callApi(`/tenders/${tenderId}/criteria/${editingId}`, formData, 'put');
      } else {
        await callApi(`/tenders/${tenderId}/criteria`, formData, 'post');
      }
      resetForm();
      fetchCriteria();
      toast.success(editingId ? 'Cập nhật tiêu chí thành công' : 'Tạo tiêu chí thành công');
      notifyChanged();
    } catch (err) {
      const errorMessage = err.response?.data?.message || 
                           err.response?.data?.error ||
                           err.message || 
                           'Lỗi lưu tiêu chí';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa tiêu chí này?')) {
      try {
        await callApi(`/tenders/${tenderId}/criteria/${id}`, null, 'delete');
        fetchCriteria();
        toast.success('Xóa tiêu chí thành công');
        notifyChanged();
      } catch (err) {
        const errorMessage = err.response?.data?.message || 
                             err.response?.data?.error ||
                             err.message || 
                             'Lỗi xóa tiêu chí';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      Name: '',
      Description: '',
      MaxScore: '',
      Weight: '',
      Type: 'TECHNICAL',
      Order: 0,
      IsActive: true
    });
    setEditingId(null);
    setShowForm(false);
  };

  const calculateTotalWeight = (type) => {
    return criteria
      .filter(c => c.Type === type && c.IsActive)
      .reduce((sum, c) => sum + (parseFloat(c.Weight) || 0), 0);
  };

  const technicalWeight = calculateTotalWeight('TECHNICAL');
  const financialWeight = calculateTotalWeight('FINANCIAL');

  const handleCloneCriteria = async () => {
    if (!selectedSourceTenderId) {
      toast.error('Vui lòng chọn gói thầu nguồn');
      return;
    }

    setCloneLoading(true);
    try {
      const response = await callApi(`/tenders/${tenderId}/clone-criteria`, {
        sourceTenderId: parseInt(selectedSourceTenderId, 10)
      }, 'post');
      
      toast.success(response.message || 'Sao chép tiêu chí thành công');
      setShowCloneModal(false);
      setSelectedSourceTenderId('');
      setPreviewInfo(null);
      fetchCriteria(); // Reload criteria
      notifyChanged();
    } catch (err) {
      const errorMessage = err.response?.data?.message || 
                           err.response?.data?.error ||
                           err.message || 
                           'Lỗi sao chép tiêu chí';
      toast.error(errorMessage);
    } finally {
      setCloneLoading(false);
    }
  };

  // Filter tenders for clone modal
  const availableTenders = tenders.filter(t => 
    t.id !== tenderId && 
    t.criteriaCount > 0
  );

  if (!tenderId) {
    return <div className="tender-criteria-management">Vui lòng chọn gói thầu</div>;
  }

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (
    <div className="tender-criteria-management">
      <ToastContainer />
      <div className="header">
        <h3>Quản lý tiêu chí chấm thầu</h3>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setShowCloneModal(true)}>
            <FaCopy /> Sao chép từ gói thầu cũ
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <FaPlus /> Thêm tiêu chí
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Weight Summary */}
      <div className="weight-summary">
        <div className={`weight-item ${technicalWeight === 100 ? 'valid' : 'invalid'}`}>
          <strong>Tổng Weight Kỹ thuật:</strong> {technicalWeight.toFixed(2)}%
          {technicalWeight !== 100 && <span className="error-text"> (Phải = 100%)</span>}
        </div>
        <div className={`weight-item ${financialWeight === 100 ? 'valid' : 'invalid'}`}>
          <strong>Tổng Weight Tài chính:</strong> {financialWeight.toFixed(2)}%
          {financialWeight !== 100 && <span className="error-text"> (Phải = 100%)</span>}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="criteria-form">
          <h4>{editingId ? 'Chỉnh sửa' : 'Thêm mới'} tiêu chí</h4>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Tên tiêu chí *</label>
              <input
                type="text"
                value={formData.Name}
                onChange={(e) => setFormData({...formData, Name: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Mô tả</label>
              <textarea
                value={formData.Description}
                onChange={(e) => setFormData({...formData, Description: e.target.value})}
                rows="2"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Điểm tối đa *</label>
                <input
                  type="number"
                  value={formData.MaxScore}
                  onChange={(e) => setFormData({...formData, MaxScore: e.target.value})}
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label>Trọng số (%) *</label>
                <input
                  type="number"
                  value={formData.Weight}
                  onChange={(e) => setFormData({...formData, Weight: e.target.value})}
                  min="0"
                  max="100"
                  step="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label>Loại *</label>
                <select
                  value={formData.Type}
                  onChange={(e) => setFormData({...formData, Type: e.target.value})}
                  required
                >
                  <option value="TECHNICAL">Kỹ thuật</option>
                  <option value="FINANCIAL">Tài chính</option>
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Cập nhật' : 'Thêm'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Criteria List */}
      <div className="criteria-list">
        <h4>Danh sách tiêu chí</h4>
        {criteria.length === 0 ? (
          <div className="no-data">Chưa có tiêu chí nào</div>
        ) : (
          <table className="criteria-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Loại</th>
                <th>Điểm tối đa</th>
                <th>Trọng số</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {criteria.map(c => (
                <tr key={c.Id}>
                  <td>{c.Name}</td>
                  <td>
                    <span className={`badge ${c.Type === 'TECHNICAL' ? 'badge-info' : 'badge-success'}`}>
                      {c.Type === 'TECHNICAL' ? 'Kỹ thuật' : 'Tài chính'}
                    </span>
                  </td>
                  <td>{c.MaxScore}</td>
                  <td>{c.Weight}%</td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn-edit"
                        onClick={() => {
                          setFormData(c);
                          setEditingId(c.Id);
                          setShowForm(true);
                        }}
                        title="Chỉnh sửa"
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(c.Id)}
                        title="Xóa"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Clone Criteria Modal */}
      {showCloneModal && (
        <div className="modal-overlay" onClick={() => !cloneLoading && setShowCloneModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Sao chép tiêu chí từ gói thầu</h4>
              <button 
                className="modal-close" 
                onClick={() => setShowCloneModal(false)}
                disabled={cloneLoading}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Chọn gói thầu nguồn *</label>
                <select
                  value={selectedSourceTenderId}
                  onChange={(e) => setSelectedSourceTenderId(e.target.value)}
                  disabled={cloneLoading}
                  className="form-control"
                >
                  <option value="">-- Chọn gói thầu --</option>
                  {tenders.map(tender => (
                    <option key={tender.id} value={tender.id}>
                      [{tender.code || `#${tender.id}`}] {tender.name} (Số lượng tiêu chí: {tender.criteriaCount})
                    </option>
                  ))}
                </select>
                {tenders.length === 0 && (
                  <div className="text-muted">
                    Không có gói thầu nào có tiêu chí để sao chép
                  </div>
                )}
              </div>

              {/* Preview Info */}
              {previewInfo && (
                <div className="preview-info">
                  <strong>Tóm tắt tiêu chí:</strong>
                  <ul>
                    <li>Tổng số: <strong>{previewInfo.total}</strong> tiêu chí</li>
                    <li>Kỹ thuật: <strong>{previewInfo.technical}</strong> tiêu chí</li>
                    <li>Tài chính: <strong>{previewInfo.financial}</strong> tiêu chí</li>
                  </ul>
                </div>
              )}

              <div className="info-box">
                <span className="info-icon">ℹ️</span>
                <span className="info-text">Hành động này sẽ thay thế toàn bộ tiêu chí hiện tại.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-light"
                onClick={() => {
                  setShowCloneModal(false);
                  setSelectedSourceTenderId('');
                  setPreviewInfo(null);
                }}
                disabled={cloneLoading}
              >
                Hủy
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCloneCriteria}
                disabled={!selectedSourceTenderId || cloneLoading}
              >
                <FaCopy style={{ marginRight: '8px' }} />
                {cloneLoading ? 'Đang sao chép...' : 'Sao chép'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenderCriteriaManagement;

