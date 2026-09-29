module.exports = {
  apps: [
    {
      name: 'newspaper-kalyartraders',
      script: 'server.js',
      cwd: '/www/wwwroot/newspaper.kalyartraders.com',
      env: {
        NODE_ENV: 'production',
        PORT: 3012
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
