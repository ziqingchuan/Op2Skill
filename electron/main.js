"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const chromeImport_1 = require("./services/chromeImport");
const chromeProfile_1 = require("./services/chromeProfile");
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
const CHROME_IMPORT_DEBUG = process.env.CHROME_IMPORT_DEBUG === '1';
const DEFAULT_BROWSER_ZOOM = 0.75;
const COZE_API_WORKFLOW = 'https://api.coze.cn/v1/workflow/run';
const COZE_AUTH_TOKEN = 'pat_xjlFc7hPavZTMo4WSkIsMWDk3MQD8g6fL7CBelLhGvnaAYMZAbeCJM0LNYGeVvDR';
const COZE_WORKFLOW_ID = '7662192240337747983';
let mainWindow = null;
let browserView = null;
let currentBounds = { x: 0, y: 0, width: 0, height: 0 };
let lastRecordedNavigationUrl = '';
let recordingSession = {
    command: null,
    startTime: 0,
};
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 16, y: 18 },
        backgroundColor: '#FAFAF9',
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true,
        },
        show: false,
    });
    preventMainWindowNavigation(mainWindow);
    createBrowserView(mainWindow);
    if (isDev) {
        mainWindow.loadURL('http://127.0.0.1:5173');
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.once('ready-to-show', () => mainWindow?.show());
    mainWindow.on('closed', () => {
        mainWindow = null;
        browserView = null;
    });
}
function createBrowserView(owner) {
    browserView = new electron_1.WebContentsView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'browser-preload.js'),
            webSecurity: true,
        },
    });
    browserView.setBackgroundColor('#ffffff');
    browserView.setVisible(false);
    owner.contentView.addChildView(browserView);
    const wc = browserView.webContents;
    wc.setWindowOpenHandler(({ url }) => {
        loadBrowserURL(url);
        return { action: 'deny' };
    });
    wc.on('did-start-loading', () => sendBrowserState(true));
    wc.on('did-stop-loading', () => sendBrowserState(false));
    wc.on('did-navigate', (_event, url) => {
        emitNavigationEvent(url);
        sendBrowserState(false);
    });
    wc.on('did-navigate-in-page', (_event, url) => {
        lastRecordedNavigationUrl = url;
        sendBrowserState(false);
    });
    wc.on('page-title-updated', () => sendBrowserState(false));
    wc.on('did-fail-load', () => sendBrowserState(false));
    applyBrowserZoom();
    wc.on('dom-ready', () => {
        applyBrowserZoom();
        syncRecordingCommand();
    });
    wc.on('did-finish-load', () => {
        applyBrowserZoom();
        syncRecordingCommand();
    });
}
function preventMainWindowNavigation(owner) {
    owner.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    owner.webContents.on('will-navigate', (event, url) => {
        const allowedDevUrl = isDev && url.startsWith('http://127.0.0.1:5173');
        const allowedProdFile = !isDev && url.startsWith('file://');
        if (!allowedDevUrl && !allowedProdFile) {
            event.preventDefault();
        }
    });
}
function getBrowserContents() {
    if (!browserView || browserView.webContents.isDestroyed())
        return null;
    return browserView.webContents;
}
function applyBrowserZoom() {
    const wc = getBrowserContents();
    if (!wc || wc.isDestroyed())
        return;
    wc.setZoomFactor(DEFAULT_BROWSER_ZOOM);
}
function normalizeURL(input) {
    const trimmed = input.trim();
    if (!trimmed)
        return null;
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
function loadBrowserURL(input) {
    const wc = getBrowserContents();
    const url = normalizeURL(input);
    if (!wc || !url)
        return;
    wc.loadURL(url).catch(() => { });
}
function setBrowserBounds(bounds) {
    currentBounds = {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.max(0, Math.round(bounds.width)),
        height: Math.max(0, Math.round(bounds.height)),
    };
    if (!browserView)
        return;
    // If a React modal is open, keep the native view hidden
    if (modalVisible)
        return;
    const visible = currentBounds.width > 0 && currentBounds.height > 0;
    browserView.setVisible(visible);
    if (!visible)
        return;
    browserView.setBounds(currentBounds);
}
function getBrowserState(isLoading) {
    const wc = getBrowserContents();
    return {
        url: wc?.getURL() ?? '',
        title: wc?.getTitle() ?? '',
        isLoading: isLoading ?? wc?.isLoading() ?? false,
        canGoBack: wc?.canGoBack() ?? false,
        canGoForward: wc?.canGoForward() ?? false,
    };
}
function sendBrowserState(isLoading) {
    if (!mainWindow || mainWindow.webContents.isDestroyed())
        return;
    mainWindow.webContents.send('browser-state-change', getBrowserState(isLoading));
}
function isRecordingActive() {
    return recordingSession.command === 'START' || recordingSession.command === 'RESUME';
}
function generateRecorderId() {
    return Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}
function sendRecorderEvent(event) {
    if (!mainWindow || mainWindow.webContents.isDestroyed())
        return;
    mainWindow.webContents.send('browser-recorder-event', event);
}
function emitNavigationEvent(toUrl) {
    const wc = getBrowserContents();
    const fromUrl = lastRecordedNavigationUrl;
    lastRecordedNavigationUrl = toUrl;
    if (!wc || !isRecordingActive() || !toUrl || fromUrl === toUrl)
        return;
    sendRecorderEvent({
        id: generateRecorderId(),
        timestamp: Date.now(),
        relativeTime: recordingSession.startTime ? Date.now() - recordingSession.startTime : 0,
        type: 'navigation',
        tabId: 0,
        tabTitle: wc.getTitle(),
        tabUrl: toUrl,
        data: { fromUrl, toUrl },
    });
}
function syncRecordingCommand() {
    const wc = getBrowserContents();
    if (!wc || !recordingSession.command)
        return;
    wc.send('browser-recorder-command', {
        cmd: recordingSession.command,
        startTime: recordingSession.startTime,
    });
}
function createCozeError(message, type, details = {}) {
    const error = new Error(message);
    error.type = type;
    Object.assign(error, details);
    return error;
}
function redactCozeToken(text) {
    return text ? text.split(COZE_AUTH_TOKEN).join('[REDACTED_COZE_TOKEN]') : text;
}
function sanitizeCozeDetails(value) {
    if (typeof value === 'string')
        return redactCozeToken(value);
    if (Array.isArray(value))
        return value.map(sanitizeCozeDetails);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizeCozeDetails(entry)]));
    }
    return value;
}
function serializeCozeError(error) {
    return {
        message: redactCozeToken(error.message),
        type: error.type,
        statusCode: error.statusCode,
        response: sanitizeCozeDetails(error.response),
        responseText: redactCozeToken(error.responseText),
        parsedData: sanitizeCozeDetails(error.parsedData),
        result: sanitizeCozeDetails(error.result),
        debugUrl: error.debugUrl,
        logId: error.logId,
    };
}
function parseCozeJson(responseText) {
    try {
        return JSON.parse(responseText);
    }
    catch (error) {
        throw createCozeError(`响应 JSON 解析失败: ${error instanceof Error ? error.message : String(error)}`, 'parse', { responseText, originalError: error });
    }
}
function parseCozeData(data) {
    if (typeof data === 'string') {
        try {
            return JSON.parse(data);
        }
        catch (error) {
            throw createCozeError('工作流返回的 data 字段 JSON 解析失败', 'parse', {
                responseText: data,
                originalError: error,
            });
        }
    }
    if (data && typeof data === 'object')
        return data;
    throw createCozeError('工作流返回结果中未找到 data 字段', 'data', { parsedData: data });
}
function normalizeMarkdown(raw) {
    let md = raw.trim();
    // Strip ALL levels of outer code fences wrapping the entire content.
    // Handles: ```markdown\n...\n```  ```md\n...\n```  ```\n...\n```
    // Also handles cases where the model wraps in multiple layers.
    let stripped = true;
    while (stripped) {
        stripped = false;
        const fenceMatch = md.match(/^```(?:[a-zA-Z]*)?\s*\n([\s\S]*)\n\s*```\s*$/);
        if (fenceMatch) {
            md = fenceMatch[1].trim();
            stripped = true;
        }
    }
    // Strip leading/trailing blank lines
    md = md.replace(/^\n+/, '').replace(/\n+$/, '');
    // If the first non-empty line is indented by 4+ spaces, dedent the whole content
    const firstLine = md.split('\n').find((l) => l.trim().length > 0);
    if (firstLine) {
        const leadingSpaces = firstLine.match(/^( {4,}|\t+)/);
        if (leadingSpaces) {
            const indent = leadingSpaces[1];
            md = md
                .split('\n')
                .map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line))
                .join('\n');
        }
    }
    return md;
}
function parseCozeOutput(result, responseText) {
    const code = result.code;
    if (typeof code === 'number' && code !== 0) {
        const message = typeof result.msg === 'string' && result.msg
            ? result.msg
            : `工作流返回业务错误码 ${code}`;
        throw createCozeError(`工作流调用失败: ${message}`, 'api', {
            response: result,
            responseText,
        });
    }
    const data = parseCozeData(result.data);
    const output = data.output;
    let md = '';
    if (typeof output === 'string')
        md = output;
    else if (output && typeof output === 'object')
        md = JSON.stringify(output, null, 2);
    else if (output !== undefined && output !== null)
        md = String(output);
    if (md)
        return { normalized: normalizeMarkdown(md), raw: md };
    throw createCozeError('工作流返回结果中未找到 output 字段', 'data', {
        response: result,
        parsedData: data,
        responseText,
    });
}
async function runCozeWorkflow(recordingJson) {
    const body = JSON.stringify({
        workflow_id: COZE_WORKFLOW_ID,
        parameters: {
            recording_json: recordingJson,
        },
    });
    let response;
    try {
        response = await fetch(COZE_API_WORKFLOW, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${COZE_AUTH_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body,
        });
    }
    catch (error) {
        throw createCozeError(`网络请求失败: ${error instanceof Error ? error.message : String(error)}`, 'network', { originalError: error });
    }
    const responseText = await response.text();
    const result = parseCozeJson(responseText);
    if (!response.ok) {
        const message = typeof result.msg === 'string' && result.msg
            ? result.msg
            : `HTTP ${response.status}`;
        throw createCozeError(`工作流 API 调用失败: ${message}`, 'api', {
            statusCode: response.status,
            response: result,
            responseText,
        });
    }
    return parseCozeOutput(result, responseText);
}
electron_1.ipcMain.handle('skill:generate', async (_event, session) => {
    try {
        const result = await runCozeWorkflow(JSON.stringify(session));
        return result;
    }
    catch (error) {
        if (error && typeof error === 'object' && 'type' in error) {
            throw createCozeError(error.message, error.type, serializeCozeError(error));
        }
        throw error;
    }
});
electron_1.ipcMain.handle('browser:navigate', (_event, url) => {
    loadBrowserURL(url);
});
electron_1.ipcMain.handle('browser:back', () => {
    const wc = getBrowserContents();
    if (wc?.canGoBack())
        wc.goBack();
});
electron_1.ipcMain.handle('browser:forward', () => {
    const wc = getBrowserContents();
    if (wc?.canGoForward())
        wc.goForward();
});
electron_1.ipcMain.handle('browser:reload', () => {
    getBrowserContents()?.reload();
});
electron_1.ipcMain.handle('browser:set-zoom', (_event, factor) => {
    const wc = getBrowserContents();
    if (wc && !wc.isDestroyed())
        wc.setZoomFactor(factor);
});
electron_1.ipcMain.handle('browser:get-zoom', () => {
    const wc = getBrowserContents();
    return wc && !wc.isDestroyed() ? wc.getZoomFactor() : DEFAULT_BROWSER_ZOOM;
});
electron_1.ipcMain.handle('browser:clear-cache', async () => {
    const wc = getBrowserContents();
    if (wc && !wc.isDestroyed()) {
        await wc.session.clearCache();
    }
});
electron_1.ipcMain.handle('browser:clear-cookies', async () => {
    const wc = getBrowserContents();
    if (wc && !wc.isDestroyed()) {
        await wc.session.clearStorageData({
            storages: ['cookies'],
        });
    }
});
electron_1.ipcMain.handle('browser:show-context-menu', async (_event) => {
    const wc = getBrowserContents();
    if (!wc || wc.isDestroyed())
        return;
    const zoom = wc.getZoomFactor();
    const menu = electron_1.Menu.buildFromTemplate([
        {
            label: '缩放',
            submenu: [
                {
                    label: '−  缩小',
                    click: () => {
                        const z = Math.max(0.25, Math.round((zoom - 0.25) * 100) / 100);
                        wc.setZoomFactor(z);
                        notifyZoomChange(z);
                    },
                },
                {
                    label: `${Math.round(zoom * 100)}%`,
                    enabled: false,
                },
                {
                    label: '+  放大',
                    click: () => {
                        const z = Math.min(3, Math.round((zoom + 0.25) * 100) / 100);
                        wc.setZoomFactor(z);
                        notifyZoomChange(z);
                    },
                },
            ],
        },
        { type: 'separator' },
        {
            label: 'Cookie 管理',
            click: () => {
                if (mainWindow && !mainWindow.webContents.isDestroyed()) {
                    mainWindow.webContents.send('open-browser-modal', 'cookie');
                }
            },
        },
        {
            label: '密码管理',
            click: () => {
                if (mainWindow && !mainWindow.webContents.isDestroyed()) {
                    mainWindow.webContents.send('open-browser-modal', 'password');
                }
            },
        },
        {
            label: '导入 Cookie 和密码',
            click: () => {
                if (mainWindow && !mainWindow.webContents.isDestroyed()) {
                    mainWindow.webContents.send('open-browser-modal', 'import');
                }
            },
        },
        { type: 'separator' },
        {
            label: '清除缓存',
            click: async () => { await wc.session.clearCache(); },
        },
        {
            label: '清除 Cookie',
            click: async () => {
                await wc.session.clearStorageData({ storages: ['cookies'] });
            },
        },
    ]);
    menu.popup({ window: mainWindow ?? undefined });
});
// ---------------------------------------------------------------------------
// Credential management IPCs
// ---------------------------------------------------------------------------
electron_1.ipcMain.handle('browser:get-cookies', async () => {
    const wc = getBrowserContents();
    if (!wc || wc.isDestroyed())
        return [];
    return wc.session.cookies.get({});
});
electron_1.ipcMain.handle('browser:set-cookie', async (_event, details) => {
    const wc = getBrowserContents();
    if (!wc || wc.isDestroyed())
        return;
    await wc.session.cookies.set(details);
});
electron_1.ipcMain.handle('browser:remove-cookie', async (_event, url, name) => {
    const wc = getBrowserContents();
    if (!wc || wc.isDestroyed())
        return;
    await wc.session.cookies.remove(url, name);
});
electron_1.ipcMain.handle('browser:get-passwords', async () => {
    return readStoredPasswords();
});
electron_1.ipcMain.handle('browser:save-passwords', async (_event, entries) => {
    writeStoredPasswords(entries);
});
electron_1.ipcMain.handle('browser:list-chrome-profiles', async () => {
    return (0, chromeProfile_1.listChromeProfiles)();
});
electron_1.ipcMain.handle('browser:import-credentials', async (_event, options) => {
    const wc = getBrowserContents();
    if (!wc || wc.isDestroyed()) {
        return {
            cookiesImported: 0,
            cookiesSkipped: 0,
            passwordsImported: 0,
            passwordsSkipped: 0,
            errors: ['内嵌浏览器未就绪，请先加载一个网页'],
        };
    }
    return (0, chromeImport_1.applyChromeImport)(options, async (details) => {
        try {
            await wc.session.cookies.set(details);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (CHROME_IMPORT_DEBUG) {
                console.info('[chrome-import][cookie][set-failed]', { details, error: message });
            }
            const overwriteHttpOnly = message.includes('EXCLUDE_OVERWRITE_HTTP_ONLY');
            const overwriteSecure = message.includes('EXCLUDE_OVERWRITE_SECURE');
            const canRetryOverwrite = overwriteHttpOnly || overwriteSecure;
            if (!canRetryOverwrite || !details.url || !details.name)
                throw error;
            const retryUrl = overwriteSecure ? details.url.replace(/^http:\/\//i, 'https://') : details.url;
            if (CHROME_IMPORT_DEBUG) {
                console.info('[chrome-import][cookie][overwrite-retry-remove]', {
                    name: details.name,
                    originalUrl: details.url,
                    retryUrl,
                    reason: overwriteSecure ? 'EXCLUDE_OVERWRITE_SECURE' : 'EXCLUDE_OVERWRITE_HTTP_ONLY',
                });
            }
            await wc.session.cookies.remove(retryUrl, details.name);
            const retryDetails = overwriteSecure ? { ...details, url: retryUrl, secure: true } : details;
            if (CHROME_IMPORT_DEBUG) {
                console.info('[chrome-import][cookie][overwrite-retry-set]', retryDetails);
            }
            try {
                await wc.session.cookies.set(retryDetails);
                if (CHROME_IMPORT_DEBUG) {
                    console.info('[chrome-import][cookie][overwrite-retry-success]', retryDetails);
                }
            }
            catch (retryError) {
                if (CHROME_IMPORT_DEBUG) {
                    console.info('[chrome-import][cookie][overwrite-retry-failed]', {
                        details: retryDetails,
                        error: retryError instanceof Error ? retryError.message : String(retryError),
                    });
                }
                throw retryError;
            }
        }
    }, readStoredPasswords, writeStoredPasswords);
});
electron_1.ipcMain.handle('browser:set-modal-visible', async (_event, visible) => {
    setModalVisible(visible);
});
function notifyZoomChange(factor) {
    if (!mainWindow || mainWindow.webContents.isDestroyed())
        return;
    mainWindow.webContents.send('browser-zoom-change', factor);
}
function getPasswordsPath() {
    return path.join(electron_1.app.getPath('userData'), 'passwords.enc');
}
function readStoredPasswords() {
    const filePath = getPasswordsPath();
    if (!fs.existsSync(filePath))
        return [];
    try {
        if (!electron_1.safeStorage.isEncryptionAvailable())
            return [];
        const encrypted = fs.readFileSync(filePath);
        const json = electron_1.safeStorage.decryptString(encrypted);
        return JSON.parse(json);
    }
    catch {
        return [];
    }
}
function writeStoredPasswords(entries) {
    if (!electron_1.safeStorage.isEncryptionAvailable())
        return;
    const json = JSON.stringify(entries);
    const encrypted = electron_1.safeStorage.encryptString(json);
    fs.writeFileSync(getPasswordsPath(), encrypted);
}
// ---------------------------------------------------------------------------
// Sessions persistence
// ---------------------------------------------------------------------------
function getSessionsPath() {
    return path.join(electron_1.app.getPath('userData'), 'sessions.json');
}
electron_1.ipcMain.handle('sessions:load', () => {
    const filePath = getSessionsPath();
    if (!fs.existsSync(filePath))
        return '[]';
    try {
        return fs.readFileSync(filePath, 'utf-8');
    }
    catch {
        return '[]';
    }
});
electron_1.ipcMain.handle('sessions:save', (_event, data) => {
    try {
        fs.writeFileSync(getSessionsPath(), data, 'utf-8');
    }
    catch { /* ignore */ }
});
// ---------------------------------------------------------------------------
// Modal visibility — hide WebContentsView when a React modal is open
// ---------------------------------------------------------------------------
let modalVisible = false;
function setModalVisible(modalOpen) {
    modalVisible = modalOpen;
    if (!browserView)
        return;
    if (modalOpen) {
        // Modal is open — hide the native browser view so React modal can appear above it
        browserView.setVisible(false);
        browserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
    else {
        // Modal closed — restore the view to its saved bounds
        if (currentBounds.width > 0 && currentBounds.height > 0) {
            browserView.setVisible(true);
            browserView.setBounds(currentBounds);
        }
    }
}
electron_1.ipcMain.handle('browser:set-bounds', (_event, bounds) => {
    setBrowserBounds(bounds);
});
electron_1.ipcMain.handle('browser:set-recording-state', (_event, payload) => {
    recordingSession = {
        command: payload.cmd,
        startTime: payload.startTime ?? recordingSession.startTime,
    };
    if (payload.cmd === 'START') {
        lastRecordedNavigationUrl = getBrowserContents()?.getURL() ?? '';
    }
    if (payload.cmd === 'STOP') {
        lastRecordedNavigationUrl = '';
    }
    syncRecordingCommand();
});
electron_1.ipcMain.on('browser-recorder-event', (_event, event) => {
    sendRecorderEvent(event);
});
electron_1.app.whenReady().then(() => {
    const iconPath = path.join(__dirname, 'icon.png');
    if (process.platform === 'darwin' && electron_1.app.dock) {
        const dockIcon = electron_1.nativeImage.createFromPath(iconPath);
        if (!dockIcon.isEmpty())
            electron_1.app.dock.setIcon(dockIcon);
    }
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
