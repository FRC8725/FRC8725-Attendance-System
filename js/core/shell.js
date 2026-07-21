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

  const unlocked = isUnlocked();
  host.innerHTML = `
    <div class="account-box">
      <div class="account-title">讀取介面狀態</div>
      <div class="account-sub">${unlocked ? '已解鎖・可進行點名操作' : '未解鎖・僅能檢視資料匯總'}</div>
      ${
        unlocked
          ? `<button type="button" class="btn btn-ghost" id="lock-again-btn" style="margin-top:10px;">
              ${iconSpan('lock')}<span>重新鎖定</span>
            </button>`
          : ''
      }
    </div>
  `;

  const btn = document.getElementById('lock-again-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      lock();
    });
  }
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
