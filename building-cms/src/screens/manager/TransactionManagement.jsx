import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import callApi from '../../apis/handleApi';
import './TransactionManagement.css';
import { Link } from 'react-router-dom';
// Removed: import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/layout/PageHeader';
import { Collapse } from 'bootstrap';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';

const TransactionManagement = () => {
  const { logout } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({
    id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    categoryId: '',
    description: '',
    type: 'income', // 'income' hoặc 'expense'
  });
  const [isEditing, setIsEditing] = useState(false);
  const [filters, setFilters] = useState({
    type: 'all',
    category: 'all',
    dateFrom: '',
    dateTo: '',
    searchTerm: '',
  });

  useEffect(() => {
    fetchCategories();
    fetchTransactions();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await callApi('/categories');
      setCategories(response);
    } catch (err) {
      setError('Không thể tải danh mục. Vui lòng thử lại sau.');
      console.error('Error fetching categories:', err);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      // Sử dụng endpoint mới để lấy giao dịch kèm thông tin thuế
      const response = await callApi('/transactions/with-taxes');
      setTransactions(response);
      setError('');
    } catch (err) {
      // Fallback về endpoint cũ nếu endpoint mới không tồn tại
      try {
        const response = await callApi('/transactions');
        setTransactions(response.map(t => ({ ...t, totalTaxAmount: 0, taxCount: 0 })));
        setError('');
      } catch (err2) {
        setError('Không thể tải dữ liệu thu chi. Vui lòng thử lại sau.');
        console.error('Error fetching transactions:', err2);
      }
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
    
    // Tự động chọn loại thu/chi dựa vào danh mục đã chọn
    if (name === 'categoryId' && value) {
      const selectedCategory = categories.find(cat => cat.id === value);
      if (selectedCategory) {
        setFormData(prev => ({
          ...prev,
          type: selectedCategory.type
        }));
      }
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    
    try {
      if (isEditing) {
        // Cập nhật giao dịch
        await callApi(`/transactions/${formData.id}`, formData, 'put');
        setSuccessMessage('Cập nhật giao dịch thành công! Thuế đã được tự động tính lại.');
      } else {
        // Tạo giao dịch mới
        await callApi('/transactions', formData, 'post');
        if (formData.categoryId) {
          setSuccessMessage('Tạo giao dịch thành công! Thuế đã được tự động tính.');
        } else {
          setSuccessMessage('Tạo giao dịch thành công! (Lưu ý: Giao dịch không có danh mục sẽ không được tính thuế)');
        }
      }
      
      // Reset form và tải lại danh sách
      resetForm();
      fetchTransactions();
      
      // Tự động ẩn thông báo sau 5 giây
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(isEditing 
        ? 'Không thể cập nhật giao dịch. Vui lòng thử lại.' 
        : 'Không thể tạo giao dịch mới. Vui lòng thử lại.');
      console.error('Error submitting transaction:', err);
    }
  };

  const handleEdit = (transaction) => {
    setFormData({
      id: transaction.id,
      amount: transaction.amount,
      date: new Date(transaction.date).toISOString().split('T')[0],
      categoryId: parseInt(transaction.categoryId, 10),
      description: transaction.description || '',
      type: transaction.type,
    });
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa giao dịch này không?')) {
      try {
        await callApi(`/transactions/${id}`, null, 'delete');
        fetchTransactions();
      } catch (err) {
        setError('Không thể xóa giao dịch. Vui lòng thử lại.');
        console.error('Error deleting transaction:', err);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      categoryId: '',
      description: '',
      type: 'income',
    });
    setIsEditing(false);
  };

  const getCategoryName = (categoryId) => {
    if (!categoryId) return 'Không xác định';
    
    // Chuyển đổi categoryId thành số nếu là chuỗi
    const categoryIdNum = parseInt(categoryId, 10);
    
    // Tìm categoryId dưới dạng số hoặc dạng chuỗi
    const category = categories.find(cat => 
      cat.id === categoryIdNum || cat.id === categoryId.toString()
    );
    
    return category ? category.name : 'Không xác định';
  };

  const filteredTransactions = transactions.filter(transaction => {
    // Lọc theo loại giao dịch
    const matchesType = filters.type === 'all' || transaction.type === filters.type;

    // Lọc theo danh mục (ép kiểu về chuỗi để so sánh)
    const matchesCategory = filters.category === 'all' || String(transaction.categoryId) === String(filters.category);

    // Lọc theo ngày (chỉ lấy phần yyyy-mm-dd)
    const transactionDate = transaction.date ? transaction.date.slice(0, 10) : '';
    const dateFrom = filters.dateFrom ? filters.dateFrom.slice(0, 10) : '';
    const dateTo = filters.dateTo ? filters.dateTo.slice(0, 10) : '';

    const matchesDateFrom = !dateFrom || transactionDate >= dateFrom;
    const matchesDateTo = !dateTo || transactionDate <= dateTo;

    // Lọc theo từ khóa (mô tả, tên danh mục, loại giao dịch)
    const search = filters.searchTerm?.toLowerCase() || '';
    const matchesSearch = !search ||
      (transaction.description && transaction.description.toLowerCase().includes(search)) ||
      getCategoryName(transaction.categoryId).toLowerCase().includes(search) ||
      (transaction.type === 'income' && 'thu'.includes(search)) ||
      (transaction.type === 'expense' && 'chi'.includes(search));

    return matchesType && matchesCategory && matchesDateFrom && matchesDateTo && matchesSearch;
  });

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  // Số dư ban đầu là 5 tỷ đồng (đồng bộ với trang Tổng quan)
  const initialBalance = 5000000000;

  // Số dư = số dư ban đầu + tổng thu - tổng chi
  const balance = initialBalance + totalIncome - totalExpense;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatDate = (dateString) => {
    try {
      if (!dateString) return '';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Return original string if invalid date
      return new Intl.DateTimeFormat('vi-VN').format(date);
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString; // Return original string if any error occurs
    }
  };

  const handleAddTransaction = () => {
    setIsEditing(false);
    resetForm();
    // Toggle the collapse
    const collapseElement = document.getElementById('transactionForm');
    const bsCollapse = new Collapse(collapseElement);
    bsCollapse.show();
  };

  // Sử dụng custom hook phân trang
  const {
    currentItems: paginatedTransactions,
    currentPage,
    totalPages,
    totalItems,
    setCurrentPage,
  } = usePagination(filteredTransactions);

  // Show loading state
  if (loading) {
    return (
      <>
        <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
          <div className="loading-spinner"></div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Page header */}
      <div className="page-header-wrapper mb-4">
        <PageHeader 
          title="Quản lý giao dịch" 
          buttonText="Thêm giao dịch mới"
          onButtonClick={handleAddTransaction}
        />
      </div>

      {/* Error display */}
      {error && <div className="alert alert-danger">{error}</div>}
      
      {/* Success message */}
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          {successMessage}
          <button 
            type="button" 
            className="btn-close" 
            onClick={() => setSuccessMessage('')}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* Transaction form */}
      <div className="collapse mb-4" id="transactionForm">
        <div className="card shadow-sm border-0 rounded-4">
          <div className="card-header d-flex justify-content-between align-items-center bg-light rounded-top-4 border-bottom-0">
            <h5 className="mb-0 fw-bold text-primary">{isEditing ? 'Chỉnh sửa giao dịch' : 'Thêm giao dịch mới'}</h5>
            {isEditing && (
              <button className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={resetForm}>
                Hủy chỉnh sửa
              </button>
            )}
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} className="needs-validation" noValidate>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small text-secondary">Loại giao dịch</label>
                  <select
                    name="type"
                    className="form-select rounded-pill"
                    value={formData.type}
                    onChange={handleChange}
                  >
                    <option value="income">Thu</option>
                    <option value="expense">Chi</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small text-secondary">Danh mục</label>
                  <select
                    name="categoryId"
                    className="form-select rounded-pill"
                    value={formData.categoryId}
                    onChange={handleChange}
                    required
                  >
                    <option value="" disabled>Chọn danh mục</option>
                    {categories
                      .filter(cat => cat.type === formData.type)
                      .map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small text-secondary">Số tiền</label>
                  <div className="input-group">
                    <input
                      type="number"
                      name="amount"
                      className="form-control rounded-pill"
                      value={formData.amount}
                      onChange={handleChange}
                      placeholder="Nhập số tiền"
                      required
                    />
                    <span className="input-group-text rounded-end-pill">VND</span>
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label small text-secondary">Ngày giao dịch</label>
                  <input
                    type="date"
                    name="date"
                    className="form-control rounded-pill"
                    value={formData.date}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label small text-secondary">Mô tả</label>
                <textarea
                  name="description"
                  className="form-control rounded-4"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Nhập mô tả giao dịch"
                  rows="3"
                />
              </div>
              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-pill px-4"
                  data-bs-toggle="collapse"
                  data-bs-target="#transactionForm"
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm">
                  {isEditing ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4 shadow-sm border-0 rounded-4">
        <div className="card-header bg-light rounded-top-4 border-bottom-0">
          <h5 className="mb-0 fw-bold text-primary">Bộ lọc</h5>
        </div>
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label small text-secondary">Loại giao dịch</label>
              <select
                name="type"
                className="form-select rounded-pill"
                value={filters.type}
                onChange={handleFilterChange}
              >
                <option value="all">Tất cả</option>
                <option value="income">Thu</option>
                <option value="expense">Chi</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small text-secondary">Danh mục</label>
              <select
                name="category"
                className="form-select rounded-pill"
                value={filters.category}
                onChange={handleFilterChange}
              >
                <option value="all">Tất cả</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small text-secondary">Từ ngày</label>
              <input
                type="date"
                name="dateFrom"
                className="form-control rounded-pill"
                value={filters.dateFrom}
                onChange={handleFilterChange}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small text-secondary">Đến ngày</label>
              <input
                type="date"
                name="dateTo"
                className="form-control rounded-pill"
                value={filters.dateTo}
                onChange={handleFilterChange}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small text-secondary">&nbsp;</label>
              <div className="input-group">
                <input
                  type="text"
                  name="searchTerm"
                  className="form-control rounded-pill"
                  placeholder="Tìm kiếm giao dịch..."
                  value={filters.searchTerm}
                  onChange={handleFilterChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial summary */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card text-white bg-success h-100">
            <div className="card-body">
              <h5 className="card-title">Tổng thu</h5>
              <p className="card-text fs-3">{formatCurrency(totalIncome)}</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-white bg-danger h-100">
            <div className="card-body">
              <h5 className="card-title">Tổng chi</h5>
              <p className="card-text fs-3">{formatCurrency(totalExpense)}</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-white bg-primary h-100">
            <div className="card-body">
              <h5 className="card-title">Số dư</h5>
              <p className="card-text fs-3">{formatCurrency(totalIncome - totalExpense)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction list */}
      <div className="data-table-container">
        <div className="data-table-header">
          <h5 className="mb-0">Danh sách giao dịch</h5>
        </div>
        <div className="table-responsive">
          <table className="data-table table align-middle">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>#</th>
                <th>Mô tả</th>
                <th>Danh mục</th>
                <th style={{ width: '120px' }}>Ngày</th>
                <th style={{ width: '150px' }}>Số tiền</th>
                <th style={{ width: '120px' }}>Thuế</th>
                <th style={{ width: '100px' }}>Loại</th>
                <th style={{ width: '120px' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.length > 0 ? (
                paginatedTransactions.map((transaction, index) => {
                  const hasTax = transaction.totalTaxAmount && parseFloat(transaction.totalTaxAmount) > 0;
                  return (
                    <tr key={transaction.id}>
                      <td>{(currentPage - 1) * totalItems + index + 1}</td>
                      <td>{transaction.description}</td>
                      <td>{getCategoryName(transaction.categoryId)}</td>
                      <td>{formatDate(transaction.date)}</td>
                      <td className={`fw-bold text-${transaction.type === 'income' ? 'success' : 'danger'}`}>
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td>
                        {hasTax ? (
                          <span 
                            className="badge bg-warning text-dark" 
                            title={`Có ${transaction.taxCount} loại thuế`}
                            style={{ cursor: 'help' }}
                          >
                            {formatCurrency(transaction.totalTaxAmount)}
                          </span>
                        ) : transaction.categoryId ? (
                          <span className="text-muted" style={{ fontSize: '0.85rem' }}>Chưa tính</span>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '0.85rem' }}>-</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${transaction.type === 'income' ? 'success' : 'danger'}`}>
                          {transaction.type === 'income' ? 'Thu' : 'Chi'}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <button
                            className="btn btn-outline-primary edit-btn"
                            onClick={() => handleEdit(transaction)}
                            data-bs-toggle="collapse"
                            data-bs-target="#transactionForm"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            className="btn btn-outline-danger delete-btn"
                            onClick={() => handleDelete(transaction.id)}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-4">
                    <div className="empty-state-icon">📊</div>
                    <div className="empty-state-title">Chưa có giao dịch nào</div>
                    <div>Thêm giao dịch mới để bắt đầu theo dõi tài chính</div>
                    <button
                      className="btn btn-sm btn-primary mt-3"
                      data-bs-toggle="collapse"
                      data-bs-target="#transactionForm"
                    >
                      Thêm giao dịch mới
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Thêm phân trang */}
        {filteredTransactions.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
          />
        )}
      </div>
    </>
  );
};

export default TransactionManagement;