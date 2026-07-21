import { listSessions, listMembers, listAttendanceForSession, listAllAttendance } from '../services/db.js';
import { formatTime, isSameDay, escapeHtml } from '../utils/format.js';

export async function mountPage() {
  const modeBtnSession = document.getElementById('mode-btn-session');
  const modeBtnMember = document.getElementById('mode-btn-member');
  const leftCard = document.getElementById('summary-left-card');
  const mainCard = document.getElementById('summary-main-card');
  const tilesEl = document.getElementById('summary-tiles');

  const config = await fetch('./config/app-config.json').then((r) => r.json());

  let mode = 'session'; // 'session' | 'member'
  let sessions = [];
  let members = [];
  let allAttendance = [];
  let selectedSessionId = null;
  let selectedMemberId = null;

  /* ===================== shared helpers ===================== */

  function tileColorClass(color) {
    return `color-${color || 'info'}`;
  }

  function attendanceCountForSession(sessionId) {
    return allAttendance.filter((a) => a.sessionId === sessionId).length;
  }

  function attendanceRecordsForMember(memberId) {
    return allAttendance.filter((a) => a.memberId === memberId);
  }

  function renderTiles() {
    const today = new Date();
    const todayCheckins = allAttendance.filter((a) => isSameDay(a.checkedInAt, today)).length;

    let selectionRate = '—';
    if (mode === 'session' && selectedSessionId && members.length) {
      const count = attendanceCountForSession(selectedSessionId);
      selectionRate = `${Math.round((count / members.length) * 100)}%`;
    } else if (mode === 'member' && selectedMemberId && sessions.length) {
      const count = attendanceRecordsForMember(selectedMemberId).length;
      selectionRate = `${Math.round((count / sessions.length) * 100)}%`;
    }

    const values = {
      totalSessions: sessions.length,
      totalMembers: members.length,
      todayCheckins,
      selectionRate,
    };

    tilesEl.innerHTML = (config.summaryTiles || [])
      .map(
        (tile) => `
        <div class="tile">
          <div class="tile-value ${tileColorClass(tile.color)}">${values[tile.key] ?? '—'}</div>
          <div class="tile-label">${escapeHtml(tile.label)}</div>
        </div>`
      )
      .join('');
  }

  /* ===================== mode: 依場次檢視 ===================== */

  function renderSessionLeftCard() {
    leftCard.innerHTML = `
      <h2 class="card-section-title">場次</h2>
      <div class="search-box" style="margin-bottom:12px;">
        <span class="ico-svg" style="--icon-url:url('images/icons/search.svg'); mask-image: var(--icon-url); -webkit-mask-image: var(--icon-url);"></span>
        <input class="input" id="summary-session-search" placeholder="搜尋場次…" />
      </div>
      <div class="list" id="summary-session-list"></div>
    `;
    document.getElementById('summary-session-search').addEventListener('input', renderSessionList);
    renderSessionList();
  }

  function renderSessionList() {
    const listEl = document.getElementById('summary-session-list');
    if (!listEl) return;
    const term = document.getElementById('summary-session-search').value.trim().toLowerCase();
    const filtered = term
      ? sessions.filter((s) => s.name.toLowerCase().includes(term) || (s.date || '').includes(term))
      : sessions;

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="list-empty">
          <div class="list-empty-title">${sessions.length ? '沒有符合的場次' : '尚無任何場次'}</div>
          <div class="list-empty-desc">${sessions.length ? '換個關鍵字試試' : '在「場次管理」建立第一個場次'}</div>
        </div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((s) => {
        const count = attendanceCountForSession(s.id);
        return `
        <div class="card-inner session-card ${s.id === selectedSessionId ? 'is-active' : ''}" data-id="${s.id}" style="border:1px solid var(--border-soft);">
          <div class="session-card-top">
            <span class="session-card-name">${escapeHtml(s.name)}</span>
            <span class="badge badge-info">${count} 人</span>
          </div>
          <span class="session-card-date">${escapeHtml(s.date || '未設定日期')}</span>
        </div>`;
      })
      .join('');

    listEl.querySelectorAll('.session-card').forEach((el) => {
      el.addEventListener('click', () => selectSession(el.dataset.id));
    });
  }

  async function selectSession(sessionId) {
    selectedSessionId = sessionId;
    renderSessionList();
    renderTiles();

    const session = sessions.find((s) => s.id === sessionId);
    mainCard.innerHTML = `
      <h2 class="card-section-title">${session ? escapeHtml(session.name) : '請選擇場次'}</h2>
      <div class="list" id="summary-attendance-list">
        <div class="state-block"><div class="spinner"></div>載入中…</div>
      </div>
    `;

    const attendanceListEl = document.getElementById('summary-attendance-list');
    try {
      const records = await listAttendanceForSession(sessionId);
      if (!records.length) {
        attendanceListEl.innerHTML = `
          <div class="list-empty">
            <div class="list-empty-title">此場次尚無簽到紀錄</div>
            <div class="list-empty-desc">到「點名讀卡」開始感應</div>
          </div>`;
        return;
      }
      attendanceListEl.innerHTML = records
        .map(
          (r) => `
          <div class="list-row">
            <div class="list-row-main">
              <div class="list-row-name">${escapeHtml(r.memberName)}</div>
              <div class="list-row-meta">卡號 ${escapeHtml(r.cardUID || '—')}</div>
            </div>
            <span class="badge badge-success">${formatTime(r.checkedInAt)}</span>
          </div>`
        )
        .join('');
    } catch (err) {
      attendanceListEl.innerHTML = `<div class="error-banner">載入出席名單失敗：${escapeHtml(err.message || '')}</div>`;
    }
  }

  function renderSessionMainPlaceholder() {
    mainCard.innerHTML = `
      <h2 class="card-section-title">請選擇場次</h2>
      <div class="list-empty">
        <div class="list-empty-title">尚未選擇場次</div>
        <div class="list-empty-desc">從左側選擇一個場次以檢視出席名單</div>
      </div>
    `;
  }

  /* ===================== mode: 依成員檢視 ===================== */

  function renderMemberLeftCard() {
    leftCard.innerHTML = `
      <h2 class="card-section-title">成員</h2>
      <div class="search-box" style="margin-bottom:12px;">
        <span class="ico-svg" style="--icon-url:url('images/icons/search.svg'); mask-image: var(--icon-url); -webkit-mask-image: var(--icon-url);"></span>
        <input class="input" id="summary-member-search" placeholder="搜尋成員…" />
      </div>
      <div class="list" id="summary-member-list"></div>
    `;
    document.getElementById('summary-member-search').addEventListener('input', renderMemberList);
    renderMemberList();
  }

  function renderMemberList() {
    const listEl = document.getElementById('summary-member-list');
    if (!listEl) return;
    const term = document.getElementById('summary-member-search').value.trim().toLowerCase();
    const filtered = term ? members.filter((m) => m.name.toLowerCase().includes(term)) : members;

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="list-empty">
          <div class="list-empty-title">${members.length ? '沒有符合的成員' : '尚無任何成員'}</div>
          <div class="list-empty-desc">${members.length ? '換個關鍵字試試' : '在「成員管理」建立第一位成員'}</div>
        </div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((m) => {
        const count = attendanceRecordsForMember(m.id).length;
        return `
        <div class="card-inner session-card ${m.id === selectedMemberId ? 'is-active' : ''}" data-id="${m.id}" style="border:1px solid var(--border-soft);">
          <div class="session-card-top">
            <span class="session-card-name">${escapeHtml(m.name)}</span>
            <span class="badge badge-info">${count}/${sessions.length} 場</span>
          </div>
          <span class="session-card-date">${m.cardUID ? '卡號 ' + escapeHtml(m.cardUID) : '尚未綁定卡片'}</span>
        </div>`;
      })
      .join('');

    listEl.querySelectorAll('.session-card').forEach((el) => {
      el.addEventListener('click', () => selectMember(el.dataset.id));
    });
  }

  function selectMember(memberId) {
    selectedMemberId = memberId;
    renderMemberList();
    renderTiles();

    const member = members.find((m) => m.id === memberId);
    const attended = attendanceRecordsForMember(memberId);
    const attendedBySession = new Map(attended.map((a) => [a.sessionId, a]));

    mainCard.innerHTML = `
      <h2 class="card-section-title">${member ? escapeHtml(member.name) : '請選擇成員'}</h2>
      <div class="list" id="summary-member-detail-list"></div>
    `;

    const detailListEl = document.getElementById('summary-member-detail-list');
    if (!sessions.length) {
      detailListEl.innerHTML = `
        <div class="list-empty">
          <div class="list-empty-title">尚無任何場次</div>
          <div class="list-empty-desc">在「場次管理」建立第一個場次</div>
        </div>`;
      return;
    }

    detailListEl.innerHTML = sessions
      .map((s) => {
        const record = attendedBySession.get(s.id);
        const statusBadge = record
          ? `<span class="badge badge-success">${formatTime(record.checkedInAt)}</span>`
          : `<span class="badge badge-warning">未出席</span>`;
        return `
        <div class="list-row">
          <div class="list-row-main">
            <div class="list-row-name">${escapeHtml(s.name)}</div>
            <div class="list-row-meta">${escapeHtml(s.date || '未設定日期')}</div>
          </div>
          ${statusBadge}
        </div>`;
      })
      .join('');
  }

  function renderMemberMainPlaceholder() {
    mainCard.innerHTML = `
      <h2 class="card-section-title">請選擇成員</h2>
      <div class="list-empty">
        <div class="list-empty-title">尚未選擇成員</div>
        <div class="list-empty-desc">從左側選擇一位成員，檢視其在各場次的出席狀況</div>
      </div>
    `;
  }

  /* ===================== mode switching ===================== */

  function setMode(nextMode) {
    if (mode === nextMode) return;
    mode = nextMode;
    modeBtnSession.classList.toggle('is-active', mode === 'session');
    modeBtnMember.classList.toggle('is-active', mode === 'member');

    if (mode === 'session') {
      renderSessionLeftCard();
      selectedSessionId ? selectSession(selectedSessionId) : renderSessionMainPlaceholder();
    } else {
      renderMemberLeftCard();
      selectedMemberId ? selectMember(selectedMemberId) : renderMemberMainPlaceholder();
    }
    renderTiles();
  }

  modeBtnSession.addEventListener('click', () => setMode('session'));
  modeBtnMember.addEventListener('click', () => setMode('member'));

  /* ===================== initial load ===================== */

  async function loadAll() {
    leftCard.innerHTML = '<div class="state-block"><div class="spinner"></div>載入中…</div>';
    try {
      [sessions, members, allAttendance] = await Promise.all([
        listSessions(),
        listMembers(),
        listAllAttendance(),
      ]);
      renderTiles();
      renderSessionLeftCard();
      if (sessions.length) {
        await selectSession(sessions[0].id);
      } else {
        renderSessionMainPlaceholder();
      }
    } catch (err) {
      leftCard.innerHTML = `<div class="error-banner">載入資料失敗：${escapeHtml(err.message || '')}</div>`;
    }
  }

  await loadAll();

  return () => {
    // no global listeners to clean up
  };
}
