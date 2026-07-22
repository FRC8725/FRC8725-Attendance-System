import { listSessions, listMembers, listAllAttendance } from '../services/db.js';
import { showToast } from '../ui/toast.js';
import { todayDateInputValue } from '../utils/format.js';

function toMillis(timestamp) {
  if (!timestamp) return 0;
  return typeof timestamp.toMillis === 'function' ? timestamp.toMillis() : new Date(timestamp).getTime();
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function daysAgoDateInputValue(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function mountPage() {
  const startInput = document.getElementById('export-start-date');
  const endInput = document.getElementById('export-end-date');
  const previewText = document.getElementById('export-preview-text');
  const exportBtn = document.getElementById('export-csv-btn');

  startInput.value = daysAgoDateInputValue(7);
  endInput.value = todayDateInputValue();

  let sessions = [];
  let members = [];
  let allAttendance = [];

  async function loadData() {
    previewText.textContent = '載入資料中…';
    try {
      [sessions, members, allAttendance] = await Promise.all([
        listSessions(),
        listMembers(),
        listAllAttendance(),
      ]);
      updatePreview();
    } catch (err) {
      previewText.textContent = `載入資料失敗：${err.message || ''}`;
    }
  }

  function getFilteredRecords() {
    const startMs = startInput.value ? new Date(`${startInput.value}T00:00:00`).getTime() : -Infinity;
    const endMs = endInput.value ? new Date(`${endInput.value}T23:59:59.999`).getTime() : Infinity;
    return allAttendance.filter((a) => {
      const ms = toMillis(a.checkedInAt);
      return ms >= startMs && ms <= endMs;
    });
  }

  function updatePreview() {
    const filtered = getFilteredRecords();
    previewText.textContent = `此範圍內共有 ${filtered.length} 筆簽到紀錄可匯出`;
  }

  function buildCsv(records) {
    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    const memberById = new Map(members.map((m) => [m.id, m]));

    const header = ['場次名稱', '場次日期', '成員姓名', '卡號', '簽到時間'];
    const rows = records
      .slice()
      .sort((a, b) => toMillis(a.checkedInAt) - toMillis(b.checkedInAt))
      .map((r) => {
        const session = sessionById.get(r.sessionId);
        const member = memberById.get(r.memberId);
        const checkedInDate = r.checkedInAt?.toDate ? r.checkedInAt.toDate() : new Date(toMillis(r.checkedInAt));
        return [
          session?.name || '',
          session?.date || '',
          member?.name || r.memberName || '',
          r.cardUID || '',
          Number.isNaN(checkedInDate.getTime()) ? '' : checkedInDate.toLocaleString('zh-TW', { hour12: false }),
        ];
      });

    const lines = [header, ...rows].map((row) => row.map(csvEscape).join(','));
    // 加上 UTF-8 BOM，確保用 Excel 開啟時中文字不會變亂碼
    return '\uFEFF' + lines.join('\r\n');
  }

  function downloadCsv() {
    const filtered = getFilteredRecords();
    if (!filtered.length) {
      showToast('此範圍內沒有可匯出的簽到紀錄', 'warning');
      return;
    }

    const csv = buildCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_export_${startInput.value}_to_${endInput.value}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showToast(`已匯出 ${filtered.length} 筆紀錄`, 'success');
  }

  startInput.addEventListener('change', updatePreview);
  endInput.addEventListener('change', updatePreview);
  exportBtn.addEventListener('click', downloadCsv);

  await loadData();

  return () => {
    // no global listeners to clean up
  };
}
