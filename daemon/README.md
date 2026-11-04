# AetherDaemon

High-performance, distributed node daemon agent for **AetherPanel**.

- **Default Port:** `9666`
- **Zero External Dependencies:** Built on native Node.js runtime.
- **Auto-Telemetry:** Real-time CPU, RAM, Disk, Uptime, and Container monitoring.
- **Heartbeat Protocol:** Continuous 10-second pulses with `AETHER-...` token authentication.

---

## 🚀 Quick Install

### One-line Installer:
```bash
bash <(curl -s https://raw.githubusercontent.com/mrrangerxd/daemon/main/installer.sh)
```

### Manual Setup:
1. Clone repository:
   ```bash
   git clone https://github.com/mrrangerxd/daemon.git /etc/aetherdaemon
   cd /etc/aetherdaemon
   ```
2. Copy sample configuration:
   ```bash
   cp config.example.json config.json
   ```
3. Edit `config.json` with your Panel URL and Node Token:
   ```json
   {
     "panelUrl": "https://panel.yourdomain.com",
     "nodeToken": "AETHER-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
     "port": 9666,
     "host": "0.0.0.0",
     "heartbeatIntervalSeconds": 10
   }
   ```
4. Start Daemon:
   ```bash
   node agent.js
   ```

---

## 🛠 Systemd Service

To run automatically on boot:
```bash
sudo systemctl enable --now aetherdaemon
sudo systemctl status aetherdaemon
```
