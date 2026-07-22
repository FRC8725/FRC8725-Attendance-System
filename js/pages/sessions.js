import {
  listSessions,
  addSession,
  updateSession,
  deleteSession,
  listAttendanceForSession,
  deleteAttendance,
} from '../services/db.js';
import { openModal, confirmModal } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { icon } from '../utils/icon.js';
import { todayDateInputValue, formatTime, escapeHtml } from '../utils/format.js';

export async function mountPage() {
  const listEl = document.getElementById('session-list');
  const addBtn = document.getElementById('add-session-btn');
  const attendeesCard = document.getElementById('session-attendees-card');
  const attendeesTitle = document.getElementById('session-attendees-title');
  const attendeesList = document.getElementById('session-attendees-list');

  let sessions = [];
  let selectedSessionId = null;

  async function refresh() {
    listEl.innerHTML = '<div class="state-block"><div class="spinner"></div>載入中…</div>';
    try {
      sessions = await listSessions();
      renderList();
      if (selectedSessionId && !sessions.some((s) => s.id === selectedSessionId)) {
        // the previously selected session was deleted
        selectedSessionId = null;
        attendeesCard.style.display = 'none';
      } else if (selectedSessionId) {
        await refreshAttendees();
      }
    } catch (err) {
      listEl.innerHTML = `<div class="error-banner">載入場次失敗：${escapeHtml(err.message || '')}</div>`;
    }
  }

  function renderList() {
    if (!sessions.length) {
      listEl.innerHTML = `
        <div class="list-empty">
          <div class="list-empty-title">尚未建立任何場次</div>
          <div class="list-empty-desc">點右上角「新增場次」開始第一次點名</div>
        </div>`;
      return;
    }

    listEl.innerHTML = sessions
      .map(
        (s) => `
        <div class="list-row ${s.id === selectedSessionId ? 'is-selected' : ''}" data-id="${s.id}" style="cursor:pointer;">
          <div class="list-row-main">
            <div class="list-row-name">${escapeHtml(s.name)}</div>
            <div class="list-row-meta">${escapeHtml(s.date || '')}${s.note ? ' · ' + escapeHtml(s.note) : ''}</div>
          </div>
          <div class="list-row-actions">
            <button type="button" class="btn btn-icon btn-ghost" data-action="edit" title="編輯">${icon('edit')}</button>
            <button type="button" class="btn btn-icon btn-ghost" data-action="delete" title="刪除">${icon('trash')}</button>
          </div>
        </div>`
      )
      .join('');

    listEl.querySelectorAll('.list-row').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return; // let action buttons handle themselves
        selectSession(row.dataset.id);
      });
    });

    listEl.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.closest('.list-row').dataset.id;
        openSessionForm(sessions.find((s) => s.id === id));
      });
    });

    listEl.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.closest('.list-row').dataset.id;
        const session = sessions.find((s) => s.id === id);
        const ok = await confirmModal({
          title: '刪除場次',
          message: `確定要刪除場次「${escapeHtml(session.name)}」嗎？此操作無法復原，該場次的點名紀錄仍會保留在資料庫中，但無法再由此清單管理。`,
        });
        if (!ok) return;
        try {
          await deleteSession(id, session.name);
          showToast('已刪除場次', 'success');
          refresh();
        } catch (err) {
          showToast(`刪除失敗：${err.message || ''}`, 'danger');
        }
      });
    });
  }

  function selectSession(sessionId) {
    selectedSessionId = sessionId;
    renderList();
    refreshAttendees();
  }

  async function refreshAttendees() {
    const session = sessions.find((s) => s.id === selectedSessionId);
    if (!session) {
      attendeesCard.style.display = 'none';
      return;
    }

    attendeesCard.style.display = 'block';
    attendeesTitle.textContent = `已簽到人員・${session.name}`;
    attendeesList.innerHTML = '<div class="state-block"><div class="spinner"></div>載入中…</div>';

    try {
      const records = await listAttendanceForSession(selectedSessionId);
      renderAttendees(records);
    } catch (err) {
      attendeesList.innerHTML = `<div class="error-banner">載入簽到名單失敗：${escapeHtml(err.message || '')}</div>`;
    }
  }

  function renderAttendees(records) {
    if (!records.length) {
      attendeesList.innerHTML = `
        <div class="list-empty">
          <div class="list-empty-title">此場次尚無簽到紀錄</div>
          <div class="list-empty-desc">到「點名讀卡」開始感應</div>
        </div>`;
      return;
    }

    attendeesList.innerHTML = records
      .map(
        (r) => `
        <div class="list-row" data-attendance-id="${r.id}">
          <div class="list-row-main">
            <div class="list-row-name">${escapeHtml(r.memberName)}</div>
            <div class="list-row-meta">簽到時間 ${formatTime(r.checkedInAt)}${r.cardUID ? ' · 卡號 ' + escapeHtml(r.cardUID) : ''}</div>
          </div>
          <div class="list-row-actions">
            <button type="button" class="btn btn-icon btn-ghost" data-action="delete-attendance" title="刪除這筆簽到紀錄">${icon('trash')}</button>
          </div>
        </div>`
      )
      .join('');

    attendeesList.querySelectorAll('[data-action="delete-attendance"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('.list-row');
        const attendanceId = row.dataset.attendanceId;
        const name = row.querySelector('.list-row-name').textContent;
        const ok = await confirmModal({
          title: '刪除簽到紀錄',
          message: `確定要刪除「${escapeHtml(name)}」在此場次的簽到紀錄嗎？此操作無法復原。`,
        });
        if (!ok) return;
        try {
          const session = sessions.find((s) => s.id === selectedSessionId);
          await deleteAttendance(attendanceId, name, session?.name);
          showToast('已刪除簽到紀錄', 'success');
          refreshAttendees();
        } catch (err) {
          showToast(`刪除失敗：${err.message || ''}`, 'danger');
        }
      });
    });
  }

  function openSessionForm(existing) {
    const isEdit = Boolean(existing);
    openModal({
      title: isEdit ? '編輯場次' : '新增場次',
      bodyHtml: `
        <div class="field">
          <label class="field-label" for="session-name">場次名稱</label>
          <input class="input" id="session-name" value="${isEdit ? escapeHtml(existing.name) : ''}" placeholder="例如：7/20 第一梯次工作坊" />
        </div>
        <div class="field">
          <label class="field-label" for="session-date">日期</label>
          <input class="input" id="session-date" type="date" value="${isEdit ? existing.date || '' : todayDateInputValue()}" />
        </div>
        <div class="field">
          <label class="field-label" for="session-note">備註（選填）</label>
          <input class="input" id="session-note" value="${isEdit ? escapeHtml(existing.note || '') : ''}" placeholder="例如：地點、講師" />
        </div>
      `,
      buttons: [
        { label: '取消', className: 'btn-ghost', onClick: (c) => c() },
        {
          label: isEdit ? '儲存變更' : '建立場次',
          className: 'btn-primary',
          onClick: async (c) => {
            const name = document.getElementById('session-name').value.trim();
            const date = document.getElementById('session-date').value;
            const note = document.getElementById('session-note').value.trim();
            if (!name) {
              showToast('請輸入場次名稱', 'warning');
              return;
            }
            try {
              if (isEdit) {
                await updateSession(existing.id, { name, date, note });
                showToast('已更新場次', 'success');
              } else {
                await addSession({ name, date, note });
                showToast('已建立場次', 'success');
              }
              c();
              refresh();
            } catch (err) {
              showToast(`儲存失敗：${err.message || ''}`, 'danger');
            }
          },
        },
      ],
    });
  }

  addBtn.addEventListener('click', () => openSessionForm(null));

  await refresh();

  return () => {
    // no global listeners to clean up
  };
}
