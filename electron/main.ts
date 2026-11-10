import { app, BrowserWindow, Menu, dialog, ipcMain, protocol, session } from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateSaveRequest, writeKmzFile } from './saveKmz';
import type { SaveResult } from '../src/types';
protocol.registerSchemesAsPrivileged([{ scheme: 'wtg', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
let mainWindow: BrowserWindow | null = null;
let saving = false;
const APP_URL = 'wtg://bundle/index.html';
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => { if (mainWindow?.isMinimized()) mainWindow.restore(); mainWindow?.focus(); });
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    const root = path.resolve(__dirname, '../dist');
    protocol.handle('wtg', async request => {
      const url = new URL(request.url);
      if (url.host !== 'bundle') return new Response('Forbidden', { status: 403 });
      let target: string;
      try { target = path.resolve(root, `.${decodeURIComponent(url.pathname)}`); } catch { return new Response('Bad path', { status: 400 }); }
      const relative = path.relative(root, target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Forbidden', { status: 403 });
      const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon' };
      try { return new Response(new Uint8Array(await readFile(target)), { headers: { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' } }); }
      catch { return new Response('Not found', { status: 404 }); }
    });
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('wtg://bundle/') }));
    mainWindow = new BrowserWindow({ width: 1360, height: 920, minWidth: 920, minHeight: 680, backgroundColor: '#eef2ed', title: 'WTG KMZ Generator', show: false,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false } });
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event, url) => { if (url !== APP_URL) event.preventDefault(); });
    mainWindow.once('ready-to-show', () => mainWindow?.show());
    mainWindow.on('close', event => { if (saving) { event.preventDefault(); dialog.showMessageBox(mainWindow!, { type: 'info', message: '파일 저장을 마친 후 프로그램을 닫아 주세요.' }).catch(() => {}); } });
    mainWindow.on('closed', () => { mainWindow = null; });
    const allowed = (event: Electron.IpcMainInvokeEvent) => !!mainWindow && event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame && event.senderFrame?.url === APP_URL;
    ipcMain.handle('app:version', event => { if (!allowed(event)) throw new Error('Invalid sender'); return app.getVersion(); });
    ipcMain.handle('kmz:save', async (event, value): Promise<SaveResult> => {
      if (!allowed(event)) return { status: 'failed', code: 'SENDER', message: '허용되지 않은 저장 요청입니다.' };
      if (saving) return { status: 'failed', code: 'BUSY', message: '다른 파일을 저장하고 있습니다.' };
      saving = true;
      try {
        const request = validateSaveRequest(value);
        const result = await dialog.showSaveDialog(mainWindow!, { title: '발전기 KMZ 저장', defaultPath: path.join(app.getPath('downloads'), request.suggestedName), filters: [{ name: 'Google Earth KMZ', extensions: ['kmz'] }], properties: ['showOverwriteConfirmation'] });
        if (result.canceled || !result.filePath) return { status: 'cancelled' };
        const filePath = path.extname(result.filePath) ? result.filePath : `${result.filePath}.kmz`;
        await writeKmzFile(filePath, request.bytes);
        return { status: 'saved', filePath };
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code || 'SAVE';
        const messages: Record<string, string> = { ENOSPC: '디스크 공간이 부족합니다.', EACCES: '저장 폴더의 쓰기 권한을 확인하세요.', EPERM: '파일 잠금 또는 쓰기 권한을 확인하세요.', EBUSY: '파일을 사용 중인 프로그램을 닫고 다시 저장하세요.', ENOENT: '저장 폴더를 찾을 수 없습니다.' };
        return { status: 'failed', code, message: messages[code] || '파일 저장에 실패했습니다. 다른 위치를 선택해 다시 시도하세요.' };
      } finally { saving = false; }
    });
    await mainWindow.loadURL(APP_URL);
  }).catch(() => { dialog.showErrorBox('프로그램 시작 실패', '프로그램 자산을 불러오지 못했습니다. 배포 파일을 다시 확인하세요.'); app.quit(); });
  app.on('window-all-closed', () => app.quit());
}
