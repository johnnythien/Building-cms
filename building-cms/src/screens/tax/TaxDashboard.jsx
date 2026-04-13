// File: building-cms/src/screens/tax/TaxDashboard.jsx
// Component Tổng quan Quản lý Thuế với các Tab chức năng
// NÂNG CẤP: Thêm cảnh báo thông tin cho Kế toán


import React, { useState } from 'react';
import { Tab, Tabs, Alert } from 'react-bootstrap';
import { FaCalculator, FaFileInvoiceDollar, FaChartLine, FaListAlt } from 'react-icons/fa';

// Import các component con 
import InvoiceTaxCalculator from './InvoiceTaxCalculator';
import VatReport from './VATReport';
import TaxRulesViewer from './TaxRulesViewer';
import TaxPayableReport from './TaxPayableReport';
import PageHeader from '../../components/layout/PageHeader';
import './taxDashboard.css'; 

function TaxDashboard() {
    const [key, setKey] = useState('calculator'); // Tab mặc định

    return (
        <div className="tax-dashboard-container">
            <div className="page-header-wrapper mb-4">
                <PageHeader 
                    title="Module Quản lý Thuế Tự Động" 
                    hideButton={true}
                />
            </div>

            <div className="tax-content-card">
                <Alert variant="info" className="tax-alert">
                    <strong>Chào mừng Kế toán!</strong> Đây là khu vực báo cáo và xử lý thuế.
                    <br/>
                    <strong>Hệ thống đã được tự động hóa:</strong> Thuế sẽ được tự động tính khi một Giao dịch (Thu/Chi) được tạo hoặc khi Hóa đơn được thanh toán.
                    <br/>
                    Tab "Tính thuế Hóa đơn" dùng để <strong>kích hoạt tính toán lại (Re-calculate)</strong> nếu bạn vừa thay đổi Quy tắc Thuế hoặc cần sửa một hóa đơn cũ.
                </Alert>
                
                <Tabs
                    id="tax-dashboard-tabs"
                    activeKey={key}
                    onSelect={(k) => setKey(k)}
                    className="mb-0 tax-dashboard-tabs"
                >
                <Tab 
                    eventKey="calculator" 
                    title={
                        <span>
                            <FaCalculator className="me-2" />
                            1. Tính thuế Hóa đơn
                        </span>
                    }
                >
                    <div className="tab-content">
                        <InvoiceTaxCalculator/>
                    </div>
                </Tab>
                
                <Tab 
                    eventKey="vatReport" 
                    title={
                        <span>
                            <FaChartLine className="me-2" />
                            2. Báo cáo VAT Tháng
                        </span>
                    }
                >
                    <div className="tab-content">
                        <VatReport/>
                    </div>
                </Tab>
                
                <Tab 
                    eventKey="payable" 
                    title={
                        <span>
                            <FaFileInvoiceDollar className="me-2" />
                            3. Thuế Phải Nộp Nhà Nước
                        </span>
                    }
                >
                    <div className="tab-content">
                        <TaxPayableReport/>
                    </div>
                </Tab>
                
                <Tab 
                    eventKey="rules" 
                    title={
                        <span>
                            <FaListAlt className="me-2" />
                            4. Danh sách Quy tắc Thuế
                        </span>
                    }
                >
                    <div className="tab-content">
                        <TaxRulesViewer/>
                    </div>
                </Tab>
                </Tabs>
            </div>
        </div>
    );
}

export default TaxDashboard;