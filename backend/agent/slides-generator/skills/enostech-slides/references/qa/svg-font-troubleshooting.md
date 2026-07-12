# SVG レンダリングで日本語が消えた / 文字が脱字した時の手順

> 壊れる事故 (LIST-3 への退避運用) を起こした時に整備したトラブルシュート。
> 「文字が消えた」「妙な英字フォントになった」「下線・記号だけ残ってる」と
> 感じたら、**まずこのページに沿って 30 秒で原因を切り分ける**。

---

## 0. まず最低限チェックする 3 点

| 観点 | チェック方法 | こうなってたら原因濃厚 |
|------|------------|---------------------|
| ❶ 同梱フォントの存在 | `ls skills/enostech-slides/assets/fonts/` で `NotoSansJP-Regular.ttf` / `NotoSansJP-Bold.ttf` が両方ある | 片方でも欠けてる → 同梱漏れ |
| ❷ build-deck.js の経路 | ビルドログに `[svg-preprocess] ✓ N 枚を PNG 化` が出る | `lib/svg-render のロードに失敗` が出てる → require 解決失敗 |
| ❸ SVG ソースの font-family | `grep -o 'font-family="[^"]*"' your.svg \| sort -u` で値を確認 | `'Noto Sans JP', sans-serif` のようなコンマ区切り値しかない |

❶ が NG → §1 / ❷ が NG → §2 / ❸ が NG → §3 の順で読む。

---

## 1. 同梱フォントが消えた場合

`assets/fonts/NotoSansJP-Regular.ttf` と `NotoSansJP-Bold.ttf` が両方必要。
どちらか欠けると `lib/svg-render.js` の `resolveBundledFontFiles` が
loadSystemFonts: true へフォールバックし、その先で日本語フォント (sandbox 環境では
Droid Sans Fallback しかない) が見つからないと文字脱字を起こす。

### 復旧手順

```bash
cd /tmp
npm install --no-save @expo-google-fonts/noto-sans-jp
cp node_modules/@expo-google-fonts/noto-sans-jp/400Regular/NotoSansJP_400Regular.ttf \
   "$SKILL/assets/fonts/NotoSansJP-Regular.ttf"
cp node_modules/@expo-google-fonts/noto-sans-jp/700Bold/NotoSansJP_700Bold.ttf \
   "$SKILL/assets/fonts/NotoSansJP-Bold.ttf"
```

`$SKILL` は `skills/enostech-slides/` のフルパス。
ライセンスは SIL OFL 1.1 (`assets/fonts/LICENSE-OFL.txt` 同梱済み)。

---

## 2. lib/svg-render.js のロードに失敗するケース

build ログに以下のような行があれば、enostech-slides 内の `lib/svg-render` が
require できていない:

```
[svg-preprocess] lib/svg-render のロードに失敗 ...
```

考えられる要因:

| 原因 | 確認 | 対処 |
|------|------|------|
| .skill バンドルから漏れた | `unzip -l skills/enostech-slides.skill \| grep svg-render` で 1 行も出ない | `pack-skill.py` の include glob を確認、再ビルド |
| node_modules が同梱されていない | `ls node_modules/@resvg/resvg-js/` が無い | `npm install --omit=dev` してから .skill を作る |

最後の砦として、enostech-svg-diagram skill 側の `svg-to-png.js` にも
同じ「lib/svg-render があれば先にそれを使う」フォールバックが入っている。
build-deck.js → enostech-svg-diagram → lib/svg-render の三段経路で
どこかは必ず通るようになっている。

---

## 3. SVG ソース側の font-family がコンマ区切り

R-SVG-7b で warn になる:

```
font-family "'Noto Sans JP', sans-serif" にコンマ区切り fallback が含まれています。
```

> `<svg font-family="'Noto Sans JP', sans-serif">` のように書くと、Web ブラウザでは
> Noto Sans JP が無い環境で sans-serif にフォールバックする「親切設計」になる。
> しかし resvg-js は font-family の値を **文字列リテラルとして** 解釈するため、
> コンマ区切りリストが指定された <text> では「fallback リストの先頭から順番に試す」
> 挙動が環境によってブレる。Linux sandbox には Noto Sans JP が無く Droid Sans
> Fallback しか無いという状況で、コンマ区切りリストが原因で日本語 glyph が脱落する
> 事故が出た。

レンダラ (`lib/svg-render.js::renderSvgToPng`) は
**SVG 文字列を render 直前に正規化して font-family を `Noto Sans JP` 単一値に
書き換える**。そのため「コンマ区切りでも結果は変わらない」のが現状の挙動。

ただし SVG ソース時点でも単一値に揃えておくと:

- 別環境で resvg 以外のレンダラ (Inkscape / Chromium / sharp) を使う日が来ても安全
- SchemaQA (R-SVG-7b) で warn が出ない
- 「fallback が効くつもり」というメンタルモデルが消え、コードレビューがブレない

ので、**SVG を新しく書くときは最初から `font-family="Noto Sans JP"` 単一値で
書く**。これがブランド標準。

### grep で機械的に検出する

```bash
# あなたのデッキディレクトリの SVG で fallback リストが残っているものを列挙
grep -rln "font-family=\"'.*',.*\"" decks/your-slug/assets/svg-src/ 2>/dev/null
```

---

## 4. それでも直らない時 (escalation)

1. `node skills/enostech-slides/scripts/render/lib/svg-render.js` を直接叩いて
   render が成立するか確認:
   ```bash
   ENO_SVG_DEBUG=1 node -e "
     const {renderSvgToPng} = require('./scripts/render/lib/svg-render');
     renderSvgToPng('<svg viewBox=\"0 0 400 100\"><text x=\"200\" y=\"50\" text-anchor=\"middle\" font-size=\"24\" fill=\"#1F2937\">日本語と English</text></svg>',{width:800})
       .then(buf => require('fs').writeFileSync('/tmp/sanity.png', buf));
   "
   ```
   `/tmp/sanity.png` を開いて文字が出ているか確認。
2. enostech-svg-diagram の `svg-to-png.js` の単体動作も同じ要領で確認。
3. それでも壊れていたら osanai さんに連絡 → SECSUMMARY-1 退避 (LIST-3 化) で凌ぐ。

---

## 5. 将来 SVG レンダラを差し替えるとき

`lib/svg-render.js::renderSvgToPng` が単一の入口になっているので、Inkscape / sharp /
headless Chromium に乗せ換える場合もここを書き換えるだけで済む設計。
切り替え時の必須条件:

- 同梱フォントを必ず明示ロードできること (`font.fontFiles` 相当の API がある)
- 日本語 + Latin 混在テキストで脱字しないこと (本ドキュメントの 7 ケース
  テストパターンを通すこと)
- background / fitTo / width 指定が同等に効くこと

テストパターンの保管場所: `skills/enostech-slides/references/qa/svg-font-troubleshooting-tests/`
