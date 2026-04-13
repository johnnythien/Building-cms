export const TENDER_STATUS = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  GRADING: 'GRADING',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  AWARDED: 'AWARDED',
  CANCELLED: 'CANCELLED'
};

export const getStatusLabel = (status) => {
  const statusMap = {
    [TENDER_STATUS.DRAFT]: 'Nháp',
    [TENDER_STATUS.OPEN]: 'Đang mở thầu',
    [TENDER_STATUS.CLOSED]: 'Đã đóng thầu',
    [TENDER_STATUS.GRADING]: 'Đang chấm điểm',
    [TENDER_STATUS.PENDING_APPROVAL]: 'Chờ phê duyệt',
    [TENDER_STATUS.AWARDED]: 'Đã trao thầu',
    [TENDER_STATUS.CANCELLED]: 'Đã hủy'
  };
  return statusMap[status] || status;
};

export const getStatusColor = (status) => {
  const colorMap = {
    [TENDER_STATUS.DRAFT]: '#6c757d',
    [TENDER_STATUS.OPEN]: '#28a745',
    [TENDER_STATUS.CLOSED]: '#ffc107',
    [TENDER_STATUS.GRADING]: '#17a2b8',
    [TENDER_STATUS.PENDING_APPROVAL]: '#9b59b6',
    [TENDER_STATUS.AWARDED]: '#007bff',
    [TENDER_STATUS.CANCELLED]: '#dc3545'
  };
  return colorMap[status] || '#6c757d';
};

export const getStatusBadgeClass = (status) => {
  const classMap = {
    [TENDER_STATUS.DRAFT]: 'badge-secondary',
    [TENDER_STATUS.OPEN]: 'badge-success',
    [TENDER_STATUS.CLOSED]: 'badge-warning',
    [TENDER_STATUS.GRADING]: 'badge-info',
    [TENDER_STATUS.PENDING_APPROVAL]: 'badge-warning',
    [TENDER_STATUS.AWARDED]: 'badge-primary',
    [TENDER_STATUS.CANCELLED]: 'badge-danger'
  };
  return classMap[status] || 'badge-secondary';
};

export const getStatusOptions = () => {
  return [
    { value: TENDER_STATUS.DRAFT, label: getStatusLabel(TENDER_STATUS.DRAFT) },
    { value: TENDER_STATUS.OPEN, label: getStatusLabel(TENDER_STATUS.OPEN) },
    { value: TENDER_STATUS.CLOSED, label: getStatusLabel(TENDER_STATUS.CLOSED) },
    { value: TENDER_STATUS.GRADING, label: getStatusLabel(TENDER_STATUS.GRADING) },
    { value: TENDER_STATUS.PENDING_APPROVAL, label: getStatusLabel(TENDER_STATUS.PENDING_APPROVAL) },
    { value: TENDER_STATUS.AWARDED, label: getStatusLabel(TENDER_STATUS.AWARDED) },
    { value: TENDER_STATUS.CANCELLED, label: getStatusLabel(TENDER_STATUS.CANCELLED) }
  ];
};

