# 字幕スタイルサンプル集

mergeVideoAudioNarrationサービスで使用できる字幕スタイルのプリセット例です。

## スタイル一覧

### ① 標準（白文字・黒枠・下部）

**用途**: 最も視認性が高い標準スタイル。あらゆる動画に適用可能。

```json
{
  "captionStyle": {
    "position": "bottom",
    "fontSize": 40,
    "fontColor": "white",
    "strokeColor": "black",
    "strokeWidth": 2
  }
}
```

---

### ② 目立つ（黄色文字・太い黒枠・大きめ・下部）

**用途**: インパクト重視。重要な情報を強調したい場合に最適。

```json
{
  "captionStyle": {
    "position": "bottom",
    "fontSize": 60,
    "fontColor": "#FFFF00",
    "strokeColor": "#000000",
    "strokeWidth": 4
  }
}
```

---

### ③ 柔らかい（白文字・細い灰色枠・下部）

**用途**: 控えめで上品な印象。自然な雰囲気の動画に適用。

```json
{
  "captionStyle": {
    "position": "bottom",
    "fontSize": 40,
    "fontColor": "white",
    "strokeColor": "#555555",
    "strokeWidth": 1
  }
}
```

---

### ④ 画面上部（白文字・黒枠・上部）

**用途**: 画面下部に重要な要素がある場合に使用。

```json
{
  "captionStyle": {
    "position": "top",
    "fontSize": 40,
    "fontColor": "white",
    "strokeColor": "black",
    "strokeWidth": 2
  }
}
```

---

### ⑤ カラフル（シアン文字・青枠・下部）

**用途**: ポップで明るい印象。エンタメ系コンテンツに最適。

```json
{
  "captionStyle": {
    "position": "bottom",
    "fontSize": 45,
    "fontColor": "#00FFFF",
    "strokeColor": "#0066CC",
    "strokeWidth": 3
  }
}
```

---

### ⑥ エレガント（ゴールド文字・濃い茶枠・下部）

**用途**: 高級感を演出。ビジネス・フォーマルコンテンツ向け。

```json
{
  "captionStyle": {
    "position": "bottom",
    "fontSize": 42,
    "fontColor": "#FFD700",
    "strokeColor": "#654321",
    "strokeWidth": 3
  }
}
```

---

### ⑦ 枠線なし（白文字のみ・下部）

**用途**: ミニマルデザイン。背景が暗い動画専用。

```json
{
  "captionStyle": {
    "position": "bottom",
    "fontSize": 40,
    "fontColor": "white",
    "strokeColor": "black",
    "strokeWidth": 0
  }
}
```

---

### ⑧ 超大型（特大白文字・極太黒枠・下部）

**用途**: 最大のインパクト。キャッチコピーやタイトル表示に最適。

```json
{
  "captionStyle": {
    "position": "bottom",
    "fontSize": 80,
    "fontColor": "white",
    "strokeColor": "black",
    "strokeWidth": 6
  }
}
```

---

## 完全なリクエスト例

```json
{
  "request_id": "req_xyz789",
  "input": {
    "videoBucketName": "storyvault-sandbox",
    "videoFilePath": "mergeVideoAudioNarration/744_1280x720.mp4",
    "audioSegments": [
      {
        "sourceBucketName": "storyvault-sandbox",
        "sourceFilePath": "mergeVideoAudioNarration/001-sibutomo.mp3",
        "timestampMs": 0
      }
    ],
    "outputBucketName": "storyvault-sandbox",
    "outputFilePath": "mergeVideoAudioNarration/apiTestResult/merged_with_captions.mp4",
    "captionIsEnabled": true,
    "captionSegments": [
      {
        "timestampMs": 0,
        "text": "原宿さんは歴史にしろ人生にしろ地続きのものが好き"
      },
      {
        "timestampMs": 5000,
        "text": "カウントダウンでリセットするのが合わないのかな"
      }
    ],
    "captionStyle": {
      "position": "bottom",
      "fontSize": 60,
      "fontColor": "#FFFF00",
      "strokeColor": "#000000",
      "strokeWidth": 4
    }
  },
  "metadata": {
    "organizationId": "org1",
    "videoId": "video456",
    "projectId": "project789",
    "loggingCollectionId": "requestLogs",
    "loggingDocumentId": "log_xyz789"
  }
}
```

## パラメータ仕様

| パラメータ | 型 | 値の範囲 | デフォルト | 説明 |
|-----------|-----|---------|-----------|------|
| `position` | string | `"top"` \| `"bottom"` | `"bottom"` | 字幕の表示位置 |
| `fontSize` | number | 10 ~ 200 | 40 | 文字サイズ（ピクセル） |
| `fontColor` | string | CSS color / `#RRGGBB` | `"white"` | 文字色 |
| `strokeColor` | string | CSS color / `#RRGGBB` | `"black"` | 枠線色 |
| `strokeWidth` | number | 0 ~ 10 | 2 | 枠線の太さ（0で枠線なし） |
| `fontName` | string | フォントパス | (自動) | カスタムフォント（オプション） |

## UI実装のヒント

### プリセット選択UI例

```typescript
const captionStylePresets = [
  { id: 'standard', name: '標準', icon: '📝', style: { position: 'bottom', fontSize: 40, fontColor: 'white', strokeColor: 'black', strokeWidth: 2 } },
  { id: 'bold', name: '目立つ', icon: '⚡', style: { position: 'bottom', fontSize: 60, fontColor: '#FFFF00', strokeColor: '#000000', strokeWidth: 4 } },
  { id: 'soft', name: '柔らかい', icon: '✨', style: { position: 'bottom', fontSize: 40, fontColor: 'white', strokeColor: '#555555', strokeWidth: 1 } },
  { id: 'top', name: '画面上部', icon: '⬆️', style: { position: 'top', fontSize: 40, fontColor: 'white', strokeColor: 'black', strokeWidth: 2 } },
  { id: 'colorful', name: 'カラフル', icon: '🌈', style: { position: 'bottom', fontSize: 45, fontColor: '#00FFFF', strokeColor: '#0066CC', strokeWidth: 3 } },
  { id: 'elegant', name: 'エレガント', icon: '👑', style: { position: 'bottom', fontSize: 42, fontColor: '#FFD700', strokeColor: '#654321', strokeWidth: 3 } },
  { id: 'minimal', name: '枠線なし', icon: '◻️', style: { position: 'bottom', fontSize: 40, fontColor: 'white', strokeColor: 'black', strokeWidth: 0 } },
  { id: 'large', name: '超大型', icon: '💥', style: { position: 'bottom', fontSize: 80, fontColor: 'white', strokeColor: 'black', strokeWidth: 6 } },
];
```

### カラーピッカー実装例

```vue
<template>
  <div class="caption-style-editor">
    <UFormGroup label="文字色">
      <input type="color" v-model="captionStyle.fontColor" />
    </UFormGroup>
    <UFormGroup label="枠線色">
      <input type="color" v-model="captionStyle.strokeColor" />
    </UFormGroup>
    <UFormGroup label="文字サイズ">
      <URange v-model="captionStyle.fontSize" :min="10" :max="200" />
    </UFormGroup>
    <UFormGroup label="枠線太さ">
      <URange v-model="captionStyle.strokeWidth" :min="0" :max="10" />
    </UFormGroup>
  </div>
</template>
```
