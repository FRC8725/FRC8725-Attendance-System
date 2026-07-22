import { isUnlocked, onLockStateChange, lock } from '../services/auth-gate.js';
import { icon as iconSpan } from '../utils/icon.js';

let navConfig = [];

function renderNav() {
  const host = document.getElementById('primary-nav');
  if (!host) return;

  host.innerHTML = navConfig
    .map((item) => {
      const lockBadge = item.protected ? iconSpan('lock', 'nav-lock-badge') : '';
      return `
        <a class="nav-link" href="#${item.route}" data-route="${item.route}" aria-label="${item.label}">
          ${iconSpan(item.icon)}
          <span class="nav-label">${item.label}</span>
          ${lockBadge}
        </a>`;
    })
    .join('');
}

function renderAccountHost() {
  const host = document.getElementById('account-host');
  if (!host) return;

  const generalUnlocked = isUnlocked('general');
  const scanUnlocked = isUnlocked('scan');

  host.innerHTML = `
    <div class="account-box">
      <div class="account-title">鎖定狀態</div>
      <div class="account-sub">一般管理：${generalUnlocked ? '已解鎖' : '未解鎖'}</div>
      <div class="account-sub">讀卡機：${scanUnlocked ? '已解鎖' : '未解鎖'}</div>
      <div style="display:flex; gap:6px; margin-top:10px; flex-wrap:wrap;">
        ${
          generalUnlocked
            ? `<button type="button" class="btn btn-ghost" id="lock-general-btn" style="flex:1; min-width:0;">
                ${iconSpan('lock')}<span>鎖定管理</span>
              </button>`
            : ''
        }
        ${
          scanUnlocked
            ? `<button type="button" class="btn btn-ghost" id="lock-scan-btn" style="flex:1; min-width:0;">
                ${iconSpan('lock')}<span>鎖定讀卡機</span>
              </button>`
            : ''
        }
      </div>
    </div>
  `;

  document.getElementById('lock-general-btn')?.addEventListener('click', () => lock('general'));
  document.getElementById('lock-scan-btn')?.addEventListener('click', () => lock('scan'));
}

export function initShell(config) {
  navConfig = config.nav || [];

  const brandMark = document.getElementById('brand-mark');
  const brandName = document.getElementById('brand-name');
  const brandSub = document.getElementById('brand-sub');
  if (brandMark && config.brand?.logo) {
    brandMark.src = config.brand.logo;
    brandMark.alt = `${config.brand?.name || ''} 隊徽`.trim();
  }
  if (brandName) brandName.textContent = config.brand?.name || '點名系統';
  if (brandSub) brandSub.textContent = config.brand?.subtitle || '';

  renderNav();
  renderAccountHost();

  onLockStateChange(() => {
    renderAccountHost();
  });
}

export function setActiveNav(path) {
  const links = document.querySelectorAll('.nav-link');
  links.forEach((link) => {
    link.classList.toggle('is-active', link.dataset.route === path);
  });
}
