# 字幕スタイルプリセット - クイックリファレンス

## 📝 スタイル①：標準（白文字・黒枠・下部）
**用途**: 最も視認性が高い。あらゆる動画に適用可能。

```json
"captionStyle": {
  "position": "bottom",
  "fontSize": 40,
  "fontColor": "white",
  "strokeColor": "black",
  "strokeWidth": 2
}
```

## ⚡ スタイル②：目立つ（黄色・太枠・大きめ）
**用途**: インパクト重視。重要な情報強調。

```json
"captionStyle": {
  "position": "bottom",
  "fontSize": 60,
  "fontColor": "#FFFF00",
  "strokeColor": "#000000",
  "strokeWidth": 4
}
```

## ✨ スタイル③：柔らかい（白文字・細い灰色枠）
**用途**: 控えめで上品。自然な雰囲気の動画向け。

```json
"captionStyle": {
  "position": "bottom",
  "fontSize": 40,
  "fontColor": "white",
  "strokeColor": "#555555",
  "strokeWidth": 1
}
```

## ⬆️ スタイル④：画面上部
**用途**: 画面下部に重要な要素がある場合。

```json
"captionStyle": {
  "position": "top",
  "fontSize": 40,
  "fontColor": "white",
  "strokeColor": "black",
  "strokeWidth": 2
}
```

## 🌈 スタイル⑤：カラフル（シアン・青枠）
**用途**: ポップで明るい。エンタメ系向け。

```json
"captionStyle": {
  "position": "bottom",
  "fontSize": 45,
  "fontColor": "#00FFFF",
  "strokeColor": "#0066CC",
  "strokeWidth": 3
}
```

## 👑 スタイル⑥：エレガント（ゴールド・茶枠）
**用途**: 高級感演出。ビジネス・フォーマル向け。

```json
"captionStyle": {
  "position": "bottom",
  "fontSize": 42,
  "fontColor": "#FFD700",
  "strokeColor": "#654321",
  "strokeWidth": 3
}
```

## ◻️ スタイル⑦：枠線なし（白文字のみ）
**用途**: ミニマルデザイン。背景が暗い動画専用。

```json
"captionStyle": {
  "position": "bottom",
  "fontSize": 40,
  "fontColor": "white",
  "strokeColor": "black",
  "strokeWidth": 0
}
```

## 💥 スタイル⑧：超大型（特大・極太枠）
**用途**: 最大インパクト。キャッチコピー・タイトル向け。

```json
"captionStyle": {
  "position": "bottom",
  "fontSize": 80,
  "fontColor": "white",
  "strokeColor": "black",
  "strokeWidth": 6
}
```

---

## パラメータ仕様

| パラメータ | 型 | 範囲 | デフォルト |
|-----------|-----|------|-----------|
| position | string | "top" \| "bottom" | "bottom" |
| fontSize | number | 10-200 | 40 |
| fontColor | string | CSS color | "white" |
| strokeColor | string | CSS color | "black" |
| strokeWidth | number | 0-10 | 2 |

## UI実装例（TypeScript）

```typescript
export const CAPTION_STYLE_PRESETS = [
  { id: 'standard', name: '標準', icon: '📝', style: { position: 'bottom', fontSize: 40, fontColor: 'white', strokeColor: 'black', strokeWidth: 2 } },
  { id: 'bold', name: '目立つ', icon: '⚡', style: { position: 'bottom', fontSize: 60, fontColor: '#FFFF00', strokeColor: '#000000', strokeWidth: 4 } },
  { id: 'soft', name: '柔らかい', icon: '✨', style: { position: 'bottom', fontSize: 40, fontColor: 'white', strokeColor: '#555555', strokeWidth: 1 } },
  { id: 'top', name: '画面上部', icon: '⬆️', style: { position: 'top', fontSize: 40, fontColor: 'white', strokeColor: 'black', strokeWidth: 2 } },
  { id: 'colorful', name: 'カラフル', icon: '🌈', style: { position: 'bottom', fontSize: 45, fontColor: '#00FFFF', strokeColor: '#0066CC', strokeWidth: 3 } },
  { id: 'elegant', name: 'エレガント', icon: '👑', style: { position: 'bottom', fontSize: 42, fontColor: '#FFD700', strokeColor: '#654321', strokeWidth: 3 } },
  { id: 'minimal', name: '枠線なし', icon: '◻️', style: { position: 'bottom', fontSize: 40, fontColor: 'white', strokeColor: 'black', strokeWidth: 0 } },
  { id: 'large', name: '超大型', icon: '💥', style: { position: 'bottom', fontSize: 80, fontColor: 'white', strokeColor: 'black', strokeWidth: 6 } },
] as const;
```
