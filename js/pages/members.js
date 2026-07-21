import { listMembers, addMember, updateMember, deleteMember } from '../services/db.js';
import { openModal, confirmModal } from '../ui/modal.js';
import { showToast } from '../ui/toast.js';
import { icon } from '../utils/icon.js';
import { escapeHtml } from '../utils/format.js';

export async function mountPage() {
  const listEl = document.getElementById('member-list');
  const addBtn = document.getElementById('add-member-btn');
  const searchInput = document.getElementById('member-search');

  let allMembers = [];

  async function refresh() {
    listEl.innerHTML = '<div class="state-block"><div class="spinner"></div>載入中…</div>';
    try {
      allMembers = await listMembers();
      renderFiltered();
    } catch (err) {
      listEl.innerHTML = `<div class="error-banner">載入成員失敗：${escapeHtml(err.message || '')}</div>`;
    }
  }

  function renderFiltered() {
    const term = searchInput.value.trim().toLowerCase();
    const filtered = term
      ? allMembers.filter(
          (m) =>
            m.name.toLowerCase().includes(term) ||
            (m.cardUID || '').toLowerCase().includes(term)
        )
      : allMembers;
    renderList(filtered);
  }

  function renderList(members) {
    if (!members.length) {
      listEl.innerHTML = `
        <div class="list-empty">
          <div class="list-empty-title">${allMembers.length ? '沒有符合的成員' : '尚未登記任何成員'}</div>
          <div class="list-empty-desc">${allMembers.length ? '換個關鍵字試試' : '掃描未登記卡片時也會自動建立成員'}</div>
        </div>`;
      return;
    }

    listEl.innerHTML = members
      .map(
        (m) => `
        <div class="list-row" data-id="${m.id}">
          <div class="list-row-main">
            <div class="list-row-name">${escapeHtml(m.name)}</div>
            <div class="list-row-meta">${m.cardUID ? '卡號 ' + escapeHtml(m.cardUID) : '尚未綁定卡片'}</div>
          </div>
          <div class="list-row-actions">
            <button type="button" class="btn btn-icon btn-ghost" data-action="edit" title="編輯">${icon('edit')}</button>
            <button type="button" class="btn btn-icon btn-ghost" data-action="delete" title="刪除">${icon('trash')}</button>
          </div>
        </div>`
      )
      .join('');

    listEl.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.closest('.list-row').dataset.id;
        openMemberForm(allMembers.find((m) => m.id === id));
      });
    });

    listEl.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.closest('.list-row').dataset.id;
        const member = allMembers.find((m) => m.id === id);
        const ok = await confirmModal({
          title: '刪除成員',
          message: `確定要刪除成員「${escapeHtml(member.name)}」嗎？此操作無法復原，已產生的點名紀錄不會被刪除。`,
        });
        if (!ok) return;
        try {
          await deleteMember(id);
          showToast('已刪除成員', 'success');
          refresh();
        } catch (err) {
          showToast(`刪除失敗：${err.message || ''}`, 'danger');
        }
      });
    });
  }

  function openMemberForm(existing) {
    const isEdit = Boolean(existing);
    openModal({
      title: isEdit ? '編輯成員' : '新增成員',
      bodyHtml: `
        <div class="field">
          <label class="field-label" for="member-name">姓名</label>
          <input class="input" id="member-name" value="${isEdit ? escapeHtml(existing.name) : ''}" placeholder="例如：王小明" />
        </div>
        <div class="field">
          <label class="field-label" for="member-uid">學生證卡號 UID（選填）</label>
          <input class="input" id="member-uid" value="${isEdit ? escapeHtml(existing.cardUID || '') : ''}" placeholder="以 NFC 感應學生證後取得的序號" />
        </div>
        <div class="field">
          <label class="field-label" for="member-note">備註（選填）</label>
          <input class="input" id="member-note" value="${isEdit ? escapeHtml(existing.note || '') : ''}" />
        </div>
      `,
      buttons: [
        { label: '取消', className: 'btn-ghost', onClick: (c) => c() },
        {
          label: isEdit ? '儲存變更' : '建立成員',
          className: 'btn-primary',
          onClick: async (c) => {
            const name = document.getElementById('member-name').value.trim();
            const cardUID = document.getElementById('member-uid').value.trim();
            const note = document.getElementById('member-note').value.trim();
            if (!name) {
              showToast('請輸入姓名', 'warning');
              return;
            }
            try {
              if (isEdit) {
                await updateMember(existing.id, { name, cardUID: cardUID || null, note });
                showToast('已更新成員', 'success');
              } else {
                await addMember({ name, cardUID, note });
                showToast('已建立成員', 'success');
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

  addBtn.addEventListener('click', () => openMemberForm(null));
  searchInput.addEventListener('input', renderFiltered);

  await refresh();

  return () => {
    // controls are removed with the fragment; nothing global to unbind
  };
}
