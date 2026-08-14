# 🚀 AetherPanel & AetherNode - Next-Gen Game Panel Control Plane

AetherPanel is a high-performance, full-stack game server management panel built with **React 19**, **TypeScript**, **Tailwind CSS**, and an **Express backend engine**.

---

## 💻 Running AetherPanel Locally on PC (Development Mode)

Follow these simple steps to run and test AetherPanel on your local machine:

### 1️⃣ Prerequisites
Ensure you have the following installed on your computer:
* **Node.js**: v18.0.0 or higher (v20+ recommended)
* **npm**: v9.0.0 or higher
* **Git**: Installed on your operating system

---

### 2️⃣ Clone the Repository & Install Dependencies

Open your terminal or command prompt and run:

```bash
# Clone your repository
git clone https://github.com/your-username/aetherpanel.git
cd aetherpanel

# Install all required npm packages
npm install
```

---

### 3️⃣ Start Development Server

Run the development server command:

```bash
npm run dev
```

The development server will start the Express engine with TypeScript support (`tsx`) on port **3000**:
```
Server running on http://localhost:3000
```

---

### 4️⃣ Access the Panel in your Browser

Open your browser and navigate to:
👉 **`http://localhost:3000`**

---

### 🔑 Default Credentials for First Login

* **Username / Email**: `admin@aetherpanel.in`
* **Password**: `adminopp`

> 🔒 **Security Feature**: Upon logging in for the first time with initial credentials, AetherPanel will automatically prompt you to set a new password before granting full access.

---

## 🛠️ Local Development Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Express server + Vite frontend in hot development mode on port 3000 |
| `npm run lint` | Runs TypeScript type checking without generating build files |
| `npm run build` | Compiles frontend assets and bundles `server.ts` into `dist/server.cjs` |
| `npm start` | Launches the production bundled server (`node dist/server.cjs`) |

---

## 📡 Remote Node Agent Installation (`install.sh`)

To connect a remote VPS or dedicated server as an AetherNode hosting node:

1. Log into AetherPanel as Admin -> Go to **Nodes Management** -> Click **Create Node**.
2. Click **Generate Install Command** next to the node.
3. Run the generated `bash install.sh` command on your remote Linux VPS as root:

```bash
curl -sSL http://localhost:3000/install.sh | bash -s -- --node --token YOUR_ONE_TIME_TOKEN --panel http://localhost:3000
```

---

## 🌟 Key Features
- **Server Deployment Wizard**: Instantly deploy Minecraft Java, Bedrock, Discord Bots, and PostgreSQL servers.
- **Real Modrinth & Hangar Plugin Repository**: Search and download real `.jar` plugin artifacts directly into server directories.
- **Interactive Web Terminal & Console**: Control game server processes in real-time.
- **Node Daemon Health & Auto-Sync**: Automated heartbeats, memory/CPU metrics, and token authentication.
- **Full File Manager & Config Editor**: Create, upload, edit, and delete server files easily.
