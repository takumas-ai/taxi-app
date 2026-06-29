import { useState, useMemo } from "react";
import { C, fmt, dow, loadS, saveS, getClosingPeriod, calcTake } from "../lib/constants";

const EXPENSE_DEFAULT = [{ label: "", amount: "" }];

export default function SimulationScreen({ reports = [], user, onBack }) {
  // 本設定から初期値を取得（シミュレーション専用として独立保存）
  const realTakePay = loadS("taxi_takepay", { rate: 55, deduction: 30000 });
  const simSettings = loadS("taxi_sim_settings", {
    rate: realTakePay.rate,
    deduction: realTakePay.deduction,
  });

  const [simRate,      setSimRate]      = useState(simSettings.rate);
  const [simDeduction, setSimDeduction] = useState(simSettings.deduction);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [expensesOpen, setExpensesOpen] = useState(true);
  const [savedAll, setSavedAll] = useState(false);

  // 個人出費リスト
  const [expenseRows, setExpenseRows] = useState(() =>
    loadS("taxi_sim_expense_rows", EXPENSE_DEFAULT)
  );

  const totalExpenses = useMemo(() =>
    expenseRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  , [expenseRows]);

  const saveExpenses = (rows) => {
    setExpenseRows(rows);
    saveS("taxi_sim_expense_rows", rows);
  };

  const updateExpenseRow = (i, field, val) => {
    const next = expenseRows.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    saveExpenses(next);
  };

  const addExpenseRow = () => {
    saveExpenses([...expenseRows, { label: "", amount: "" }]);
  };

  const removeExpenseRow = (i) => {
    if (expenseRows.length === 1) {
      saveExpenses(EXPENSE_DEFAULT);
    } else {
      saveExpenses(expenseRows.filter((_, idx) => idx !== i));
    }
  };

  // シミュレーション入力値（date -> 文字列）
  const [simValues, setSimValues] = useState(() => loadS("taxi_sim_values", {}));

  // 一括入力
  const [bulkInput, setBulkInput]   = useState("");
  const [bulkApplied, setBulkApplied] = useState(false);

  // 期間
  const { start: periodStart, end: periodEnd } = getClosingPeriod(user?.closing_day ?? 0);

  // シフト（期間内・日付昇順）
  const allShifts = loadS("taxi_shifts", []);
  const shifts = useMemo(() =>
    allShifts
      .filter(s => s.date >= periodStart && s.date <= periodEnd)
      .sort((a, b) => a.date.localeCompare(b.date))
  , [allShifts, periodStart, periodEnd]);

  // 日報マップ
  const reportMap = useMemo(() => {
    const map = {};
    reports.forEach(r => {
      if (r.date && r.gross_sales) {
        map[r.date] = r.net_sales || Math.round(r.gross_sales / 1.1);
      }
    });
    return map;
  }, [reports]);

  const getShiftAmount = (date) => {
    if (reportMap[date]) return reportMap[date];
    return simValues[date] ? Number(simValues[date]) : 0;
  };

  const setSimValue = (date, val) => {
    const next = { ...simValues, [date]: val };
    setSimValues(next);
    saveS("taxi_sim_values", next);
  };

  const saveSettings = () => {
    saveS("taxi_sim_settings", { rate: simRate, deduction: simDeduction });
    setSettingsSaved(true);
    setTimeout(() => { setSettingsSaved(false); setSettingsOpen(false); }, 1200);
  };

  const handleSaveAll = () => {
    saveS("taxi_sim_settings",    { rate: simRate, deduction: simDeduction });
    saveS("taxi_sim_expense_rows", expenseRows);
    saveS("taxi_sim_values",       simValues);
    setSavedAll(true);
    setTimeout(() => setSavedAll(false), 1800);
  };

  // サマリー計算
  const totalSales    = useMemo(() => shifts.reduce((s, sh) => s + getShiftAmount(sh.date), 0), [shifts, simValues, reportMap]);
  const monthlyTarget = Number(user?.target) || 0;
  const progressRate  = monthlyTarget > 0 ? Math.round(totalSales / monthlyTarget * 100) : 0;
  const enteredCount  = shifts.filter(s => getShiftAmount(s.date) > 0).length;
  const avgSales      = enteredCount > 0 ? Math.round(totalSales / enteredCount) : 0;
  const isKoTaku      = user?.workType === "個人タクシー";
  const payout        = isKoTaku ? totalSales : Math.round(totalSales * simRate / 100);
  const takeHome      = calcTake(totalSales, { rate: simRate, deduction: simDeduction, expenses: simDeduction }, user?.workType);
  const netRemaining  = Math.max(0, takeHome - totalExpenses);

  const progressColor = progressRate >= 100 ? C.green : progressRate >= 80 ? C.accentLight : progressRate >= 60 ? C.gold : C.red;

  // 残りシフト（日報なし）
  const futureShifts = shifts.filter(s => !reportMap[s.date]);

  const applyBulk = () => {
    if (!bulkInput) return;
    const val = String(parseInt(bulkInput.replace(/,/g, "")) || 0);
    const next = { ...simValues };
    futureShifts.forEach(s => { next[s.date] = val; });
    setSimValues(next);
    saveS("taxi_sim_values", next);
    setBulkInput("");
    setBulkApplied(true);
    setTimeout(() => setBulkApplied(false), 2000);
  };

  const clearFuture = () => {
    const next = { ...simValues };
    futureShifts.forEach(s => { delete next[s.date]; });
    setSimValues(next);
    saveS("taxi_sim_values", next);
  };

  const periodLabel = (() => {
    const s = new Date(periodStart + "T00:00:00");
    const e = new Date(periodEnd   + "T00:00:00");
    if (s.getMonth() === e.getMonth()) return `${s.getMonth() + 1}月度`;
    return `${s.getMonth() + 1}月〜${e.getMonth() + 1}月度`;
  })();

  const today = new Date().toISOString().slice(0, 10);

  const inputSt = {
    backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 9,
    padding: "9px 12px", color: C.text, fontSize: 14, outline: "none",
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 140px" }}>

      {/* ヘッダー */}
      <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.accentLight, fontSize: 14, fontWeight: 700, cursor: "pointer", padding: 0 }}>
          ← 戻る
        </button>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>売上シミュレーション</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 12, color: C.muted, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 10px" }}>
            {periodLabel}
          </div>
          <button onClick={handleSaveAll}
            style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", backgroundColor: savedAll ? C.green : C.accentLight, color: "#fff", whiteSpace: "nowrap", transition: "background 0.2s" }}>
            {savedAll ? "✓ 保存済み" : "💾 保存"}
          </button>
        </div>
      </div>

      {/* サマリーパネル */}
      <div style={{ margin: "0 16px 12px", backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
          {[
            { label: "目標運収合計", value: monthlyTarget > 0 ? `¥${fmt(monthlyTarget)}` : "未設定", color: C.accentLight },
            { label: "運収合計",     value: `¥${fmt(totalSales)}`,                                    color: C.text        },
            { label: "進捗率",       value: monthlyTarget > 0 ? `${progressRate}%` : "—",             color: progressColor  },
            { label: "平均運収",     value: enteredCount > 0 ? `¥${fmt(avgSales)}` : "—",             color: C.text        },
          ].map(({ label, value, color }, i) => (
            <div key={label} style={{
              padding: "12px 14px",
              borderBottom: i < 2 ? `1px solid ${C.border}` : "none",
              borderRight: i % 2 === 0 ? `1px solid ${C.border}` : "none",
            }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>{isKoTaku ? "売上（全額収入）" : `支給額 (${simRate}%)`}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>¥{fmt(payout)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>手取り</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>¥{fmt(takeHome)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>残り（出費差引）</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: totalExpenses > 0 ? C.gold : C.muted }}>
                {totalExpenses > 0 ? `¥${fmt(netRemaining)}` : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 計算条件（折りたたみ） */}
      <div style={{ margin: "0 16px 12px" }}>
        <div onClick={() => setSettingsOpen(p => !p)}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: settingsOpen ? "12px 12px 0 0" : 12, cursor: "pointer" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            ⚙️ 計算条件
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginLeft: 8 }}>
              {isKoTaku ? `経費${fmt(simDeduction)}円` : `歩合${simRate}% / 控除${fmt(simDeduction)}円`}
            </span>
          </span>
          <span style={{ fontSize: 11, color: C.muted }}>{settingsOpen ? "▲" : "▼"}</span>
        </div>
        {settingsOpen && (
          <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: "16px 14px" }}>
            {!isKoTaku && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: C.muted }}>歩合率</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.accentLight }}>{simRate}%</span>
                </div>
                <input type="range" min={30} max={80} step={1} value={simRate}
                  onChange={e => setSimRate(Number(e.target.value))}
                  style={{ width: "100%", accentColor: C.accentLight }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted, marginTop: 2 }}>
                  <span>30%</span><span>80%</span>
                </div>
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{isKoTaku ? "月間経費合計（燃料・保険など）" : "月間控除額（社保・税など）"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" value={simDeduction} onChange={e => setSimDeduction(Number(e.target.value))}
                  style={{ ...inputSt, flex: 1 }} />
                <span style={{ fontSize: 12, color: C.muted }}>円</span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, padding: "8px 10px", backgroundColor: C.accentGlow, borderRadius: 8 }}>
              ※ この設定は本体の手取り設定とは独立しています
            </div>
            <button onClick={saveSettings}
              style={{ width: "100%", padding: "11px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, border: "none", backgroundColor: settingsSaved ? C.green : C.accentLight, color: "#fff", cursor: "pointer" }}>
              {settingsSaved ? "✓ 保存しました" : "保存する"}
            </button>
          </div>
        )}
      </div>

      {/* 個人出費 */}
      <div style={{ margin: "0 16px 12px", backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div onClick={() => setExpensesOpen(p => !p)}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", cursor: "pointer" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            💴 個人出費（月）
            {totalExpenses > 0 && <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginLeft: 8 }}>合計 ¥{fmt(totalExpenses)}</span>}
          </span>
          <span style={{ fontSize: 11, color: C.muted }}>{expensesOpen ? "▲" : "▼"}</span>
        </div>
        {!expensesOpen && <div style={{ height: 1, backgroundColor: C.border }} />}
      <div style={{ display: expensesOpen ? "block" : "none", padding: "0 14px 14px" }}>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {expenseRows.map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                value={row.label}
                placeholder="項目名（例: 家賃）"
                onChange={e => updateExpenseRow(i, "label", e.target.value)}
                style={{ ...inputSt, flex: 1, fontSize: 13 }}
              />
              <input
                type="number"
                value={row.amount}
                placeholder="0"
                onChange={e => updateExpenseRow(i, "amount", e.target.value)}
                style={{ ...inputSt, width: 96, textAlign: "right", fontSize: 13, flexShrink: 0 }}
              />
              <button onClick={() => removeExpenseRow(i)}
                style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}>
                ×
              </button>
            </div>
          ))}
        </div>

        <button onClick={addExpenseRow}
          style={{ marginTop: 10, width: "100%", padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 600, border: `1px dashed ${C.border}`, backgroundColor: "transparent", color: C.muted, cursor: "pointer" }}>
          ＋ 行を追加
        </button>

        {/* 合計 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 12, color: C.muted }}>出費合計</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: totalExpenses > 0 ? C.red : C.muted }}>
            {totalExpenses > 0 ? `¥${fmt(totalExpenses)}` : "—"}
          </span>
        </div>
      </div>
      </div>

      {/* 一括入力バー */}
      {futureShifts.length > 0 && (
        <div style={{ margin: "0 16px 10px", backgroundColor: C.accentGlow, border: `1.5px solid ${C.accentLight}55`, borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.accentLight, marginBottom: 8 }}>
            📋 残り{futureShifts.length}シフトに一括入力
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="number" value={bulkInput} onChange={e => setBulkInput(e.target.value)}
              placeholder="予想売上（円）を入力"
              style={{ ...inputSt, flex: 1, fontSize: 13, border: `1px solid ${C.accentLight}66`, backgroundColor: C.card }} />
            <button onClick={applyBulk} disabled={!bulkInput}
              style={{ padding: "10px 16px", borderRadius: 9, fontSize: 13, fontWeight: 700, border: "none", backgroundColor: bulkInput ? C.accentLight : C.border, color: "#fff", cursor: bulkInput ? "pointer" : "not-allowed", whiteSpace: "nowrap", flexShrink: 0 }}>
              {bulkApplied ? "✓ 反映" : "全反映"}
            </button>
          </div>
          {futureShifts.some(s => simValues[s.date]) && (
            <div style={{ textAlign: "right", marginTop: 8 }}>
              <span onClick={clearFuture} style={{ fontSize: 11, color: C.muted, cursor: "pointer", textDecoration: "underline" }}>
                シミュレーション値をリセット
              </span>
            </div>
          )}
        </div>
      )}

      {/* シフト一覧 */}
      {shifts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>シフトが登録されていません</div>
          <div style={{ fontSize: 13 }}>シフト管理画面でシフトを登録してください</div>
        </div>
      ) : (
        <div style={{ margin: "0 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 96px", gap: 8, padding: "4px 10px", marginBottom: 4 }}>
            <div style={{ fontSize: 10, color: C.muted }}>#</div>
            <div style={{ fontSize: 10, color: C.muted }}>日付・曜日</div>
            <div style={{ fontSize: 10, color: C.muted, textAlign: "right" }}>売上（税抜）</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {shifts.map((shift, i) => {
              const isActual = !!reportMap[shift.date];
              const amount   = getShiftAmount(shift.date);
              const inputVal = simValues[shift.date] ?? "";
              const mm_dd    = shift.date ? shift.date.slice(5).replace("-", "/") : "—";
              const dayLabel = dow(shift.date);
              const isToday  = shift.date === today;
              const isPast   = shift.date < today;
              const dayColor = dayLabel === "日" ? C.red : dayLabel === "土" ? C.accentLight : C.muted;

              return (
                <div key={shift.date} style={{
                  display: "grid", gridTemplateColumns: "24px 1fr 96px", gap: 8,
                  alignItems: "center", padding: "9px 10px",
                  backgroundColor: isActual ? C.bg : isToday ? C.accentGlow : C.card,
                  border: `1px solid ${isToday ? C.accentLight + "55" : C.border}`,
                  borderRadius: 10,
                  opacity: isPast && !isActual && !amount ? 0.45 : 1,
                }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{i + 1}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{mm_dd}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: dayColor }}>（{dayLabel}）</span>
                    {isActual && <span style={{ fontSize: 9, color: C.green, backgroundColor: C.green + "22", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>実績</span>}
                    {isToday && !isActual && <span style={{ fontSize: 9, color: C.accentLight, backgroundColor: C.accentLight + "22", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>今日</span>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {isActual ? (
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{fmt(amount)}</div>
                    ) : (
                      <input type="number" value={inputVal} placeholder="—"
                        onChange={e => setSimValue(shift.date, e.target.value)}
                        style={{ width: "100%", textAlign: "right", backgroundColor: "transparent", border: `1px solid ${inputVal ? C.accentLight + "77" : C.border}`, borderRadius: 7, padding: "5px 7px", color: inputVal ? C.text : C.muted, fontSize: 13, fontWeight: 700, outline: "none", boxSizing: "border-box" }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 合計行 */}
          <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 96px", gap: 8, alignItems: "center", padding: "10px 10px", marginTop: 6, backgroundColor: C.accentGlow, border: `1px solid ${C.accentLight}44`, borderRadius: 10 }}>
            <div />
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accentLight }}>合計</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: C.accentLight, textAlign: "right" }}>{fmt(totalSales)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
