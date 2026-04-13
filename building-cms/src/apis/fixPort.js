// Run this script in the browser console to fix port issues
(function() {
  localStorage.setItem('json_server_port', '3003');
  console.log('Port set to 3003 in localStorage');
  console.log('Reloading page to apply new port...');
  setTimeout(() => window.location.reload(), 1000);
})(); 