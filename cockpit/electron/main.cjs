const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const isDev = process.env.NODE_ENV === "development";

let mainWindow = null;
let serverProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Nova Cockpit",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function startBackend() {
  const serverPath = path.join(__dirname, "..", "..", "backend", "server.ts");
  const npxPath = process.platform === "win32" 
    ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "cmd.exe")
    : "npx";
  
  const args = process.platform === "win32" 
    ? ["/c", "npx", "tsx", serverPath]
    : ["tsx", serverPath];
    
  serverProcess = spawn(npxPath, args, {
    stdio: "inherit",
    env: { ...process.env, NOVA_API_PORT: "3737" },
    shell: process.platform === "win32",
  });
  serverProcess.on("error", (err) => {
    console.error("Failed to start backend server:", err.message);
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
