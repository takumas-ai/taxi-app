// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// データエクスポートユーティリティ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const HEADERS = ["日付","曜日","総売上","現金","カード","アプリ","高速代","乗車回数","総走行距離","実車距離","勤務時間","休憩時間","実車率(%)","時間単価","メモ"];
const DAYS_JA = ["日","月","火","水","木","金","土"];

function occ(r) {
  return r.total_distance > 0 ? Math.round(((r.occupied_distance||0)/r.total_distance)*100) : 0;
}
function hourly(r) {
  return r.work_hours > 0 ? Math.round((r.gross_sales||0)/r.work_hours) : 0;
}

function reportToRow(r) {
  const dow = DAYS_JA[new Date(r.date).getDay()];
  return [
    r.date,
    dow,
    r.gross_sales   || 0,
    r.cash_sales    || 0,
    r.card_sales    || 0,
    r.app_sales     || 0,
    r.highway_fee   || 0,
    r.ride_count    || 0,
    r.total_distance|| 0,
    r.occupied_distance || 0,
    r.work_hours    || 0,
    r.break_hours   || 0,
    occ(r),
    hourly(r),
    (r.trouble_note || r.ai_comment || "").replace(/,/g,"、").replace(/\n/g," "),
  ];
}

// CSV ダウンロード
export function downloadCSV(reports, label) {
  const rows = [HEADERS, ...reports.map(reportToRow)];
  const csv  = rows.map(r => r.join(",")).join("\n");
  const bom  = "﻿"; // Excel用BOM
  const blob = new Blob([bom + csv], { type:"text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `タクロー_${label}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// 印刷用HTML → PDF（ブラウザの印刷ダイアログ）
export function printAsPDF(reports, label, user) {
  const sorted = [...reports].sort((a,b) => a.date.localeCompare(b.date));
  const total  = sorted.reduce((s,r) => s + (r.gross_sales||0), 0);
  const avgSales = sorted.length ? Math.round(total / sorted.length) : 0;

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>タクロー — ${label}</title>
<style>
  body { font-family: 'Hiragino Sans', sans-serif; font-size:11px; color:#111; margin:20px; }
  h1   { font-size:16px; margin-bottom:4px; }
  .sub { color:#666; font-size:11px; margin-bottom:16px; }
  .summary { display:flex; gap:16px; margin-bottom:16px; }
  .kpi { background:#f5f5f5; border-radius:6px; padding:8px 12px; text-align:center; }
  .kpi-val { font-size:18px; font-weight:900; }
  .kpi-lbl { font-size:9px; color:#666; }
  table { width:100%; border-collapse:collapse; font-size:10px; }
  th    { background:#1E2D45; color:#fff; padding:5px 6px; text-align:right; }
  th:first-child { text-align:left; }
  td    { padding:4px 6px; border-bottom:1px solid #ddd; text-align:right; }
  td:first-child { text-align:left; }
  tr:nth-child(even) { background:#f9f9f9; }
  .good { color:#10B981; }
  .warn { color:#F97316; }
  @media print { body { margin:0; } }
</style>
</head>
<body>
<h1>🦉 タクロー — ${label}</h1>
<div class="sub">${user?.name || ""} / 出力日: ${new Date().toLocaleDateString("ja-JP")}</div>
<div class="summary">
  <div class="kpi"><div class="kpi-val">${total.toLocaleString()}</div><div class="kpi-lbl">総売上（円）</div></div>
  <div class="kpi"><div class="kpi-val">${sorted.length}</div><div class="kpi-lbl">記録日数</div></div>
  <div class="kpi"><div class="kpi-val">${avgSales.toLocaleString()}</div><div class="kpi-lbl">平均売上（円）</div></div>
</div>
<table>
<thead><tr>
  <th>日付</th><th>曜</th><th>総売上</th><th>現金</th><th>カード</th><th>乗車回数</th><th>実車率</th><th>時間単価</th>
</tr></thead>
<tbody>
${sorted.map(r => {
  const o = occ(r), h = hourly(r);
  return `<tr>
    <td>${r.date}</td>
    <td>${DAYS_JA[new Date(r.date).getDay()]}</td>
    <td class="${r.gross_sales>=65000?'good':r.gross_sales>=50000?'':'warn'}">${(r.gross_sales||0).toLocaleString()}</td>
    <td>${(r.cash_sales||0).toLocaleString()}</td>
    <td>${(r.card_sales||0).toLocaleString()}</td>
    <td>${r.ride_count||0}</td>
    <td>${o}%</td>
    <td>${h.toLocaleString()}</td>
  </tr>`;
}).join("")}
</tbody>
</table>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}
