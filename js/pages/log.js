import { listLogs } from '../services/db.js';
import { formatDateTime, escapeHtml } from '../utils/format.js';

const TYPE_META = {
  member_add: { label: '成員新增', badge: 'badge-success' },
  member_update: { label: '成員更新', badge: 'badge-info' },
  member_delete: { label: '成員刪除', badge: 'badge-danger' },
  session_add: { label: '場次新增', badge: 'badge-success' },
  session_update: { label: '場次更新', badge: 'badge-info' },
  session_delete: { label: '場次刪除', badge: 'badge-danger' },
  attendance_add: { label: '簽到', badge: 'badge-success' },
  attendance_delete: { label: '簽到刪除', badge: 'badge-danger' },
  goodkid_mark: { label: '好寶寶標記', badge: 'badge-success' },
  goodkid_unmark: { label: '好寶寶取消標記', badge: 'badge-warning' },
};

function matchesFilter(type, filter) {
  if (filter === 'all') return true;
  if (filter === 'attendance') return type.startsWith('attendance');
  if (filter === 'member') return type.startsWith('member');
  if (filter === 'session') return type.startsWith('session');
  if (filter === 'goodkid') return type.startsWith('goodkid');
  if (filter === 'delete') return type.endsWith('delete');
  return true;
}

export async function mountPage() {
  const listEl = document.getElementById('log-list');
  const refreshBtn = document.getElementById('log-refresh-btn');
  const chipHost = document.getElementById('log-filter-chips');

  let logs = [];
  let activeFilter = 'all';

  function render() {
    const filtered = logs.filter((l) => matchesFilter(l.type, activeFilter));

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="list-empty">
          <div class="list-empty-title">${logs.length ? '沒有符合的紀錄' : '尚無任何活動紀錄'}</div>
          <div class="list-empty-desc">${logs.length ? '換個篩選條件試試' : '進行點名、新增成員或場次後會顯示在這裡'}</div>
        </div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((l) => {
        const meta = TYPE_META[l.type] || { label: l.type, badge: 'badge-info' };
        return `
        <div class="list-row">
          <div class="list-row-main">
            <div class="list-row-name">${escapeHtml(l.message)}</div>
            <div class="list-row-meta">${formatDateTime(l.createdAt)}</div>
          </div>
          <span class="badge ${meta.badge}">${escapeHtml(meta.label)}</span>
        </div>`;
      })
      .join('');
  }

  async function refresh() {
    listEl.innerHTML = '<div class="state-block"><div class="spinner"></div>載入中…</div>';
    try {
      logs = await listLogs();
      render();
    } catch (err) {
      listEl.innerHTML = `<div class="error-banner">載入活動紀錄失敗：${escapeHtml(err.message || '')}</div>`;
    }
  }

  chipHost.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      activeFilter = chip.dataset.filter;
      chipHost.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
      render();
    });
  });

  refreshBtn.addEventListener('click', refresh);

  await refresh();

  return () => {
    // no global listeners to clean up
  };
}
