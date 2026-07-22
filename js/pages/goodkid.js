import { listMembers, listGoodkidCounts, incrementGoodkidMark, decrementGoodkidMark } from '../services/db.js';
import { showToast } from '../ui/toast.js';
import { escapeHtml } from '../utils/format.js';

export async function mountPage() {
  const contentEl = document.getElementById('goodkid-content');
  const searchInput = document.getElementById('goodkid-search');

  let emojiOptions = [];
  let members = [];
  let countsByMember = {};

  async function loadAll() {
    contentEl.innerHTML = '<div class="state-block"><div class="spinner"></div>載入中…</div>';
    try {
      const [config, memberList, counts] = await Promise.all([
        fetch('./config/goodkid-emoji.json').then((r) => r.json()),
        listMembers(),
        listGoodkidCounts(),
      ]);
      emojiOptions = config.emojiOptions || [];
      members = memberList;
      countsByMember = counts;
      render();
    } catch (err) {
      contentEl.innerHTML = `<div class="error-banner">載入好寶寶系統失敗：${escapeHtml(err.message || '')}</div>`;
    }
  }

  function render() {
    const term = searchInput.value.trim().toLowerCase();
    const filtered = term ? members.filter((m) => m.name.toLowerCase().includes(term)) : members;

    if (!members.length) {
      contentEl.innerHTML = `
        <div class="list-empty">
          <div class="list-empty-title">尚無任何成員</div>
          <div class="list-empty-desc">在「成員管理」建立第一位成員</div>
        </div>`;
      return;
    }

    if (!filtered.length) {
      contentEl.innerHTML = `
        <div class="list-empty">
          <div class="list-empty-title">沒有符合的成員</div>
          <div class="list-empty-desc">換個關鍵字試試</div>
        </div>`;
      return;
    }

    contentEl.innerHTML = `
      <div class="goodkid-grid">
        ${filtered.map((member) => renderMemberCard(member)).join('')}
      </div>
    `;

    bindCardEvents();
  }

  function renderMemberCard(member) {
    const counts = countsByMember[member.id] || {};
    return `
      <div class="goodkid-member-card" data-member-id="${member.id}">
        <div class="goodkid-member-top">
          <div class="goodkid-member-name">${escapeHtml(member.name)}</div>
          <div class="goodkid-member-meta">${member.cardUID ? '卡號 ' + escapeHtml(member.cardUID) : '尚未綁定卡片'}</div>
        </div>
        <div class="goodkid-emoji-row">
          ${emojiOptions
            .map((opt) => {
              const count = counts[opt.emoji] || 0;
              return `
              <button type="button" class="goodkid-emoji-btn" data-emoji="${escapeHtml(opt.emoji)}" title="${escapeHtml(opt.label)}">
                ${count > 0 ? `<span class="goodkid-emoji-count">${count}</span>` : ''}
                ${count > 0 ? `<button type="button" class="goodkid-emoji-minus" data-emoji-minus="${escapeHtml(opt.emoji)}" title="移除一次">−</button>` : ''}
                <span class="goodkid-emoji-char">${opt.emoji}</span>
                <span class="goodkid-emoji-label">${escapeHtml(opt.label)}</span>
              </button>`;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  function bindCardEvents() {
    contentEl.querySelectorAll('.goodkid-member-card').forEach((card) => {
      const memberId = card.dataset.memberId;
      const member = members.find((m) => m.id === memberId);

      card.querySelectorAll('.goodkid-emoji-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          // The minus button is nested inside; let its own handler deal with it.
          if (e.target.closest('[data-emoji-minus]')) return;
          const emoji = btn.dataset.emoji;
          await mark(member, emoji, 1);
        });
      });

      card.querySelectorAll('[data-emoji-minus]').forEach((minusBtn) => {
        minusBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const emoji = minusBtn.dataset.emojiMinus;
          await mark(member, emoji, -1);
        });
      });
    });
  }

  async function mark(member, emoji, delta) {
    // Optimistic UI update so repeated clicks feel instant.
    const current = countsByMember[member.id] || {};
    const nextCount = Math.max(0, (current[emoji] || 0) + delta);
    countsByMember[member.id] = { ...current, [emoji]: nextCount };
    render();

    try {
      if (delta > 0) {
        await incrementGoodkidMark(member.id, member.name, emoji);
      } else {
        await decrementGoodkidMark(member.id, member.name, emoji);
      }
    } catch (err) {
      showToast(`更新失敗：${err.message || ''}`, 'danger');
      // reload to resync with server state on failure
      loadAll();
    }
  }

  searchInput.addEventListener('input', render);

  await loadAll();

  return () => {
    // no global listeners to clean up
  };
}
