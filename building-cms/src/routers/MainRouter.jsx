import { Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../components/layout/MainLayout';
import HomeScreen from '../screens/HomeScreen';
import Login from '../screens/auth/Login';
import Register from '../screens/auth/Register';
import AdminDashboard from '../screens/admin/AdminDashboard';
import ManagerDashboard from '../screens/manager/ManagerDashboard';
import UnauthorizedScreen from '../screens/UnauthorizedScreen';
import CategoryManagement from '../screens/admin/CategoryManagement';
import TransactionManagement from '../screens/manager/TransactionManagement';
import FinancialReports from '../screens/manager/FinancialReports';
import InvoiceManagement from '../screens/manager/InvoiceManagement';
import BuildingManagement from '../screens/manager/BuildingManagement';
import ResidentManagement from '../screens/manager/ResidentManagement';
import ApartmentManagement from '../screens/manager/ApartmentManagement';
import EmployeeSalaryManagement from '../screens/manager/EmployeeSalaryManagement';
import MySalary from '../screens/MySalary';
import TenderDashboard from '../screens/tender/TenderDashboard';
import TenderManagement from '../screens/tender/TenderManagement';
import ContractorManagement from '../screens/tender/ContractorManagement';
import BidManagement from '../screens/tender/BidManagement';
import ProfileScreen, { ProfileContent } from '../screens/ProfileScreen';
import InvoiceTaxCalculator from '../screens/tax/InvoiceTaxCalculator';
import TaxDashboard from '../screens/tax/TaxDashboard';
import VATReport from '../screens/tax/VATReport';
import TaxRulesViewer from '../screens/tax/TaxRulesViewer';

import ProtectedRoute from './ProtectedRoute';
import AdminRoute from './AdminRoute';
import ManagerRoute from './ManagerRoute';
import TenderManagerRoute from './TenderManagerRoute';
import MediaConsultingManagerRoute from './MediaConsultingManagerRoute';
import MediaConsultingLayout from '../components/layout/MediaConsultingLayout';
import MediaConsultingDashboard from '../screens/media_consulting/MediaConsultingDashboard';
import NewsList from '../screens/media_consulting/NewsList';
import NewsForm from '../screens/media_consulting/NewsForm';
import NewsUpdateForm from '../screens/media_consulting/NewsUpdateForm';
import NewsDetails from '../screens/media_consulting/NewsDetails';
import PostList from '../screens/media_consulting/posts/PostList';
import PostForm from '../screens/media_consulting/posts/PostForm';
import PostDetails from '../screens/media_consulting/posts/PostDetails';
import NotificationList from '../screens/media_consulting/notifications/NotificationList';
import NotificationForm from '../screens/media_consulting/notifications/NotificationForm';
import NotificationUpdateForm from '../screens/media_consulting/notifications/NotificationUpdateForm';
import NotificationDetails from '../screens/media_consulting/notifications/NotificationDetails';
import CommentList from '../screens/media_consulting/comments/CommentList';
import CommentDetails from '../screens/media_consulting/comments/CommentDetails';
import FeedbackForm from '../screens/media_consulting/comments/FeedbackForm';
import VoteList from '../screens/media_consulting/votes/VoteList';
import VoteForm from '../screens/media_consulting/votes/VoteForm';
import VoteDetails from '../screens/media_consulting/votes/VoteDetails';
import VoteResults from '../screens/media_consulting/votes/VoteResults';

const MainRouter = () => {
  const { user, loading } = useAuth();
  const getHomeRedirect = () => {
    // Nếu đang loading, không redirect (sẽ đợi AuthContext xử lý)
    if (loading) {
      return '/login';
    }
    // Chỉ redirect dựa trên user từ AuthContext (đã được xác thực)
    // Không fallback về localStorage để tránh redirect sai khi chưa đăng nhập
    if (!user || !user.role) {
      return '/login';
    }
    const role = user.role;
    if (role === 'admin') return '/admin/dashboard';
    if (role === 'manager') return '/manager/dashboard';
    if (role === 'tender_manager') return '/tender/dashboard';
    if (role === 'media_consulting_manager') return '/media-consulting/dashboard';
    return '/login';
  };
  return (
    <Routes>
      {/* Public routes (không cần MainLayout) */}
      <Route path='/' element={<Navigate to={getHomeRedirect()} replace />}/>
      <Route path='/login' element={<Login />}/>
      <Route path='/register' element={<Register />}/>
      <Route path='/unauthorized' element={
        <MainLayout>
          <UnauthorizedScreen />
        </MainLayout>
      }/>
      
      {/* Protected routes for all authenticated users (cần MainLayout) */}
      <Route path='/profile' element={
        <MainLayout>
          <ProtectedRoute>
            <ProfileScreen />
          </ProtectedRoute>
        </MainLayout>
      }/>
      <Route path='/my-salary' element={
        <MainLayout>
          <ProtectedRoute>
            <MySalary />
          </ProtectedRoute>
        </MainLayout>
      }/>
      
      {/* Protected routes for Admin (cần MainLayout) */}
      <Route path='/admin/dashboard' element={
        <MainLayout>
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/categories' element={
        <MainLayout>
          <AdminRoute>
            <CategoryManagement />
          </AdminRoute>
        </MainLayout>
      }/>

      {/* Tax pages - Admin only (cần MainLayout) */}
      <Route path='/admin/tax/dashboard' element={
        <MainLayout>
          <AdminRoute>
            <TaxDashboard />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/tax/invoice-calculator' element={
        <MainLayout>
          <AdminRoute>
            <InvoiceTaxCalculator apiUrl={process.env.REACT_APP_API_URL || 'http://localhost:3001/api'} />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/tax/vat-report' element={
        <MainLayout>
          <AdminRoute>
            <VATReport apiUrl={process.env.REACT_APP_API_URL || 'http://localhost:3001/api'} />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/tax/rules' element={
        <MainLayout>
          <AdminRoute>
            <TaxRulesViewer apiUrl={process.env.REACT_APP_API_URL || 'http://localhost:3001/api'} />
          </AdminRoute>
        </MainLayout>
      }/>
      
      {/* Media Consulting pages - Admin only (cần MainLayout) */}
      <Route path='/admin/media-consulting/dashboard' element={
        <MainLayout>
          <AdminRoute>
            <MediaConsultingDashboard />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/news' element={
        <MainLayout>
          <AdminRoute>
            <NewsList />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/news/create' element={
        <MainLayout>
          <AdminRoute>
            <NewsForm />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/news/edit/:id' element={
        <MainLayout>
          <AdminRoute>
            <NewsUpdateForm />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/news/:id' element={
        <MainLayout>
          <AdminRoute>
            <NewsDetails />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/posts' element={
        <MainLayout>
          <AdminRoute>
            <PostList />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/posts/create' element={
        <MainLayout>
          <AdminRoute>
            <PostForm />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/posts/edit/:id' element={
        <MainLayout>
          <AdminRoute>
            <PostForm />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/posts/:id' element={
        <MainLayout>
          <AdminRoute>
            <PostDetails />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/notifications' element={
        <MainLayout>
          <AdminRoute>
            <NotificationList />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/notifications/create' element={
        <MainLayout>
          <AdminRoute>
            <NotificationForm />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/notifications/edit/:id' element={
        <MainLayout>
          <AdminRoute>
            <NotificationUpdateForm />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/notifications/:id' element={
        <MainLayout>
          <AdminRoute>
            <NotificationDetails />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/comments' element={
        <MainLayout>
          <AdminRoute>
            <CommentList />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/comments/:id' element={
        <MainLayout>
          <AdminRoute>
            <CommentDetails />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/comments/feedback/:id' element={
        <MainLayout>
          <AdminRoute>
            <FeedbackForm />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/votes' element={
        <MainLayout>
          <AdminRoute>
            <VoteList />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/votes/create' element={
        <MainLayout>
          <AdminRoute>
            <VoteForm />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/votes/edit/:id' element={
        <MainLayout>
          <AdminRoute>
            <VoteForm />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/votes/:id' element={
        <MainLayout>
          <AdminRoute>
            <VoteDetails />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/admin/media-consulting/votes/results/:id' element={
        <MainLayout>
          <AdminRoute>
            <VoteResults />
          </AdminRoute>
        </MainLayout>
      }/>
      
      {/* Protected routes for Manager (cần MainLayout) */}
      <Route path='/manager/dashboard' element={
        <MainLayout>
          <ManagerRoute>
            <ManagerDashboard />
          </ManagerRoute>
        </MainLayout>
      }/>
      <Route path='/manager/transactions' element={
        <MainLayout>
          <ManagerRoute>
            <TransactionManagement />
          </ManagerRoute>
        </MainLayout>
      }/>
      <Route path='/manager/invoices' element={
        <MainLayout>
          <ManagerRoute>
            <InvoiceManagement />
          </ManagerRoute>
        </MainLayout>
      }/>
      <Route path='/manager/reports' element={
        <MainLayout>
          <ManagerRoute>
            <FinancialReports />
          </ManagerRoute>
        </MainLayout>
      }/>
      <Route path='/manager/buildings' element={
        <MainLayout>
          <ManagerRoute>
            <BuildingManagement />
          </ManagerRoute>
        </MainLayout>
      }/>
      <Route path='/manager/residents' element={
        <MainLayout>
          <ManagerRoute>
            <ResidentManagement />
          </ManagerRoute>
        </MainLayout>
      }/>
      <Route path='/manager/apartments' element={
        <MainLayout>
          <ManagerRoute>
            <ApartmentManagement />
          </ManagerRoute>
        </MainLayout>
      }/>
      {/* Tính lương - chỉ dành cho Admin */}
      <Route path='/admin/salary' element={
        <MainLayout>
          <AdminRoute>
            <EmployeeSalaryManagement />
          </AdminRoute>
        </MainLayout>
      }/>
      <Route path='/manager/search' element={
        <MainLayout>
          <ManagerRoute>
            <div style={{padding: "50px", textAlign: "center"}}>
              <h2>Trang Tìm kiếm</h2>
              <p>Chức năng này đang được phát triển.</p>
              <div style={{marginTop: "20px"}}>
                <a href="/manager/dashboard" style={{padding: "10px 20px", backgroundColor: "#4CAF50", color: "white", textDecoration: "none", borderRadius: "4px"}}>Quay lại Dashboard</a>
              </div>
            </div>
          </ManagerRoute>
        </MainLayout>
      }/>
      
      {/* Protected routes for Tender Manager (cần MainLayout) */}
      <Route path='/tender/dashboard' element={
        <MainLayout>
          <TenderManagerRoute>
            <TenderDashboard />
          </TenderManagerRoute>
        </MainLayout>
      }/>
      <Route path='/tender/tenders' element={
        <MainLayout>
          <TenderManagerRoute>
            <TenderManagement />
          </TenderManagerRoute>
        </MainLayout>
      }/>
      <Route path='/tender/contractors' element={
        <MainLayout>
          <TenderManagerRoute>
            <ContractorManagement />
          </TenderManagerRoute>
        </MainLayout>
      }/>
      <Route path='/tender/bids' element={
        <MainLayout>
          <TenderManagerRoute>
            <BidManagement />
          </TenderManagerRoute>
        </MainLayout>
      }/>
      
      {/* Protected routes for Media Consulting Manager */}
      <Route path='/media-consulting/*' element={
        <MediaConsultingManagerRoute>
          <MediaConsultingLayout />
        </MediaConsultingManagerRoute>
      }>
        <Route path="dashboard" element={<MediaConsultingDashboard />} />
        <Route path="" element={<MediaConsultingDashboard />} />
        
        {/* Profile route */}
        <Route path="profile" element={<ProfileContent />} />
        
        {/* News routes */}
        <Route path="news" element={<NewsList />} />
        <Route path="news/create" element={<NewsForm />} />
        <Route path="news/edit/:id" element={<NewsUpdateForm />} />
        <Route path="news/:id" element={<NewsDetails />} />
        
        {/* Posts routes */}
        <Route path="posts" element={<PostList />} />
        <Route path="posts/create" element={<PostForm />} />
        <Route path="posts/edit/:id" element={<PostForm />} />
        <Route path="posts/:id" element={<PostDetails />} />
        
        {/* Notifications routes */}
        <Route path="notifications" element={<NotificationList />} />
        <Route path="notifications/create" element={<NotificationForm />} />
        <Route path="notifications/edit/:id" element={<NotificationUpdateForm />} />
        <Route path="notifications/:id" element={<NotificationDetails />} />
        
        {/* Comments routes */}
        <Route path="comments" element={<CommentList />} />
        <Route path="comments/:id" element={<CommentDetails />} />
        <Route path="comments/feedback/:id" element={<FeedbackForm />} />
        
        {/* Votes routes */}
        <Route path="votes" element={<VoteList />} />
        <Route path="votes/create" element={<VoteForm />} />
        <Route path="votes/edit/:id" element={<VoteForm />} />
        <Route path="votes/:id" element={<VoteDetails />} />
        <Route path="votes/results/:id" element={<VoteResults />} />
      </Route>
      
      {/* Catch-all route - redirect to home */}
      <Route path='*' element={<HomeScreen />} />
    </Routes>
  )
}

export default MainRouter