import React from 'react';
import './Pagination.css';

const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange,
  totalItems
}) => {
  // Tạo mảng các số trang để hiển thị
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      // Nếu tổng số trang ít hơn maxVisiblePages, hiển thị tất cả
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Luôn hiển thị trang đầu tiên
      pages.push(1);
      
      // Tính toán các trang ở giữa
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      // Điều chỉnh để luôn hiển thị đủ 5 trang
      if (currentPage <= 2) {
        endPage = 4;
      } else if (currentPage >= totalPages - 1) {
        startPage = totalPages - 3;
      }
      
      // Thêm dấu ... nếu cần
      if (startPage > 2) {
        pages.push('...');
      }
      
      // Thêm các trang ở giữa
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      // Thêm dấu ... nếu cần
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      
      // Luôn hiển thị trang cuối
      pages.push(totalPages);
    }
    
    return pages;
  };

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        <span>
          Hiển thị {Math.min((currentPage - 1) * 8 + 1, totalItems)} - {Math.min(currentPage * 8, totalItems)} của {totalItems} mục
        </span>
      </div>
      
      <div className="pagination">
        <button
          className="pagination-btn"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
        >
          &laquo;
        </button>
        
        <button
          className="pagination-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          &lsaquo;
        </button>
        
        {getPageNumbers().map((page, index) => (
          <button
            key={index}
            className={`pagination-btn ${page === currentPage ? 'active' : ''} ${page === '...' ? 'disabled' : ''}`}
            onClick={() => page !== '...' && onPageChange(page)}
            disabled={page === '...'}
          >
            {page}
          </button>
        ))}
        
        <button
          className="pagination-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          &rsaquo;
        </button>
        
        <button
          className="pagination-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          &raquo;
        </button>
      </div>
    </div>
  );
};

export default Pagination; 