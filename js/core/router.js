import { isUnlocked } from '../services/auth-gate.js';
import { setActiveNav } from './shell.js';

const routeTable = {
  '/summary': {
    file: 'pages/summary.html',
    title: '資料匯總',
    protected: false,
    controller: () => import('../pages/summary.js'),
  },
  '/scan': {
    file: 'pages/scan.html',
    title: '點名讀卡',
    protected: true,
    lockScope: 'scan',
    controller: () => import('../pages/scan.js'),
  },
  '/sessions': {
    file: 'pages/sessions.html',
    title: '場次管理',
    protected: true,
    controller: () => import('../pages/sessions.js'),
  },
  '/members': {
    file: 'pages/members.html',
    title: '成員管理',
    protected: true,
    controller: () => import('../pages/members.js'),
  },
  '/goodkid': {
    file: 'pages/goodkid.html',
    title: '好寶寶系統',
    protected: true,
    controller: () => import('../pages/goodkid.js'),
  },
  '/log': {
    file: 'pages/log.html',
    title: '活動紀錄',
    protected: true,
    controller: () => import('../pages/log.js'),
  },
  '/export': {
    file: 'pages/export.html',
    title: '匯出系統',
    protected: false,
    controller: () => import('../pages/export.js'),
  },
};

const lockRoute = {
  file: 'pages/lock.html',
  title: '請先解鎖',
  controller: () => import('../pages/lock.js'),
};

let currentCleanup = null;
let defaultRoute = '/summary';

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || defaultRoute;
  const [path, query] = raw.split('?');
  const params = new URLSearchParams(query || '');
  return { path: path || defaultRoute, params, raw };
}

async function runCleanup() {
  if (typeof currentCleanup === 'function') {
    try {
      currentCleanup();
    } catch (err) {
      console.error('Route cleanup failed', err);
    }
  }
  currentCleanup = null;
}

async function renderRoute() {
  const outlet = document.getElementById('page-outlet');
  const { path, params, raw } = parseHash();
  let entry = routeTable[path];

  if (!entry) {
    window.location.hash = `#${defaultRoute}`;
    return;
  }

  await runCleanup();

  const lockScope = entry.lockScope || 'general';
  const needsUnlock = entry.protected && !isUnlocked(lockScope);
  const target = needsUnlock ? lockRoute : entry;

  outlet.innerHTML = '<div class="state-block"><div class="spinner"></div>載入中…</div>';

  try {
    const [html, mod] = await Promise.all([
      fetch(target.file).then((r) => {
        if (!r.ok) throw new Error(`無法載入 ${target.file}`);
        return r.text();
      }),
      target.controller(),
    ]);

    outlet.innerHTML = html;

    const context = {
      params,
      path,
      navigate: (nextPath) => {
        window.location.hash = `#${nextPath}`;
      },
      // Lock page uses this to know which route (including any query string,
      // e.g. /scan?demo=1) to resume after unlocking.
      resumePath: needsUnlock ? raw : null,
      // Which password scope to unlock ('general' or 'scan'); only meaningful on the lock page.
      lockScope,
    };

    const cleanup = await mod.mountPage(context);
    currentCleanup = typeof cleanup === 'function' ? cleanup : null;

    setActiveNav(needsUnlock ? null : path);
  } catch (err) {
    console.error(err);
    outlet.innerHTML = `<div class="error-banner">頁面載入失敗，請重新整理或稍後再試。</div>`;
  }
}

export function initRouter(config) {
  defaultRoute = config.defaultRoute || '/summary';

  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}

export function getRouteTable() {
  return routeTable;
}
