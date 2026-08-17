# MO Cobot Control GUI (GUIRev2)

A modern, real-time control interface for Universal Robots (e-Series / CB-Series) and mock robot simulators. 

Built with **React 19 + Vite** on the frontend, **FastAPI + WebSockets** on the backend, and an **Async TCP Client** connecting to the robot controller.

---

## 📋 System Prerequisites

Before running this application, you need **Python 3** and **Node.js** installed on your system.

### 1. Install Python 3 & venv
* **Linux (Ubuntu / Debian)**:
  ```bash
  sudo apt update
  sudo apt install -y python3 python3-pip python3-venv
  ```
* **macOS**:
  ```bash
  brew install python3
  ```
* **Windows**:
  Download and install Python 3.10+ from [python.org](https://www.python.org/downloads/). Ensure you check **"Add Python to PATH"** during installation.

### 2. Install Node.js & npm (v18+)
* **Linux / macOS (using NVM - Recommended)**:
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  source ~/.bashrc
  nvm install 22
  nvm use 22
  ```
* **Windows**:
  Download and run the installer from [nodejs.org](https://nodejs.org/).

Verify installation by running:
```bash
python3 --version
node -v
npm -v
```

---

## 🛠️ First-Time Project Setup

Extract the ZIP file and open a terminal inside the project root folder (`GUIRev2`).

### Step 1: Set Up Backend Virtual Environment
```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # On Windows use: venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
cd ..
```

### Step 2: Install Frontend Dependencies
```bash
cd frontend-react
npm install
cd ..
```

---

## 🚀 Running the Application

You can run the GUI in **Real Robot Mode** (connecting to an actual UR controller/server) or **Mock Mode** (using the built-in simulator).

---

### Option A: Real Robot Mode (2 Terminals) — Recommended for Production
If you are connected to a real robot controller or real backend server, **you do NOT need the mock server**.

#### Terminal 1: FastAPI Backend Server (Port 8001)
Bridges browser WebSockets to the real robot.
```bash
cd backend
source venv/bin/activate        # On Windows use: venv\Scripts\activate
python3 -m uvicorn main:app --port 8001 --reload
```

#### Terminal 2: React Web Frontend (Port 5173)
Launches the web UI.
```bash
cd frontend-react
npm run dev
```

#### Connecting to your Real Robot:
1. Open **[http://localhost:5173](http://localhost:5173)** in your browser.
2. Go to the **Advanced** page tab.
3. Enter your real robot/server's **IP Address** (e.g. `192.168.1.100`) and **Port** (e.g. `30001` or `29999`).
4. Click **Connect**.

---

### Option B: Mock / Simulator Mode (3 Terminals) — For Testing without a Robot
If you do not have physical robot hardware connected, use the built-in mock server to simulate the robot.

> ⚠️ Start terminals in exact order (1 → 2 → 3):

#### Terminal 1: Mock Robot TCP Server (Port 9999)
```bash
cd backend
source venv/bin/activate        # On Windows use: venv\Scripts\activate
python3 mock_tcp_server.py --port 9999
```

#### Terminal 2: FastAPI Backend Server (Port 8001)
```bash
cd backend
source venv/bin/activate        # On Windows use: venv\Scripts\activate
python3 -m uvicorn main:app --port 8001 --reload
```

#### Terminal 3: React Web Frontend (Port 5173)
```bash
cd frontend-react
npm run dev
```

---

## 💻 Accessing the GUI

Open your web browser and navigate to:
👉 **[http://localhost:5173](http://localhost:5173)**

### How to use:
1. Click **Top Plate Bolting** on the home screen.
2. Click **Initialize** on the control panel to power on and ready the robot.
3. Click **Start** to run the automated task sequence.
4. Navigate to **Calibrate** to manually jog the robot using the D-Pad or Arrow keys (`W`, `A`, `S`, `D`, `Up`, `Down`, `Left`, `Right`).
5. Navigate to **Logs** to view real-time system logs.

---

## ❓ Troubleshooting & Common Errors

### 1. `Command 'python' not found`
Use `python3` instead of `python`:
```bash
python3 -m uvicorn main:app --port 8001
```

### 2. `sh: 1: vite: Permission denied`
If Vite loses execution permission after unzipping:
```bash
cd frontend-react
chmod +x node_modules/.bin/vite
npm run dev
```
If the error persists, reset the `node_modules`:
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### 3. `Connection refused` in Backend Terminal
Make sure **Terminal 1** (`mock_tcp_server.py`) is running *before* starting **Terminal 2** (`main.py`).

### 4. Port Conflicts (`Address already in use`)
If port 9999, 8001, or 5173 is busy, kill existing Python/Uvicorn processes:
```bash
# Linux / macOS
pkill -f mock_tcp_server
pkill -f uvicorn
```

---

## 🏗️ Architecture Overview

```
React Frontend (Port 5173)
       │ (WebSocket /ws)
       ▼
FastAPI Backend (Port 8001)
       │ (TCP Socket)
       ▼
Mock Robot / Universal Robot Controller (Port 9999 / 30001 / 29999)
```
