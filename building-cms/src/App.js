// Removed unused import 'logo'
import './App.css';
import MainRouter from './routers/MainRouter';
import ErrorBoundary from './components/common/ErrorBoundary';
import { useSecurityAlertNotification } from './hooks/useSecurityAlertNotification';

function App() {
  // Polling security alerts ở tất cả các trang (chạy ở App level để đảm bảo hoạt động ở mọi nơi)
  useSecurityAlertNotification();

  return (
    <ErrorBoundary>
      <MainRouter />
    </ErrorBoundary>
  );
}

export default App;
