import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console for debugging
    console.error('[ErrorBoundary] Error caught:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
    
    // Update state with error details
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // TODO: Log to error tracking service (Sentry, LogRocket, etc.)
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  handleReset = () => {
    // Reset error state and reload page
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <div className="container-fluid d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
          <div className="card shadow-lg" style={{ maxWidth: '600px', width: '100%' }}>
            <div className="card-body p-5 text-center">
              <div className="mb-4">
                <i className="fas fa-exclamation-triangle text-danger" style={{ fontSize: '4rem' }}></i>
              </div>
              <h2 className="card-title mb-3 text-danger">Đã xảy ra lỗi</h2>
              <p className="card-text text-muted mb-4">
                Ứng dụng đã gặp sự cố không mong muốn. Vui lòng thử lại hoặc liên hệ với quản trị viên nếu vấn đề vẫn tiếp tục.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="alert alert-danger text-start mb-4" style={{ fontSize: '0.875rem' }}>
                  <strong>Chi tiết lỗi (chỉ hiển thị trong môi trường development):</strong>
                  <pre className="mt-2 mb-0" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </div>
              )}

              <div className="d-flex gap-2 justify-content-center">
                <button 
                  className="btn btn-primary" 
                  onClick={this.handleReset}
                >
                  <i className="fas fa-redo me-2"></i>
                  Tải lại trang
                </button>
                <button 
                  className="btn btn-outline-secondary" 
                  onClick={() => window.location.href = '/'}
                >
                  <i className="fas fa-home me-2"></i>
                  Về trang chủ
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Render children normally if no error
    return this.props.children;
  }
}

export default ErrorBoundary;

