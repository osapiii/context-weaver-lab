# 同梱フォント (assets/fonts/)

v9.3 で SVG → PNG 変換時の日本語レンダリング安定化のために導入。
resvg-js が `loadSystemFonts: true` でも環境依存で日本語フォントを掴めない
ケースがあったため、このディレクトリのフォントを `font.fontFiles` で
明示的にロードする運用に切り替えた。

## ファイル

| ファイル | 用途 | ライセンス |
|---|---|---|
| `NotoSansJP-Regular.ttf` | 本文・通常ウェイト | SIL OFL 1.1 |
| `NotoSansJP-Bold.ttf` | 見出し・強調 (font-weight: 700) | SIL OFL 1.1 |
| `LICENSE-OFL.txt` | OFL 1.1 ライセンス全文 | — |

合計 約 11 MB。

## 利用箇所

- `scripts/render/lib/svg-render.js` の `renderSvgToPng()` が `font.fontFiles`
  にこの 2 ファイルを渡す
- `scripts/render/lib/svg-render.js::SAFE_FONT_FAMILY = 'Noto Sans JP'`
  (これが defaultFontFamily にも使われる)

## なぜこの 2 ウェイトだけか

ENOSTECH ブランドの SVG ダイアグラムは Regular と Bold の 2 ウェイトしか
使わない (R-SVG-7 / R-SVG-14 で強調手段が制限されているため)。Light や
Medium を入れても利用箇所がない。サイズ削減を優先。

## 入れ替える時

別バージョンの Noto Sans JP に差し替える場合:

1. ファイル名は `NotoSansJP-Regular.ttf` / `NotoSansJP-Bold.ttf` のまま
2. 必要なら `LICENSE-OFL.txt` も該当バージョンのものに更新
3. `lib/svg-render.js` の `BUNDLED_FONTS` 配列は変更不要
4. ビルドして `decks/{slug}/assets/svg-rendered/` 配下の PNG を再生成して目視確認
