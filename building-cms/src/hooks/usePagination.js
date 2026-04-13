import { useState, useMemo } from 'react';

const usePagination = (items, initialPage = 1) => {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const itemsPerPage = 8; // Cố định số lượng mục trên mỗi trang là 8

  // Tính toán dữ liệu phân trang
  const paginationData = useMemo(() => {
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // Điều chỉnh currentPage nếu nó vượt quá tổng số trang
    const adjustedCurrentPage = Math.min(currentPage, totalPages || 1);
    
    // Lấy dữ liệu cho trang hiện tại
    const startIndex = (adjustedCurrentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = items.slice(startIndex, endIndex);

    return {
      currentItems,
      currentPage: adjustedCurrentPage,
      totalPages,
      totalItems,
      setCurrentPage
    };
  }, [items, currentPage]);

  return paginationData;
};

export default usePagination; 