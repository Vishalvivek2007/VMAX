module.exports = {
  apps: [
    {
      name: "vmax",
      script: "backend/server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
