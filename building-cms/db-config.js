// db-config.js - SQL Server connection using mssql or native msnodesqlv8 (Windows Auth)
// Cho phép cấu hình qua biến môi trường, có log kết nối rõ ràng và singleton pool.

const USE_MSNODESQLV8 = String(process.env.USE_MSNODESQLV8 || '').toLowerCase() === 'true';

const sql = USE_MSNODESQLV8
  ? require('mssql/msnodesqlv8')
  : require('mssql');

// Thiết lập cấu hình với các mặc định an toàn + có thể override bằng ENV
const baseConfig = USE_MSNODESQLV8
  ? {
      server: process.env.SQL_SERVER || 'localhost',
      database: process.env.SQL_DATABASE || 'QUANLYTHUCHI',
      port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 1433,
      driver: 'msnodesqlv8',
      options: {
        trustedConnection: true,
        trustServerCertificate: true
      },
      connectionTimeout: process.env.SQL_CONN_TIMEOUT ? Number(process.env.SQL_CONN_TIMEOUT) : 15000,
      requestTimeout: process.env.SQL_REQ_TIMEOUT ? Number(process.env.SQL_REQ_TIMEOUT) : 30000
    }
  : {
      server: process.env.SQL_SERVER || 'localhost',
      user: process.env.SQL_USER || 'sa',
      password: process.env.SQL_PASSWORD || '@Aa123456',
      database: process.env.SQL_DATABASE || 'QUANLYTHUCHI',
      port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 1433,
      options: {
        encrypt: false,
        trustServerCertificate: true
      },
      pool: {
        max: process.env.SQL_POOL_MAX ? Number(process.env.SQL_POOL_MAX) : 10,
        min: process.env.SQL_POOL_MIN ? Number(process.env.SQL_POOL_MIN) : 1,
        idleTimeoutMillis: process.env.SQL_POOL_IDLE ? Number(process.env.SQL_POOL_IDLE) : 30000
      },
      connectionTimeout: process.env.SQL_CONN_TIMEOUT ? Number(process.env.SQL_CONN_TIMEOUT) : 15000,
      requestTimeout: process.env.SQL_REQ_TIMEOUT ? Number(process.env.SQL_REQ_TIMEOUT) : 30000
    };

// Tránh tạo nhiều pool khi hot-reload: dùng singleton trên globalThis
// eslint-disable-next-line no-undef
let globalAny = globalThis;
if (!globalAny.__mssqlPoolPromise) {
  globalAny.__mssqlPoolPromise = new sql.ConnectionPool(baseConfig)
    .connect()
    .then((pool) => {
      console.log(`✓ Connected to SQL Server: ${baseConfig.server}:${baseConfig.port} DB: ${baseConfig.database}`);
      return pool;
    })
    .catch((err) => {
      console.error('[SQL Connection Error]', {
        server: baseConfig.server,
        port: baseConfig.port,
        database: baseConfig.database,
        driver: USE_MSNODESQLV8 ? 'msnodesqlv8' : 'tedious (default mssql)'
      });
      console.error('Message:', err.message);
      throw err;
    });
}

const poolPromise = globalAny.__mssqlPoolPromise;

module.exports = { sql, poolPromise };