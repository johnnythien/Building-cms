import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import callApi from '../../apis/handleApi';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons';
import './FinancialReports.css';
import PageHeader from '../../components/layout/PageHeader';

const FinancialReports = () => {
  const { currentUser, logout } = useAuth();
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDetails, setReportDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'detail'
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    month: 'all',
  });
  const [availableYears, setAvailableYears] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchCategories();
    fetchTransactions();
  }, []);

  useEffect(() => {
    if (transactions.length > 0) {
      generateReportsFromTransactions();
    }
    // eslint-disable-next-line
  }, [transactions, filters]);

  useEffect(() => {
    // Lấy danh sách các năm có dữ liệu báo cáo
    const fetchAvailableYears = async () => {
      try {
        const response = await callApi('/reports');
        console.log('Reports API response:', response);
        const years = [...new Set(response.map(report => report.year))];
        console.log('Available years:', years);
        setAvailableYears(years);
        
        // Nếu năm hiện tại không có trong danh sách và có dữ liệu báo cáo
        if (years.length > 0 && !years.includes(filters.year)) {
          setFilters(prev => ({
            ...prev,
            year: years[0] // Chọn năm đầu tiên có dữ liệu
          }));
        }
      } catch (err) {
        console.error('Error fetching available years:', err);
      }
    };
    
    fetchAvailableYears();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await callApi('/categories');
      setCategories(response);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await callApi('/transactions');
      setTransactions(response);
      setError('');
    } catch (err) {
      setError('Không thể tải dữ liệu giao dịch. Vui lòng thử lại sau.');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Tổng hợp báo cáo từ transactions
  const generateReportsFromTransactions = () => {
    let filtered = transactions;
    if (filters.year) {
      filtered = filtered.filter(t => new Date(t.date).getFullYear() === Number(filters.year));
    }
    let reportsByMonth = {};
    filtered.forEach(t => {
      const d = new Date(t.date);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      if (!reportsByMonth[`${month}-${year}`]) {
        reportsByMonth[`${month}-${year}`] = {
          id: `${month}-${year}`,
          month,
          year,
          totalIncome: 0,
          totalExpense: 0,
          transactions: []
        };
      }
      reportsByMonth[`${month}-${year}`].transactions.push(t);
      if (t.type === 'income') {
        reportsByMonth[`${month}-${year}`].totalIncome += Number(t.amount);
      } else if (t.type === 'expense') {
        reportsByMonth[`${month}-${year}`].totalExpense += Number(t.amount);
      }
    });
    let reportsArr = Object.values(reportsByMonth);
    // Nếu lọc theo tháng
    if (filters.month !== 'all') {
      reportsArr = reportsArr.filter(r => r.month === Number(filters.month));
    }
    // Tính số dư
    reportsArr = reportsArr.map(r => ({ ...r, balance: r.totalIncome - r.totalExpense }));
    // Sắp xếp theo tháng tăng dần
    reportsArr.sort((a, b) => (a.year - b.year) * 12 + (a.month - b.month));
    setReports(reportsArr);
  };

  const fetchReportDetails = async (reportId) => {
    setDetailsLoading(true);
    try {
      const response = await callApi(`/reportDetails`);
      const details = response.find(detail => detail.reportId === reportId);
      
      if (details) {
        // Xử lý dữ liệu để tạo cấu trúc dễ sử dụng
        const incomeByCategory = {};
        const expenseByCategory = {};
        
        details.categoryDetails.forEach(item => {
          if (item.type === 'income') {
            incomeByCategory[item.categoryName] = item.amount;
          } else if (item.type === 'expense') {
            expenseByCategory[item.categoryName] = item.amount;
          }
        });
        
        setReportDetails({
          ...details,
          incomeByCategory,
          expenseByCategory
        });
        
        return details;
      }
      
      setReportDetails(null);
      return null;
    } catch (err) {
      console.error('Error fetching report details:', err);
      setReportDetails(null);
      return null;
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  };

  const generateYearOptions = () => {
    // Trả về danh sách các năm có dữ liệu
    return availableYears.length > 0 ? availableYears : [new Date().getFullYear()];
  };

  const monthNames = [
    'Tất cả',
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  const viewReportDetails = async (report) => {
    // Phân loại theo danh mục
    const incomeByCategory = {};
    const expenseByCategory = {};
    
    // Lấy danh sách categories nếu chưa có
    let currentCategories = categories;
    if (categories.length === 0) {
      try {
        const response = await callApi('/categories');
        currentCategories = response;
        setCategories(response);
      } catch (err) {
        console.error('Error fetching categories:', err);
        currentCategories = [];
      }
    }

    report.transactions.forEach(item => {
      // Tìm category tương ứng
      const category = currentCategories.find(cat => 
        String(cat.id) === String(item.categoryId)
      );
      
      // Nếu tìm thấy category, sử dụng tên của nó
      const categoryName = category ? category.name : 'Chưa phân loại';
      
      if (item.type === 'income') {
        incomeByCategory[categoryName] = (incomeByCategory[categoryName] || 0) + Number(item.amount);
      } else if (item.type === 'expense') {
        expenseByCategory[categoryName] = (expenseByCategory[categoryName] || 0) + Number(item.amount);
      }
    });

    setSelectedReport(report);
    setReportDetails({ incomeByCategory, expenseByCategory });
    setViewMode('detail');
  };

  const backToList = () => {
    setSelectedReport(null);
    setReportDetails(null);
    setViewMode('list');
  };

  const calculatePercentage = (value, total) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  // Hàm xuất báo cáo PDF
  const exportToPDF = () => {
    if (!selectedReport || !reportDetails) return;

    // Tạo div chứa nội dung báo cáo với style phù hợp
    const reportElement = document.createElement('div');
    reportElement.style.width = '210mm';
    reportElement.style.padding = '20px';
    reportElement.style.fontFamily = 'Arial, sans-serif';
    
    // Tạo HTML cho báo cáo
    reportElement.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-size: 24px; margin-bottom: 5px;">HỆ THỐNG QUẢN LÝ CHUNG CƯ</h1>
        <p style="font-size: 14px; margin: 5px 0;">Địa chỉ: Khu Công nghệ cao TP.HCM (SHTP), Xa lộ Hà Nội, P. Hiệp Phú, TP. Thủ Đức</p>
        <p style="font-size: 14px; margin: 5px 0;">Điện thoại: (028) 1234 5678 - Email: Nhom1@quanlychungcu.vn</p>
        <hr style="border: 1px solid #000; margin: 10px 0 20px 0;" />
        <h2 style="font-size: 20px; margin-bottom: 20px;">BÁO CÁO TÀI CHÍNH</h2>
        <p style="font-size: 16px; margin: 5px 0;">${selectedReport.month ? `Tháng ${selectedReport.month}/${selectedReport.year}` : `Năm ${selectedReport.year}`}</p>
      </div>
      
      <div style="margin-bottom: 30px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Tổng thu</th>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: right; color: #27ae60; font-weight: bold;">${formatCurrency(selectedReport.totalIncome)}</td>
          </tr>
          <tr>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Tổng chi</th>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: right; color: #e74c3c; font-weight: bold;">${formatCurrency(selectedReport.totalExpense)}</td>
          </tr>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Số dư</th>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: right; color: ${selectedReport.totalIncome - selectedReport.totalExpense >= 0 ? '#27ae60' : '#e74c3c'}; font-weight: bold;">
              ${formatCurrency(selectedReport.totalIncome - selectedReport.totalExpense)}
            </td>
          </tr>
        </table>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h3 style="font-size: 18px; margin-bottom: 10px; color: #2c3e50;">Chi tiết thu nhập</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Danh mục</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Số tiền</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Tỷ lệ</th>
          </tr>
          ${reportDetails && reportDetails.incomeByCategory ? 
            Object.entries(reportDetails.incomeByCategory).map(([category, amount]) => `
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">${category}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCurrency(amount)}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${calculatePercentage(amount, selectedReport.totalIncome)}%</td>
              </tr>
            `).join('') : 
            '<tr><td colspan="3" style="padding: 10px; border: 1px solid #ddd; text-align: center;">Không có dữ liệu</td></tr>'
          }
        </table>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h3 style="font-size: 18px; margin-bottom: 10px; color: #2c3e50;">Chi tiết chi tiêu</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Danh mục</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Số tiền</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Tỷ lệ</th>
          </tr>
          ${reportDetails && reportDetails.expenseByCategory ? 
            Object.entries(reportDetails.expenseByCategory).map(([category, amount]) => `
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">${category}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCurrency(amount)}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${calculatePercentage(amount, selectedReport.totalExpense)}%</td>
              </tr>
            `).join('') : 
            '<tr><td colspan="3" style="padding: 10px; border: 1px solid #ddd; text-align: center;">Không có dữ liệu</td></tr>'
          }
        </table>
      </div>
      
      ${reportDetails && reportDetails.invoiceSummary ? `
        <div style="margin-bottom: 30px;">
          <h3 style="font-size: 18px; margin-bottom: 10px; color: #2c3e50;">Tổng hợp hóa đơn</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background-color: #f2f2f2;">
              <td style="padding: 10px; border: 1px solid #ddd; width: 50%;">Tổng hóa đơn phát hành</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCurrency(reportDetails.invoiceSummary.totalIssued)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Tổng hóa đơn đã thanh toán</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCurrency(reportDetails.invoiceSummary.totalPaid)}</td>
            </tr>
            <tr style="background-color: #f2f2f2;">
              <td style="padding: 10px; border: 1px solid #ddd;">Tổng hóa đơn quá hạn</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatCurrency(reportDetails.invoiceSummary.totalOverdue)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Tỷ lệ thu hồi</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${reportDetails.invoiceSummary.collectionRate}%</td>
            </tr>
          </table>
        </div>
      ` : ''}
      
      <div style="margin-top: 40px; text-align: right;">
        <p>Ngày lập báo cáo: ${formatDate(new Date())}</p>
        <div style="margin-top: 60px;">
          <p style="font-weight: bold;">Người lập báo cáo</p>
          <p style="margin-top: 40px;">${currentUser?.fullName || 'Quản lý tòa nhà'}</p>
        </div>
      </div>
    `;
    
    // Thêm vào body tạm thời để render
    document.body.appendChild(reportElement);
    
    // Sử dụng html2canvas để chuyển đổi HTML thành canvas
    html2canvas(reportElement, { 
      scale: 2, // Tăng độ phân giải
      useCORS: true,
      logging: false
    }).then(canvas => {
      // Tạo PDF từ canvas
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      // Tính toán tỷ lệ giữa kích thước PDF và canvas
      const ratio = Math.min(pdfWidth / canvasWidth, pdfHeight / canvasHeight);
      
      // Tính toán vị trí để căn giữa hình ảnh
      const xPos = (pdfWidth - canvasWidth * ratio) / 2;
      const yPos = 0;
      
      pdf.addImage(imgData, 'PNG', xPos, yPos, canvasWidth * ratio, canvasHeight * ratio);
      
      // Tải xuống PDF
      pdf.save(`bao-cao-tai-chinh-${selectedReport.month ? `thang-${selectedReport.month}-${selectedReport.year}` : `nam-${selectedReport.year}`}.pdf`);
      
      // Xóa phần tử tạm thời
      document.body.removeChild(reportElement);
    });
  };

  // Show loading state
  if (loading && viewMode === 'list') {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <>
      <div className="financial-reports-container">
        <div className="page-header-wrapper mb-4">
          <PageHeader 
            title="Báo Cáo Tài Chính" 
            hideButton={true}
          />
        </div>
            
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
            
        <div className="filter-container">
          <div className="filter-group">
            <label>Năm:</label>
            <select 
              name="year" 
              value={filters.year} 
              onChange={handleFilterChange}
            >
              {generateYearOptions().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Tháng:</label>
            <select 
              name="month" 
              value={filters.month} 
              onChange={handleFilterChange}
            >
              <option value="all">Tất cả</option>
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>{monthNames[i + 1]}</option>
              ))}
            </select>
          </div>
        </div>
        
        {viewMode === 'list' ? (
          <div className="reports-list">
            <div className="report-header">
              <span className="report-period">Kỳ báo cáo</span>
              <span className="report-income">Tổng thu</span>
              <span className="report-expense">Tổng chi</span>
              <span className="report-balance">Số dư</span>
              <span className="report-actions">Thao tác</span>
            </div>
            {reports.length > 0 ? (
              reports.map(report => (
                <div key={report.id} className="report-item">
                  <span className="report-period">
                    {report.month ? `Tháng ${report.month}/${report.year}` : `Năm ${report.year}`}
                  </span>
                  <span className="report-income">{formatCurrency(report.totalIncome)}</span>
                  <span className="report-expense">{formatCurrency(report.totalExpense)}</span>
                  <span className={`report-balance ${report.totalIncome - report.totalExpense >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(report.totalIncome - report.totalExpense)}
                  </span>
                  <span className="report-actions">
                    <button className="view-btn" onClick={() => viewReportDetails(report)} title="Xem chi tiết">
                      <FontAwesomeIcon icon={faEye} />
                    </button>
                  </span>
                </div>
              ))
            ) : (
              <div className="no-reports">Không có báo cáo nào cho giai đoạn đã chọn</div>
            )}
          </div>
        ) : (
          <div className="report-details">
            <div className="report-details-header">
              <button className="back-btn" onClick={backToList}>Quay lại danh sách</button>
              <button className="export-btn" onClick={exportToPDF}>Xuất PDF</button>
            </div>
            
            <h2>
              Chi tiết báo cáo tài chính: {selectedReport.month ? `Tháng ${selectedReport.month}/${selectedReport.year}` : `Năm ${selectedReport.year}`}
            </h2>
            
            {detailsLoading ? (
              <div className="loading">Đang tải chi tiết báo cáo...</div>
            ) : reportDetails ? (
              <>
                <div className="report-summary">
                  <div className="summary-card income">
                    <h3>Tổng thu</h3>
                    <p className="amount">{formatCurrency(selectedReport.totalIncome)}</p>
                  </div>
                  
                  <div className="summary-card expense">
                    <h3>Tổng chi</h3>
                    <p className="amount">{formatCurrency(selectedReport.totalExpense)}</p>
                  </div>
                  
                  <div className="summary-card balance">
                    <h3>Số dư</h3>
                    <p className={`amount ${selectedReport.totalIncome - selectedReport.totalExpense >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(selectedReport.totalIncome - selectedReport.totalExpense)}
                    </p>
                  </div>
                </div>
                
                <div className="report-charts">
                  <div className="chart-container">
                    <h3>Phân tích thu nhập</h3>
                    <div className="categories-list">
                      {reportDetails.incomeByCategory && Object.entries(reportDetails.incomeByCategory).map(([category, amount]) => (
                        <div key={category} className="category-item">
                          <div className="category-info">
                            <span className="category-name">{category}</span>
                            <span className="category-amount">{formatCurrency(amount)}</span>
                          </div>
                          <div className="progress-bar-container">
                            <div 
                              className="progress-bar income" 
                              style={{ width: `${calculatePercentage(amount, selectedReport.totalIncome)}%` }}
                            ></div>
                            <span className="percentage">{calculatePercentage(amount, selectedReport.totalIncome)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="chart-container">
                    <h3>Phân tích chi tiêu</h3>
                    <div className="categories-list">
                      {reportDetails.expenseByCategory && Object.entries(reportDetails.expenseByCategory).map(([category, amount]) => (
                        <div key={category} className="category-item">
                          <div className="category-info">
                            <span className="category-name">{category}</span>
                            <span className="category-amount">{formatCurrency(amount)}</span>
                          </div>
                          <div className="progress-bar-container">
                            <div 
                              className="progress-bar expense" 
                              style={{ width: `${calculatePercentage(amount, selectedReport.totalExpense)}%` }}
                            ></div>
                            <span className="percentage">{calculatePercentage(amount, selectedReport.totalExpense)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {reportDetails.invoiceSummary && (
                  <div className="invoice-summary-container">
                    <h3>Tổng hợp hóa đơn</h3>
                    <div className="invoice-summary">
                      <div className="summary-item">
                        <span className="label">Tổng hóa đơn phát hành</span>
                        <span className="value">{formatCurrency(reportDetails.invoiceSummary.totalIssued)}</span>
                      </div>
                      <div className="summary-item">
                        <span className="label">Tổng đã thanh toán</span>
                        <span className="value">{formatCurrency(reportDetails.invoiceSummary.totalPaid)}</span>
                      </div>
                      <div className="summary-item">
                        <span className="label">Tổng quá hạn</span>
                        <span className="value">{formatCurrency(reportDetails.invoiceSummary.totalOverdue)}</span>
                      </div>
                      <div className="summary-item">
                        <span className="label">Tỷ lệ thu hồi</span>
                        <span className="value">{reportDetails.invoiceSummary.collectionRate}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="error-message">Không thể tải chi tiết báo cáo</div>
            )}
            
            {selectedReport?.notes && (
              <div className="report-notes">
                <h3>Ghi chú</h3>
                <p>{selectedReport.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default FinancialReports;