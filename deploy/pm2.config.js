const path = require('path')

module.exports = {
  apps: [
    {
      name: 'pmis-backend',
      script: path.join(__dirname, '..', 'backend', 'src', 'app.js'),
      cwd: path.join(__dirname, '..', 'backend'),
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3103,
      },
      // 日志
      error_file: path.join(__dirname, '..', 'backend', 'logs', 'pm2-error.log'),
      out_file: path.join(__dirname, '..', 'backend', 'logs', 'pm2-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // 自动重启
      watch: false,
      max_memory_restart: '500M',
      // 优雅关闭
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
}
