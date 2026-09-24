// PM2 process config — keeps the CRM running and restarts it on crash / server reboot.
// Usage on the VPS (from this folder):  pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "webrocz-crm",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        // Port 3000 and 5000 are already used by showyours / digital-hat on this VPS,
        // so the CRM runs on 3005. Nginx proxies crm.webrocz.com → 127.0.0.1:3005.
        PORT: "3005",
      },
    },
  ],
};
