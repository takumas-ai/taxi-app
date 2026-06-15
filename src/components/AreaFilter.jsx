// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// エリア設定モーダル・フィルターバナー（全国交通圏対応版）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState } from "react";
import { C } from "../lib/constants";
import { TRAFFIC_ZONES_BY_REGION, ZONE_META } from "../data/trafficZones";
import { Btn } from "./UI";

// ━━━ エリア絞り込みバナー（各画面上部） ━━━
export function AreaFilterBanner({ userAreas, onManage }) {
  if (!userAreas || userAreas.length === 0) {
    return (
      <div onClick={onManage} style={{ backgroundColor:C.redGlow, border:`1px solid ${C.red}44`, borderRadius:10, padding:"10px 14px", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
        <span style={{ fontSize:12, color:C.red }}>⚠️ 所属交通圏が未設定です</span>
        <span style={{ fontSize:11, color:C.red, fontWeight:700 }}>設定する →</span>
      </div>
    );
  }
  return (
    <div onClick={onManage} style={{ backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:10, padding:"8px 14px", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:0, overflow:"hidden" }}>
        <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>📍 所属圏:</span>
        {userAreas.slice(0, 2).map(a => {
          const meta = ZONE_META[a];
          return (
            <span key={a} style={{ fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:99, backgroundColor:(meta?.color||C.accentLight)+"22", color:meta?.color||C.accentLight, whiteSpace:"nowrap" }}>
              {meta?.emoji} {a}
            </span>
          );
        })}
        {userAreas.length > 2 && <span style={{ fontSize:9, color:C.muted }}>+{userAreas.length - 2}</span>}
      </div>
      <span style={{ fontSize:10, color:C.muted, flexShrink:0, marginLeft:8 }}>変更 →</span>
    </div>
  );
}

// ━━━ 交通圏設定モーダル（地域 → 交通圏 の2段選択） ━━━
export function AreaSettingModal({ userAreas, onSave, onClose }) {
  const [selectedRegion, setSelectedRegion] = useState(() => {
    // 既存の選択から地域を推定
    if (userAreas && userAreas.length > 0) {
      return ZONE_META[userAreas[0]]?.region ?? null;
    }
    return null;
  });
  const [selected, setSelected] = useState(userAreas || []);

  const toggle = zone => {
    setSelected(prev => prev.includes(zone) ? prev.filter(x => x !== zone) : [...prev, zone]);
  };

  const regionData = selectedRegion
    ? TRAFFIC_ZONES_BY_REGION.find(r => r.region === selectedRegion)
    : null;

  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#00000090", zIndex:200, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, margin:"0 auto", padding:"20px 20px 40px", maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 16px" }} />

        {/* ヘッダー */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>
            {selectedRegion ? (
              <span>
                <span onClick={() => setSelectedRegion(null)} style={{ color:C.accentLight, cursor:"pointer", fontSize:13, marginRight:8 }}>← 地域</span>
                {regionData?.emoji} {selectedRegion}
              </span>
            ) : "所属交通圏を設定"}
          </div>
          <div style={{ fontSize:11, color:C.muted }}>
            {selectedRegion ? "営業区域（交通圏）を選択。複数選択可。" : "まず地域を選んでください"}
          </div>
        </div>

        {/* 地域選択 */}
        {!selectedRegion && (
          <div style={{ overflowY:"auto", flex:1 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {TRAFFIC_ZONES_BY_REGION.map(({ region, color, emoji, zones }) => {
                const hasSelected = zones.some(z => selected.includes(z));
                return (
                  <div key={region} onClick={() => setSelectedRegion(region)}
                    style={{ padding:"12px 12px", borderRadius:12, border:`2px solid ${hasSelected ? color : C.border}`, backgroundColor:hasSelected ? color+"12" : C.card, cursor:"pointer", transition:"all 0.15s", position:"relative" }}>
                    <div style={{ fontSize:22, marginBottom:4 }}>{emoji}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:hasSelected ? color : C.text }}>{region}</div>
                    <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{zones.length}区域</div>
                    {hasSelected && (
                      <div style={{ position:"absolute", top:6, right:8, fontSize:10, color:color, fontWeight:700 }}>
                        ✓ {zones.filter(z => selected.includes(z)).length}選択
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 交通圏選択 */}
        {selectedRegion && regionData && (
          <div style={{ overflowY:"auto", flex:1 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {regionData.zones.map(zone => {
                const isOn = selected.includes(zone);
                const color = regionData.color;
                return (
                  <div key={zone} onClick={() => toggle(zone)}
                    style={{ padding:"11px 14px", borderRadius:10, border:`2px solid ${isOn ? color : C.border}`, backgroundColor:isOn ? color+"15" : C.card, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", transition:"all 0.15s" }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:isOn ? 700 : 400, color:isOn ? color : C.text }}>{zone.replace(/交通圏$/, "")}</div>
                    </div>
                    {isOn && <span style={{ fontSize:14, color:color }}>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* フッターボタン */}
        <div style={{ marginTop:16, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
          {selected.length === 0 && (
            <div style={{ fontSize:12, color:C.red, marginBottom:10, textAlign:"center" }}>1つ以上選択してください</div>
          )}
          {selected.length > 0 && (
            <div style={{ fontSize:11, color:C.muted, marginBottom:10 }}>
              選択中: {selected.slice(0, 3).join("・")}{selected.length > 3 ? `…他${selected.length - 3}件` : ""}
            </div>
          )}
          <Btn onClick={() => { if (selected.length > 0) { onSave(selected); onClose(); } }} disabled={selected.length === 0}>
            {selected.length > 0 ? `${selected.length}件の交通圏で設定する` : "交通圏を選択してください"}
          </Btn>
          <Btn onClick={onClose} variant="ghost" style={{ marginTop:8 }}>キャンセル</Btn>
        </div>
      </div>
    </div>
  );
}

// ━━━ エリアフィルター関数 ━━━
export const inArea = (item, userAreas) => {
  if (!userAreas || userAreas.length === 0) return true;
  const itemAreas = item.areas || (item.area ? [item.area] : []);
  return userAreas.some(a => itemAreas.includes(a));
};

// 後方互換: 旧 AREA_MASTER 参照を使っているコンポーネント向け
export const AREA_MASTER = Object.fromEntries(
  TRAFFIC_ZONES_BY_REGION.flatMap(({ color, emoji, zones }) =>
    zones.map(zone => [zone, { color, emoji, desc: zone }])
  )
);
export const ALL_AREAS = TRAFFIC_ZONES_BY_REGION.flatMap(r => r.zones);
