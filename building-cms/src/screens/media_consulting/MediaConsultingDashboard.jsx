import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import callApi from "../../apis/handleApi";
import { Bar, Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from "chart.js";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faNewspaper, faComments, faVoteYea, faCheckCircle, faChartLine, faFileAlt, faBell } from '@fortawesome/free-solid-svg-icons';
import useMediaConsultingPath from '../../hooks/useMediaConsultingPath';
import './MediaConsulting.css';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const MediaConsultingDashboard = () => {
  const basePath = useMediaConsultingPath();
  const [news, setNews] = useState([]);
  const [comments, setComments] = useState([]);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('MediaConsultingDashboard mounted');
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [newsRes, commentsRes, votesRes] = await Promise.all([
        callApi('/news').catch(() => []),
        callApi('/comments').catch(() => []),
        callApi('/votes').catch(() => [])
      ]);
      
      setNews(Array.isArray(newsRes) ? newsRes : []);
      setComments(Array.isArray(commentsRes) ? commentsRes : []);
      setVotes(Array.isArray(votesRes) ? votesRes : []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setNews([]);
      setComments([]);
      setVotes([]);
    } finally {
      setLoading(false);
    }
  };

  // Thống kê biểu quyết
  const now = new Date();
  const votesActive = votes.filter(v => {
    if (!v.StartDate || !v.EndDate) return false;
    const start = new Date(v.StartDate);
    const end = new Date(v.EndDate);
    return start <= now && now <= end;
  });
  const votesEnded = votes.filter(v => v.EndDate && new Date(v.EndDate) < now);
  const votesUpcoming = votes.filter(v => v.StartDate && new Date(v.StartDate) > now);

  // Thống kê góp ý
  const commentsPending = comments.filter(c => c.status !== "resolved" && c.status !== "Đã phản hồi");
  const commentsReplied = comments.filter(c => c.status === "resolved" || c.status === "Đã phản hồi");

  // Biểu đồ góp ý theo trạng thái
  const commentPieData = {
    labels: ["Chưa xử lý", "Đã phản hồi"],
    datasets: [
      {
        data: [commentsPending.length, commentsReplied.length],
        backgroundColor: ["#ffc107", "#28a745"],
      },
    ],
  };

  // Biểu đồ số lượng biểu quyết theo tháng
  const voteByMonth = {};
  votes.forEach(v => {
    if (v.StartDate) {
      const date = new Date(v.StartDate);
      const month = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
      voteByMonth[month] = (voteByMonth[month] || 0) + 1;
    }
  });
  const voteBarData = {
    labels: Object.keys(voteByMonth).length > 0 ? Object.keys(voteByMonth) : ["Chưa có dữ liệu"],
    datasets: [
      {
        label: "Biểu quyết",
        data: Object.keys(voteByMonth).length > 0 ? Object.values(voteByMonth) : [0],
        backgroundColor: "#007bff",
      },
    ],
  };

  // Danh sách mới nhất
  const latestComments = comments.slice(-5).reverse();
  const latestVotes = votes.slice(-5).reverse();
  const latestNews = news.slice(-5).reverse();

  // Thời gian đăng nhập gần nhất
  const lastLogin = localStorage.getItem("lastLogin") || "Chưa xác định";

  console.log('MediaConsultingDashboard render', { loading, news: news.length, comments: comments.length, votes: votes.length });

  if (loading) {
    return (
      <div className="mc-dashboard-container">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mc-dashboard-container mc-fade-in">
      {/* Welcome Section */}
      <div className="mc-welcome">
        <div className="mc-welcome-title">Chào mừng đến với Media Consulting</div>
      </div>
      
      {/* Statistics Cards */}
      <div className="row mb-4">
        <div className="col-md-3 mb-3">
          <div className="mc-stat-card primary">
            <div className="mc-stat-card-icon">
              <FontAwesomeIcon icon={faNewspaper} />
            </div>
            <div className="mc-stat-card-title">Tin tức</div>
            <div className="mc-stat-card-value">{news.length}</div>
            <div className="mc-stat-card-footer">Tổng số tin tức</div>
          </div>
        </div>
        <div className="col-md-3 mb-3">
          <div className="mc-stat-card success">
            <div className="mc-stat-card-icon">
              <FontAwesomeIcon icon={faComments} />
            </div>
            <div className="mc-stat-card-title">Góp ý</div>
            <div className="mc-stat-card-value">{comments.length}</div>
            <div className="mc-stat-card-footer">Tổng số góp ý</div>
          </div>
        </div>
        <div className="col-md-3 mb-3">
          <div className="mc-stat-card info">
            <div className="mc-stat-card-icon">
              <FontAwesomeIcon icon={faVoteYea} />
            </div>
            <div className="mc-stat-card-title">Biểu quyết đang diễn ra</div>
            <div className="mc-stat-card-value">{votesActive.length}</div>
            <div className="mc-stat-card-footer">Đang hoạt động</div>
          </div>
        </div>
        <div className="col-md-3 mb-3">
          <div className="mc-stat-card warning">
            <div className="mc-stat-card-icon">
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
            <div className="mc-stat-card-title">Biểu quyết đã kết thúc</div>
            <div className="mc-stat-card-value">{votesEnded.length}</div>
            <div className="mc-stat-card-footer">Đã hoàn thành</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="row mb-4">
        <div className="col-md-6 mb-3">
          <div className="mc-chart-card">
            <div className="mc-chart-card-header">
              <h5 className="mc-chart-card-title">Biểu đồ góp ý theo trạng thái</h5>
            </div>
            {comments.length > 0 ? (
              <div style={{ height: '300px' }}>
                <Pie data={commentPieData} options={{ maintainAspectRatio: false }} />
              </div>
            ) : (
              <div className="mc-empty-state">
                <div className="mc-empty-state-icon">
                  <FontAwesomeIcon icon={faChartLine} />
                </div>
                <div className="mc-empty-state-text">Chưa có dữ liệu góp ý</div>
                <p className="small text-muted mt-2">Chưa xử lý: {commentsPending.length} | Đã phản hồi: {commentsReplied.length}</p>
              </div>
            )}
          </div>
        </div>
        <div className="col-md-6 mb-3">
          <div className="mc-chart-card">
            <div className="mc-chart-card-header">
              <h5 className="mc-chart-card-title">Biểu đồ số lượng biểu quyết theo tháng</h5>
            </div>
            {votes.length > 0 ? (
              <div style={{ height: '300px' }}>
                <Bar data={voteBarData} options={{ maintainAspectRatio: false }} />
              </div>
            ) : (
              <div className="mc-empty-state">
                <div className="mc-empty-state-icon">
                  <FontAwesomeIcon icon={faChartLine} />
                </div>
                <div className="mc-empty-state-text">Chưa có dữ liệu biểu quyết</div>
                <p className="small text-muted mt-2">Đang diễn ra: {votesActive.length} | Đã kết thúc: {votesEnded.length} | Sắp diễn ra: {votesUpcoming.length}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Latest Lists */}
      <div className="row mb-4">
        <div className="col-md-4 mb-3">
          <div className="mc-list-card">
            <div className="mc-list-card-header">Góp Ý (Mới nhất)</div>
            <div className="mc-list-card-body">
              {latestComments.length > 0 ? (
                latestComments.map((c, i) => (
                  <div className="mc-list-item" key={i}>
                    {c.content || c.text || c.title || "Không có nội dung"}
                  </div>
                ))
              ) : (
                <div className="mc-list-item-empty">Chưa có góp ý nào</div>
              )}
            </div>
          </div>
        </div>
        <div className="col-md-4 mb-3">
          <div className="mc-list-card">
            <div className="mc-list-card-header" style={{background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)'}}>
              Biểu Quyết (Mới nhất)
            </div>
            <div className="mc-list-card-body">
              {latestVotes.length > 0 ? (
                latestVotes.map((v, i) => (
                  <div className="mc-list-item" key={i}>
                    {v.Title || v.title || "Không có tiêu đề"}
                  </div>
                ))
              ) : (
                <div className="mc-list-item-empty">Chưa có biểu quyết nào</div>
              )}
            </div>
          </div>
        </div>
        <div className="col-md-4 mb-3">
          <div className="mc-list-card">
            <div className="mc-list-card-header" style={{background: 'var(--mc-gradient-3)'}}>
              Tin Tức (Mới nhất)
            </div>
            <div className="mc-list-card-body">
              {latestNews.length > 0 ? (
                latestNews.map((n, i) => (
                  <div className="mc-list-item" key={i}>
                    {n.Title || n.title || "Không có tiêu đề"}
                  </div>
                ))
              ) : (
                <div className="mc-list-item-empty">Chưa có tin tức nào</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access */}
      <div className="mc-quick-access mb-4">
        <div className="mc-quick-access-title">Truy cập nhanh</div>
        <div className="mc-quick-access-grid">
          <Link to={`${basePath}/news`} className="mc-quick-btn news">
            <FontAwesomeIcon icon={faNewspaper} />
            Quản lý Tin tức
          </Link>
          <Link to={`${basePath}/comments`} className="mc-quick-btn comments">
            <FontAwesomeIcon icon={faComments} />
            Quản lý Góp ý
          </Link>
          <Link to={`${basePath}/votes`} className="mc-quick-btn votes">
            <FontAwesomeIcon icon={faVoteYea} />
            Quản lý Biểu quyết
          </Link>
          <Link to={`${basePath}/posts`} className="mc-quick-btn posts">
            <FontAwesomeIcon icon={faFileAlt} />
            Quản lý Bài viết
          </Link>
          <Link to={`${basePath}/notifications`} className="mc-quick-btn notifications">
            <FontAwesomeIcon icon={faBell} />
            Quản lý Thông báo
          </Link>
        </div>
      </div>

      {/* Alerts & Info */}
      <div className="row mb-4">
        <div className="col-md-6 mb-3">
          <div className="mc-chart-card">
            <div className="mc-chart-card-header">
              <h5 className="mc-chart-card-title">Thống kê góp ý</h5>
            </div>
            <div className="p-3">
              <div style={{ fontSize: "2.5rem", fontWeight: "bold", background: "var(--mc-gradient-4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "16px" }}>
                {commentsPending.length} chưa xử lý
              </div>
              <div className="text-muted">
                Tổng số góp ý: <b className="text-dark">{comments.length}</b> <br />
                Đã xử lý: <span className="mc-badge mc-badge-resolved">{commentsReplied.length}</span> | 
                Chưa xử lý: <span className="mc-badge mc-badge-pending">{commentsPending.length}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6 mb-3">
          <div className="mc-chart-card">
            <div className="mc-chart-card-header">
              <h5 className="mc-chart-card-title">Thông tin hệ thống</h5>
            </div>
            <div className="p-3">
              <ul className="list-unstyled mb-0">
                <li className="mb-2">Thời gian đăng nhập: <b>{lastLogin}</b></li>
                <li className="mb-2">Phiên bản: <b>v1.0.0</b></li>
                <li className="mb-2">Bản quyền: &copy; 2025 Building CMS</li>
                <li>Liên hệ: <a href="mailto:support@buildingcms.com">support@buildingcms.com</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Important Alerts */}
      {(commentsPending.length > 0 || votesUpcoming.length > 0) && (
        <div className="alert alert-warning border-0 shadow-sm" style={{ borderRadius: '12px' }}>
          <strong>⚠️ Cảnh báo:</strong>
          {commentsPending.length > 0 && (
            <span className="ms-2">Có <b>{commentsPending.length}</b> góp ý chưa xử lý!</span>
          )}
          {votesUpcoming.length > 0 && (
            <span className="ms-2">Có <b>{votesUpcoming.length}</b> biểu quyết sắp diễn ra!</span>
          )}
        </div>
      )}
    </div>
  );
};

export default MediaConsultingDashboard;

