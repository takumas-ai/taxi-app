// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// エリア設定モーダル・フィルターバナー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState } from "react";
import { C } from "../lib/constants";
import { AREA_MASTER, ALL_AREAS } from "../data/mockData";
import { Btn } from "./UI";

// エリア絞り込みバナー（各画面の上部に表示）
export function AreaFilterBanner({ userAreas, onManage }) {
  if (!userAreas || userAreas.length === 0) {
    return (
      <div onClick={onManage} style={{ backgroundColor:C.redGlow, border:`1px solid ${C.red}44`, borderRadius:10, padding:"10px 14px", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
        <span style={{ fontSize:12, color:C.red }}>⚠️ 所属エリアが未設定です</span>
        <span style={{ fontSize:11, color:C.red, fontWeight:700 }}>設定する →</span>
      </div>
    );
  }
  return (
    <div onClick={onManage} style={{ backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:10, padding:"8px 14px", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <span style={{ fontSize:11, color:C.muted }}>📍 表示中:</span>
        {userAreas.map(a => (
          <span key={a} style={{ fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:99, backgroundColor:(AREA_MASTER[a]?.color||C.accentLight)+"22", color:AREA_MASTER[a]?.color||C.accentLight }}>
            {AREA_MASTER[a]?.emoji} {a}
          </span>
        ))}
      </div>
      <span style={{ fontSize:10, color:C.muted }}>変更 →</span>
    </div>
  );
}

// エリア設定モーダル
export function AreaSettingModal({ userAreas, onSave, onClose }) {
  const [selected, setSelected] = useState(userAreas || []);
  const toggle = a => setSelected(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#00000090", zIndex:200, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, margin:"0 auto", padding:24, paddingBottom:40 }}>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 18px" }} />
        <div style={{ fontSize:17, fontWeight:700, marginBottom:6 }}>所属エリアを設定</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:18 }}>選択したエリアの情報だけが表示されます。複数選択可。</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
          {ALL_AREAS.map(a => {
            const meta = AREA_MASTER[a];
            const isOn = selected.includes(a);
            return (
              <div key={a} onClick={() => toggle(a)} style={{ padding:"12px 14px", borderRadius:12, border:`2px solid ${isOn?meta.color:C.border}`, backgroundColor:isOn?meta.color+"15":C.card, cursor:"pointer", transition:"all 0.15s" }}>
                <div style={{ fontSize:20, marginBottom:4 }}>{meta.emoji}</div>
                <div style={{ fontSize:13, fontWeight:700, color:isOn?meta.color:C.text }}>{a}</div>
                <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{meta.desc}</div>
                {isOn && <div style={{ fontSize:10, color:meta.color, marginTop:4, fontWeight:700 }}>✓ 選択中</div>}
              </div>
            );
          })}
        </div>
        {selected.length === 0 && <div style={{ fontSize:12, color:C.red, marginBottom:12, textAlign:"center" }}>1つ以上選択してください</div>}
        <Btn onClick={() => { if (selected.length > 0) { onSave(selected); onClose(); } }} disabled={selected.length === 0}>
          {selected.length > 0 ? `${selected.join("・")}で絞り込む` : "エリアを選択してください"}
        </Btn>
        <Btn onClick={onClose} variant="ghost" style={{ marginTop:10 }}>キャンセル</Btn>
      </div>
    </div>
  );
}

// エリアフィルター関数（ユーティリティ）
export const inArea = (item, userAreas) => {
  if (!userAreas || userAreas.length === 0) return true;
  const itemAreas = item.areas || (item.area ? [item.area] : []);
  return userAreas.some(a => itemAreas.includes(a));
};
