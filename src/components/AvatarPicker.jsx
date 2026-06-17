// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AvatarPicker — プロフィール画像選択コンポーネント
//   - プリセット12種から選択
//   - カスタム写真アップロード（Supabase Storage）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useRef, useState } from "react";
import { C } from "../lib/constants";
import { uploadAvatar } from "../lib/supabase";

// ─────────────────────────────────────────
// プリセットアバター定義
// ─────────────────────────────────────────
export const AVATAR_PRESETS = [
  { id: "owl",     emoji: "🦉", bg: "#2563EB", label: "フクロウ" },
  { id: "lion",    emoji: "🦁", bg: "#D97706", label: "ライオン" },
  { id: "tiger",   emoji: "🐯", bg: "#EA580C", label: "トラ" },
  { id: "bear",    emoji: "🐻", bg: "#78716C", label: "クマ" },
  { id: "fox",     emoji: "🦊", bg: "#C2410C", label: "キツネ" },
  { id: "wolf",    emoji: "🐺", bg: "#4B5563", label: "オオカミ" },
  { id: "eagle",   emoji: "🦅", bg: "#1D4ED8", label: "ワシ" },
  { id: "dragon",  emoji: "🐉", bg: "#7C3AED", label: "ドラゴン" },
  { id: "shark",   emoji: "🦈", bg: "#0891B2", label: "サメ" },
  { id: "panther", emoji: "🐆", bg: "#1F2937", label: "ヒョウ" },
  { id: "rhino",   emoji: "🦏", bg: "#374151", label: "サイ" },
  { id: "gorilla", emoji: "🦍", bg: "#166534", label: "ゴリラ" },
];

// ─────────────────────────────────────────
// アバター表示（再利用可能）
// ─────────────────────────────────────────
export function UserAvatar({ avatarUrl, avatarPreset, size = 48, fontSize }) {
  const preset = AVATAR_PRESETS.find(p => p.id === avatarPreset);
  const emojiSize = fontSize ?? Math.round(size * 0.45);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="アバター"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: `2px solid ${C.accentLight}55`,
          flexShrink: 0,
        }}
      />
    );
  }

  const bg    = preset?.bg  ?? C.accentLight + "33";
  const emoji = preset?.emoji ?? "🦉";
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: "50%",
      backgroundColor: bg + (preset ? "cc" : ""),
      border: `2px solid ${bg}88`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: emojiSize,
      flexShrink: 0,
    }}>
      {emoji}
    </div>
  );
}

// ─────────────────────────────────────────
// AvatarPicker 本体
// ─────────────────────────────────────────
export default function AvatarPicker({ userId, avatarUrl, avatarPreset, onSave }) {
  const [selectedPreset, setSelectedPreset] = useState(avatarPreset ?? null);
  const [previewUrl,     setPreviewUrl]     = useState(avatarUrl ?? null);
  const [uploading,      setUploading]      = useState(false);
  const [uploadErr,      setUploadErr]      = useState(null);
  const fileRef = useRef();

  // 写真を選択してアップロード
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr(null);
    setUploading(true);
    // プレビューを即時表示
    const reader = new FileReader();
    reader.onload = ev => setPreviewUrl(ev.target.result);
    reader.readAsDataURL(file);
    // Supabase Storageへアップロード
    const { url, error } = await uploadAvatar(file, userId);
    setUploading(false);
    if (error) {
      setUploadErr("アップロードに失敗しました");
      return;
    }
    setSelectedPreset(null); // カスタム写真優先
    setPreviewUrl(url);
    onSave({ avatar_url: url, avatar_preset: null });
  };

  // プリセット選択
  const handlePreset = (preset) => {
    setSelectedPreset(preset.id);
    setPreviewUrl(null);
    onSave({ avatar_url: null, avatar_preset: preset.id });
  };

  // 写真を削除してデフォルト（フクロウ）に戻す
  const handleReset = () => {
    setSelectedPreset(null);
    setPreviewUrl(null);
    onSave({ avatar_url: null, avatar_preset: null });
  };

  const currentPreset = AVATAR_PRESETS.find(p => p.id === selectedPreset);

  return (
    <div>
      {/* 現在のアバター大表示 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20, gap: 12 }}>
        <UserAvatar avatarUrl={previewUrl} avatarPreset={selectedPreset} size={80} />

        <div style={{ display: "flex", gap: 8 }}>
          {/* 写真アップロードボタン */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", border: `1px solid ${C.accentLight}`, backgroundColor: C.accentLight, color: "#fff" }}
          >
            {uploading ? "アップロード中..." : "📷 写真を選ぶ"}
          </button>
          {(previewUrl || selectedPreset) && (
            <button
              onClick={handleReset}
              style={{ padding: "8px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${C.border}`, backgroundColor: "transparent", color: C.muted }}
            >
              リセット
            </button>
          )}
        </div>

        {uploadErr && (
          <div style={{ fontSize: 12, color: C.red }}>{uploadErr}</div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFile}
        />
      </div>

      {/* プリセット一覧 */}
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 10, letterSpacing: "0.05em" }}>
        キャラクターから選ぶ
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {AVATAR_PRESETS.map(preset => {
          const isSelected = selectedPreset === preset.id && !previewUrl;
          return (
            <div
              key={preset.id}
              onClick={() => handlePreset(preset)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
                padding: "8px 4px",
                borderRadius: 10,
                border: `2px solid ${isSelected ? preset.bg : "transparent"}`,
                backgroundColor: isSelected ? preset.bg + "18" : "transparent",
                transition: "all 0.15s",
              }}
            >
              <div style={{
                width: 50,
                height: 50,
                borderRadius: "50%",
                backgroundColor: preset.bg + "cc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                boxShadow: isSelected ? `0 2px 12px ${preset.bg}66` : "none",
              }}>
                {preset.emoji}
              </div>
              <div style={{ fontSize: 10, color: isSelected ? preset.bg : C.muted, fontWeight: isSelected ? 700 : 400 }}>
                {preset.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
