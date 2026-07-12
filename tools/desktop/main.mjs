import { app, BrowserWindow, dialog, shell } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = dirname(fileURLToPath(import.meta.url));
const devRoot = resolve(desktopDir, "../..");
let adminServer;
let mainWindow;

const isBlogRoot = (target) =>
  Boolean(
    target &&
      existsSync(join(target, "src")) &&
      existsSync(join(target, "public")) &&
      existsSync(join(target, "tools/admin/public/index.html")) &&
      existsSync(join(target, "package.json"))
  );

const settingsFile = () => join(app.getPath("userData"), "desktop-settings.json");

const readDesktopSettings = () => {
  try {
    return JSON.parse(readFileSync(settingsFile(), "utf8"));
  } catch {
    return {};
  }
};

const writeDesktopSettings = (settings) => {
  mkdirSync(dirname(settingsFile()), { recursive: true });
  writeFileSync(settingsFile(), JSON.stringify(settings, null, 2), "utf8");
};

const candidateRoots = () => {
  const exeDir = app.isPackaged ? dirname(process.execPath) : devRoot;
  const saved = readDesktopSettings().blogRoot;
  return [
    process.env.BLOG_ADMIN_ROOT,
    saved,
    process.cwd(),
    exeDir,
    resolve(exeDir, ".."),
    devRoot
  ].filter(Boolean);
};

const chooseBlogRoot = async () => {
  for (const candidate of candidateRoots()) {
    const resolved = resolve(candidate);
    if (isBlogRoot(resolved)) return resolved;
  }

  const result = await dialog.showOpenDialog({
    title: "选择江水博客仓库目录",
    message: "请选择包含 src、public、tools 文件夹的博客仓库目录。",
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return "";

  const selected = resolve(result.filePaths[0]);
  if (!isBlogRoot(selected)) {
    await dialog.showMessageBox({
      type: "error",
      title: "目录不正确",
      message: "这个目录不像江水博客仓库，请重新选择包含 src、public、tools 文件夹的目录。"
    });
    return chooseBlogRoot();
  }
  writeDesktopSettings({ ...readDesktopSettings(), blogRoot: selected });
  return selected;
};

const createWindow = async (url, blogRoot) => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: "江水博客管理工具",
    backgroundColor: "#0b1020",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-fail-load", async () => {
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "管理工具启动失败",
      message: `没有成功打开本地管理页面。\n\n博客目录：${blogRoot}\n服务地址：${url}`
    });
  });

  await mainWindow.loadURL(url);
};

const startApp = async () => {
  const blogRoot = await chooseBlogRoot();
  if (!blogRoot) {
    app.quit();
    return;
  }

  process.env.BLOG_ADMIN_ROOT = blogRoot;
  process.env.BLOG_ADMIN_PUBLIC = join(blogRoot, "tools/admin/public");
  const { startAdminServer } = await import("../admin/server.mjs");
  adminServer = await startAdminServer({ port: 0 });
  await createWindow(adminServer.url, blogRoot);
};

app.commandLine.appendSwitch("disable-http-cache");

app.whenReady().then(startApp);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && adminServer) {
    createWindow(adminServer.url, adminServer.root);
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  adminServer?.server?.close();
});
