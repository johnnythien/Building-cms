import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import callApi from '../../apis/handleApi';
import './ManagerDashboard.css';

const ManagerDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [dashboardData, setDashboardData] = useState({
    totalTransactions: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    balance: 0,
    pendingInvoices: 0,
    recentTransactions: [],
    transactionsByCategoryData: [],
    monthlyComparisonData: [],
    reportPeriod: ''
  });

  // Fetch dashboard data when component mounts or gets focus
  useEffect(() => {
    fetchAvailableYears();
    
    // Add event listener for when the page gets focus
    window.addEventListener('focus', handlePageFocus);
    
    // Cleanup listener
    return () => {
      window.removeEventListener('focus', handlePageFocus);
    };
  }, []);
  
  // Handle page focus
  const handlePageFocus = () => {
    // Refresh data when user returns to this page
    fetchAvailableYears();
  };

  // Fetch data when selected year/month changes
  useEffect(() => {
    if (availableYears.length > 0) {
      fetchDashboardData();
    }
  }, [selectedYear, selectedMonth, availableYears]);

  const fetchAvailableYears = async () => {
    try {
      const allReportsResponse = await callApi('/reports');
      const years = [...new Set(allReportsResponse.map(report => report.year))].sort((a, b) => b - a);
      setAvailableYears(years);
      
      // Set initial year to current or most recent available
      if (years.length > 0) {
        const currentYear = new Date().getFullYear();
        if (years.includes(currentYear)) {
          setSelectedYear(currentYear);
        } else {
          setSelectedYear(Math.max(...years));
        }
      }
    } catch (err) {
      console.error('Lỗi khi lấy danh sách năm:', err);
      setError('Không thể tải dữ liệu năm. Vui lòng thử lại sau.');
    }
  };

  // Tạo lại báo cáo để đảm bảo dữ liệu mới nhất
  const regenerateReport = async () => {
    try {
      const result = await callApi('/reports/generate', {
        month: selectedMonth,
        year: selectedYear
      }, 'post');
      
      console.log('Đã tạo lại báo cáo:', result);
      return true;
    } catch (err) {
      console.error('Lỗi khi tạo lại báo cáo:', err);
      return false;
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      // Lấy tất cả giao dịch
      const transactionsResponse = await callApi('/transactions');
      // Lọc giao dịch theo tháng/năm đang chọn
      const monthTransactions = transactionsResponse.filter(transaction => {
        const transDate = new Date(transaction.date);
        return transDate.getFullYear() === selectedYear && 
               transDate.getMonth() + 1 === selectedMonth;
      });

      // Tính tổng thu, tổng chi
      const monthlyIncome = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const monthlyExpense = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      // Số dư tháng này
      const balance = monthlyIncome - monthlyExpense;

      // Lấy hóa đơn chờ xử lý
      const invoicesResponse = await callApi('/invoices');
      const pendingInvoices = invoicesResponse.filter(invoice => 
        invoice.status === 'pending' || invoice.status === 'partial'
      );

      // Giao dịch gần đây
      const recentTransactions = monthTransactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

      setDashboardData({
        totalTransactions: monthTransactions.length,
        monthlyIncome,
        monthlyExpense,
        balance,
        pendingInvoices: pendingInvoices.length,
        recentTransactions,
        transactionsByCategoryData: [],
        monthlyComparisonData: [],
        reportPeriod: `Tháng ${selectedMonth}/${selectedYear}`
      });

      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu dashboard:', err);
      setError('Không thể tải dữ liệu dashboard. Vui lòng thử lại sau.');
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle manual refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchAvailableYears();
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(value);
  };

  // Format date
  const formatDate = (dateString) => {
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('vi-VN', options);
  };

  // Get status class
  const getStatusClass = (type) => {
    return type === 'income' ? 'success' : 'danger';
  };

  // Get status text
  const getStatusText = (type) => {
    return type === 'income' ? 'Thu' : 'Chi';
  };

  // Hàm tính giá trị lớn nhất để làm chuẩn cho biểu đồ
  const getMaxValue = () => {
    const values = [
      dashboardData.monthlyIncome,
      dashboardData.monthlyExpense,
      dashboardData.balance
    ];
    return Math.max(...values);
  };

  // Hàm tính chiều cao của cột biểu đồ
  const calculateBarHeight = (value, maxValue) => {
    if (maxValue === 0) return 10; // Chiều cao tối thiểu
    // Tính tỷ lệ phần trăm, đảm bảo chiều cao tối thiểu là 10% và tối đa là 90%
    return Math.max(10, Math.min(90, (value / maxValue) * 80 + 10));
  };

  // Show loading state
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  return (
    <>
      {/* Page title */}
      <div className="page-header-wrapper mb-4">
        <PageHeader 
          title="Quản lý thu chi" 
          hideButton={true}
        />
        
        {/* Month Filter and Refresh */}
        <div className="d-flex align-items-center gap-3">
          <div className="month-filter d-flex gap-2">
            <select 
              className="form-select" 
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            
            <select 
              className="form-select" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>Tháng {month}</option>
              ))}
            </select>
            
            <button 
              className="btn btn-primary" 
              onClick={fetchDashboardData}
            >
              Lọc
            </button>
          </div>
          
          <button 
            className="btn btn-outline-secondary refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
            ) : (
              <span>🔄</span>
            )}
            <span className="d-none d-md-inline ms-1">Làm mới</span>
          </button>
        </div>
      </div>
      
      {/* Financial Summary Chart */}
      <div className="finance-chart-container">
        <div className="chart-title">
          <h3>Tổng quan tài chính {dashboardData.reportPeriod}</h3>
        </div>
        <div className="finance-chart">
          <div className="chart-labels">
            <div className="chart-label">Tổng thu</div>
            <div className="chart-label">Tổng chi</div>
            <div className="chart-label">Số dư</div>
          </div>
          <div className="chart-bars">
            {/* Cột thu nhập */}
            <div className="chart-bar-container">
              <div 
                className="chart-bar income" 
                style={{ 
                  height: `${calculateBarHeight(dashboardData.monthlyIncome, getMaxValue())}%` 
                }}
              >
                <span className="chart-value">{Math.floor(dashboardData.monthlyIncome).toLocaleString('vi-VN')} đ</span>
              </div>
            </div>
            
            {/* Cột chi tiêu */}
            <div className="chart-bar-container">
              <div 
                className="chart-bar expense" 
                style={{ 
                  height: `${calculateBarHeight(dashboardData.monthlyExpense, getMaxValue())}%` 
                }}
              >
                <span className="chart-value">{Math.floor(dashboardData.monthlyExpense).toLocaleString('vi-VN')} đ</span>
              </div>
            </div>
            
            {/* Cột số dư */}
            <div className="chart-bar-container">
              <div 
                className="chart-bar balance" 
                style={{ 
                  height: `${calculateBarHeight(dashboardData.balance, getMaxValue())}%` 
                }}
              >
                <span className="chart-value">{Math.floor(dashboardData.balance).toLocaleString('vi-VN')} đ</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="row g-4">
        {/* Recent Transactions Table */}
        <div className="col-lg-12">
          <div className="data-table-container slide-in-left">
            <div className="data-table-header">
              <div className="data-table-title">Giao dịch gần đây</div>
              <div className="data-table-actions">
                <Link to="/manager/transactions" className="btn btn-sm btn-primary">
                  Xem tất cả
                </Link>
              </div>
            </div>
            
            <div className="table-responsive">
              <table className="data-table table align-middle">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>#</th>
                    <th>Mô tả</th>
                    <th style={{ width: '120px' }}>Ngày</th>
                    <th style={{ width: '120px' }}>Số tiền</th>
                    <th style={{ width: '100px' }}>Loại</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.recentTransactions.map((transaction, index) => (
                    <tr key={transaction.id}>
                      <td>{index + 1}</td>
                      <td>{transaction.description}</td>
                      <td>{formatDate(transaction.date)}</td>
                      <td className={`fw-bold text-${getStatusClass(transaction.type)}`}>
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusClass(transaction.type)}`}>
                          {getStatusText(transaction.type)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  
                  {dashboardData.recentTransactions.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center py-4">
                        <div className="empty-state-icon">📊</div>
                        <div className="empty-state-title">Chưa có giao dịch nào</div>
                        <div>Tạo giao dịch mới để bắt đầu theo dõi tài chính</div>
                        {/* <Link to="/manager/transactions/add" className="btn btn-sm btn-primary mt-3">
                          Tạo giao dịch
                        </Link> */}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ManagerDashboard;