import { listSessions, listMembers, listAllAttendance } from '../services/db.js';
import { escapeHtml } from '../utils/format.js';

function toMillis(timestamp) {
  if (!timestamp) return 0;
  return typeof timestamp.toMillis === 'function' ? timestamp.toMillis() : new Date(timestamp).getTime();
}

function sortSessionsChronological(sessions) {
  return [...sessions].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    return toMillis(a.createdAt) - toMillis(b.createdAt);
  });
}

function pickStreakEmoji(streak, rules) {
  const sorted = [...rules].sort((a, b) => b.minStreak - a.minStreak);
  return sorted.find((r) => streak >= r.minStreak) || null;
}

function pickAbsenceEmoji(absentStreak, rules) {
  const sorted = [...rules].sort((a, b) => b.minAbsentStreak - a.minAbsentStreak);
  return sorted.find((r) => absentStreak >= r.minAbsentStreak) || null;
}

export async function mountPage() {
  const card = document.getElementById('goodkid-card');

  try {
    const [emojiConfig, sessions, members, allAttendance] = await Promise.all([
      fetch('./config/goodkid-emoji.json').then((r) => r.json()),
      listSessions(),
      listMembers(),
      listAllAttendance(),
    ]);

    const sortedSessions = sortSessionsChronological(sessions);

    if (!members.length) {
      card.innerHTML = `
        <div class="list-empty">
          <div class="list-empty-title">尚無任何成員</div>
          <div class="list-empty-desc">在「成員管理」建立第一位成員</div>
        </div>`;
      return () => {};
    }

    if (!sortedSessions.length) {
      card.innerHTML = `
        <div class="list-empty">
          <div class="list-empty-title">尚無任何場次</div>
          <div class="list-empty-desc">在「場次管理」建立第一個場次後即可產生紀錄</div>
        </div>`;
      return () => {};
    }

    const attendanceByMember = new Map();
    allAttendance.forEach((a) => {
      if (!attendanceByMember.has(a.memberId)) attendanceByMember.set(a.memberId, new Set());
      attendanceByMember.get(a.memberId).add(a.sessionId);
    });

    const cards = members.map((member) => {
      const attendedIds = attendanceByMember.get(member.id) || new Set();
      const attendedBooleans = sortedSessions.map((s) => attendedIds.has(s.id));
      const wasPresentLast = attendedBooleans[attendedBooleans.length - 1];

      let streak = 0;
      for (let i = attendedBooleans.length - 1; i >= 0; i--) {
        if (attendedBooleans[i] === wasPresentLast) streak += 1;
        else break;
      }
      const currentStreak = wasPresentLast ? streak : 0;
      const absentStreak = wasPresentLast ? 0 : streak;

      let matched = null;
      if (wasPresentLast) {
        matched = pickStreakEmoji(currentStreak, emojiConfig.streakRules || []);
      } else {
        matched = pickAbsenceEmoji(absentStreak, emojiConfig.absenceRules || []);
      }

      const emoji = matched ? matched.emoji : emojiConfig.noRecordEmoji || '🆕';
      const label = matched ? matched.label : emojiConfig.noRecordLabel || '尚無出席紀錄';
      const streakForSort = wasPresentLast ? currentStreak : -absentStreak;

      return { member, emoji, label, streakForSort };
    });

    cards.sort((a, b) => b.streakForSort - a.streakForSort);

    card.innerHTML = `
      <h2 class="card-section-title">目前共 ${sortedSessions.length} 場次・最新場次：${escapeHtml(
        sortedSessions[sortedSessions.length - 1].name
      )}</h2>
      <div class="goodkid-grid">
        ${cards
          .map(
            (c) => `
          <div class="goodkid-card">
            <div class="goodkid-emoji">${c.emoji}</div>
            <div class="goodkid-name">${escapeHtml(c.member.name)}</div>
            <div class="goodkid-status-label">${escapeHtml(c.label)}</div>
          </div>`
          )
          .join('')}
      </div>
    `;
  } catch (err) {
    card.innerHTML = `<div class="error-banner">載入好寶寶紀錄失敗：${escapeHtml(err.message || '')}</div>`;
  }

  return () => {
    // no global listeners to clean up
  };
}
