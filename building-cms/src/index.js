import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Import Bootstrap và các thư viện animation
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'animate.css';
import AOS from 'aos';
import 'aos/dist/aos.css';

// Setup Font Awesome
import { library } from '@fortawesome/fontawesome-svg-core';
import { 
  faBell, faUser, faCog, faSignOutAlt, 
  faSearch, faPlus, faTrash, faEdit, faEye,
  faDownload, faSave, faUpload, faFilter
} from '@fortawesome/free-solid-svg-icons';

// Add icons to the library
library.add(
  faBell, faUser, faCog, faSignOutAlt,
  faSearch, faPlus, faTrash, faEdit, faEye,
  faDownload, faSave, faUpload, faFilter
);

// Khởi tạo AOS
AOS.init({
  duration: 800,
  once: false
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
