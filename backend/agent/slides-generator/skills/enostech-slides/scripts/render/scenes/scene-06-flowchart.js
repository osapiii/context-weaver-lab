/**
 * SCENE-06 フローチャート
 * ====================================================
 * 学習デッキにおける「正しい意思決定への道筋」をシェイプで描く最重要シーン。
 * 縦軸に YES/NO 判断を並べ、判断結果に応じて右側に結果ノード (process) を
 * 出す型を中核にしつつ、単純な縦パイプラインや単純な横フローも同じテンプレで
 * カバーする。
 *
 * 設計原則:
 *   - 1 シーン = 1 つの意思決定木。
 *   - **vertical-decision: steps 最大 4 個**。これ以上必要なら別ページに分割する
 *     (5 個以上を 1 枚に詰めると菱形が縦に潰れて文字が枠から溢れる)
 *   - horizontal-flow / simple-vertical は最大 6 個までは許容
 *   - 終端は必ず Pill (drawTerminator) で表現し、「ここがゴール」と分からせる
 *   - 判断ノード (drawDecision) は短いキーワード (〜10 文字) のみ
 *   - YES = brand / NO = highlight (amber) で意味を色で覚えさせる
 *
 * sceneJson:
 *   {
 *     layout?: 'vertical-decision' | 'horizontal-flow' | 'simple-vertical',
 *               // default 'vertical-decision' (添付画像のような型)
 *     start: { label: '事業者が対価を得て行った取引' },
 *     steps: [
 *       // kind: 'decision' なら菱形。yes_to / no_to の行先を持つ
 *       // kind: 'process' なら角丸長方形。yes_to は無く 'next' に流れる
 *       {
 *         kind: 'decision',
 *         label: '資産の譲渡',
 *         yes_to: 'next',                // 次の step に進む
 *         no_to:  { side: 0 },           // side_results[0] に向かう
 *       },
 *       {
 *         kind: 'decision',
 *         label: '国内取引',
 *         yes_to: 'next',
 *         no_to:  { side: 0 },           // 同じ side_results を共有
 *       },
 *       {
 *         kind: 'decision',
 *         label: '非課税取引',
 *         yes_to: { side: 1 },           // side_results[1] へ
 *         no_to:  'next',                // (NO で次へ進む型)
 *       },
 *       {
 *         kind: 'decision',
 *         label: '輸出免税等',
 *         yes_to: { side: 2 },
 *         no_to:  'end',                 // 全 NO クリアで end に到達
 *       },
 *     ],
 *     // 側方の結果ノード (添付画像の「課税の対象外」「非課税取引」「輸出免税等取引」)
 *     side_results: [
 *       { label: '課税の対象外（不課税取引）', kind: 'result-warn' },
 *       { label: '非課税取引', kind: 'result-warn' },
 *       { label: '輸出免税等取引', kind: 'result-warn' },
 *     ],
 *     end: { label: '課税取引', kind: 'success' },  // 最終ゴール (Pill)
 *   }
 */
'use strict';
const A = require('../atoms-shape');

// ───────────────────────────────────────────────────────
// メインルーター
// ───────────────────────────────────────────────────────
function drawScene06FlowChart(slide, sceneJson, area, ctx) {
  const layout = sceneJson.layout || 'vertical-decision';
  if (layout === 'horizontal-flow')   return _drawHorizontal(slide, sceneJson, area, ctx);
  if (layout === 'simple-vertical')   return _drawSimpleVertical(slide, sceneJson, area, ctx);
  return _drawVerticalDecision(slide, sceneJson, area, ctx);
}

// ───────────────────────────────────────────────────────
// vertical-decision (添付画像型 / 最頻パターン)
// ───────────────────────────────────────────────────────
//
// レイアウト戦略:
//   ・左 38% にメインの縦フロー (start → 各 step → end)
//   ・右 55% に side_results (画像の「課税対象外」「非課税取引」等)
//   ・各ノード間に十分な「矢印スペース」を取り、YES/NO ピルが
//     ノードに被らないようにする (R-DESIGN-FC-1)
//   ・菱形は横長アスペクト (1.0 : 0.55) で、ラベルが見切れないようにする
//
function _pickDecisionLabelSize(label, decisionH) {
  const len = (label || '').length;
  // decision の高さは大体 0.7-1.1" の範囲。基準を 0.9" で見て調整
  if (len <= 8) return 13;
  if (len <= 12) return 11.5;
  if (len <= 16) return 10;
  if (len <= 20) return 9;
  return 8;  // 20字超は警告も出る
}
function _pickProcessLabelSize(label) {
  const len = (label || '').length;
  if (len <= 10) return 12;
  if (len <= 14) return 11;
  if (len <= 18) return 10;
  return 9;
}
function _pickSideResultLabelSize(label) {
  const len = (label || '').length;
  if (len <= 10) return 13;
  if (len <= 14) return 12;
  if (len <= 18) return 11;
  return 10;
}

function _drawVerticalDecision(slide, sceneJson, area, ctx) {
  const start = sceneJson.start || {};
  const steps = sceneJson.steps || [];
  const sideResults = sceneJson.side_results || [];
  const end = sceneJson.end || {};
  const slideId = sceneJson._slideId || '?';
  if (steps.length > 4) {
    console.warn(
      `[SCENE-06] slide ${slideId} vertical-decision の steps が ${steps.length} 個 ` +
      `(上限 4 個)。5 個以上は菱形が縦に潰れて文字溢れの原因。別ページに分割を推奨。` +
      `今回は先頭 4 個のみ描画します。`
    );
  }
  const usedSteps = steps.slice(0, 4);
  const n = usedSteps.length;
  if (n === 0) return;
  usedSteps.forEach((step, i) => {
    const max = step.kind === 'decision' ? 16 : 18;
    const len = (step.label || '').length;
    if (len > max) {
      console.warn(
        `[SCENE-06] slide ${slideId} steps[${i}].label が ${len} 字 ` +
        `(${step.kind === 'decision' ? '菱形' : 'process'}、推奨上限 ${max} 字)。` +
        `動的縮小は効くが見栄え劣化。短いキーワードに整えてください。`
      );
    }
  });
  sideResults.forEach((sr, i) => {
    const len = (sr.label || '').length;
    if (len > 18) {
      console.warn(
        `[SCENE-06] slide ${slideId} side_results[${i}].label が ${len} 字 ` +
        `(推奨上限 18 字)。`
      );
    }
  });

  // ── 左右のカラム配分 ──
  const mainW = Math.min(area.w * 0.40, 4.20);  // 左メインフローの幅
  const mainCx = area.x + 0.20 + mainW / 2;
  const sideGap = 0.45;
  const sideX = area.x + 0.20 + mainW + sideGap;
  const sideW = area.w - 0.20 - mainW - sideGap;

  // ── 縦方向のスロット計算 ──
  // area.h を基に、ノードと矢印 gap を比率で配分する。
  // ノード比率: terminator = 1.0、decision = 1.6 (菱形のアスペクト比保持)、process = 1.1
  // 矢印 gap 比率: 1.0
  // 全体の比率合計から area.h を割り、各セクションに比例配分。
  const TERM_R = 1.0;  // terminator (start/end) の比率単位
  const DEC_R  = 1.8;  // decision (菱形) の比率単位 (縦長気味)
  const PROC_R = 1.1;  // process の比率単位
  const GAP_R  = 1.3;  // 矢印 gap の比率単位 (詰まり感を解消)

  const stepRatios = usedSteps.map(s => s.kind === 'decision' ? DEC_R : PROC_R);
  const ratioTotal = TERM_R + stepRatios.reduce((a,b) => a+b, 0)
                     + GAP_R * (n + 1) + TERM_R;
  const unitH = (area.h - 0.20) / ratioTotal;

  // 上限を超えない範囲で実寸計算
  const terminatorH = Math.min(unitH * TERM_R, 0.60);
  const stepH = stepRatios.map(r => unitH * r);
  // gap には残った余白を全部使う
  const usedH = terminatorH * 2 + stepH.reduce((a,b) => a+b, 0);
  const finalArrowGap = (area.h - 0.20 - usedH) / (n + 1);

  // ── start ──
  let cursorY = area.y + 0.10;
  const startW = Math.min(mainW * 0.95, 3.40);
  const startNode = A.drawTerminator(slide,
    { x: mainCx - startW / 2, y: cursorY, w: startW, h: terminatorH },
    { kind: 'start', label: start.label || '開始', labelSize: 12 }, ctx);
  cursorY += terminatorH + finalArrowGap;

  // ── steps を先に位置確定 (anchor を作るため) ──
  const stepAnchors = [];
  usedSteps.forEach((step, i) => {
    let anchor;
    if (step.kind === 'decision') {
      // 菱形: 横長 (mainW の 78%、高さは 0.90")
      const dw = mainW * 0.72;
      const dh = stepH[i];
      anchor = A.drawDecision(slide,
        { x: mainCx - dw / 2, y: cursorY, w: dw, h: dh },
        { label: step.label || '', labelSize: step.labelSize || _pickDecisionLabelSize(step.label, dh) }, ctx);
    } else {
      const pw = mainW * 0.92;
      anchor = A.drawProcess(slide,
        { x: mainCx - pw / 2, y: cursorY, w: pw, h: stepH[i] },
        { label: step.label || '', labelSize: step.labelSize || _pickProcessLabelSize(step.label) }, ctx);
    }
    stepAnchors.push(anchor);
    cursorY += stepH[i] + finalArrowGap;
  });

  // ── end ──
  const endW = Math.min(mainW * 0.95, 3.40);
  const endNode = A.drawTerminator(slide,
    { x: mainCx - endW / 2, y: cursorY, w: endW, h: terminatorH },
    {
      kind: 'end',
      label: end.label || '完了',
      labelSize: 13,
    }, ctx);

  // ── side_results を steps の縦位置に合わせて配置 ──
  // 各 side_result は、それを参照する step の y 座標に揃える
  const sideAnchors = [];
  if (sideResults.length > 0) {
    // 各 side が attach されている step を引く: yes_to or no_to で { side: idx } を持つ step
    const attachMap = sideResults.map(() => []);
    usedSteps.forEach((step, sIdx) => {
      [step.yes_to, step.no_to].forEach(to => {
        if (to && typeof to === 'object' && Number.isInteger(to.side)) {
          attachMap[to.side].push(sIdx);
        }
      });
    });

    const sideH = 0.62;
    sideResults.forEach((sr, i) => {
      const attached = attachMap[i];
      // 平均 y 座標を取って、そこに side を配置
      let cy;
      if (attached.length > 0) {
        const ys = attached.map(idx => stepAnchors[idx].cy);
        cy = ys.reduce((a, b) => a + b, 0) / ys.length;
      } else {
        // attached なしフォールバック: 等間隔
        const baseY = area.y + 0.40 + (area.h - 0.80) * (i + 0.5) / sideResults.length;
        cy = baseY;
      }
      const sy = cy - sideH / 2;
      // 「離脱結果」を強調。線が情報を運ぶ方向にトーンを統一。
      const a = A.drawProcess(slide,
        { x: sideX, y: sy, w: sideW, h: sideH },
        {
          label: sr.label || '',
          kind: sr.kind || 'result-warn',
          labelSize: sr.labelSize || _pickSideResultLabelSize(sr.label),
          fill: 'canvas',
          stroke: 'highlight',
          textColor: 'highlightDeep',
          strokeWidth: 2.0,
          radius: 0.05,
        }, ctx);
      sideAnchors.push(a);
    });
  }

  // ── 矢印を描画 ──
  // start → step[0] (真下、ラベルなし)
  A.drawArrow(slide, startNode.bottom, stepAnchors[0].top,
    { color: 'gray700', width: 1.5 }, ctx);

  // 各 step の出口
  steps.forEach((step, i) => {
    const cur = stepAnchors[i];

    if (step.kind === 'decision') {
      const yesTo = step.yes_to || 'next';
      const noTo  = step.no_to  || 'next';

      // YES の行先
      _drawBranchArrow(slide, cur, yesTo, 'yes',
        { stepAnchors, sideAnchors, endNode, n }, ctx);
      // NO の行先
      _drawBranchArrow(slide, cur, noTo, 'no',
        { stepAnchors, sideAnchors, endNode, n }, ctx);
    } else {
      // process は素直に next へ
      const next = i + 1 < n ? stepAnchors[i + 1] : endNode;
      A.drawArrow(slide, cur.bottom, next.top,
        { color: 'gray700', width: 1.5 }, ctx);
    }
  });
}

/**
 * 判断ノードからの分岐矢印を描く。
 * to: 'next' | 'end' | { side: idx }
 * branch: 'yes' | 'no'
 *
 * 表現ルール:
 *   - 'next' (= 主軸): 真下に矢印 (decision の bottom → 次ノードの top)、
 *      ラベル (YES/NO) を矢印の根元側に乗せる
 *   - { side: idx }: decision の right → side_results[idx].left。L 字ではなく
 *      水平直線。side_results が menigoco に並ぶ配置でも崩れない
 *   - 'end': 真下から end ノードへ
 */
function _drawBranchArrow(slide, decisionAnchor, to, branch, refs, ctx) {
  const { stepAnchors, sideAnchors, endNode, n } = refs;
  const isYes = branch === 'yes';
  const kind = isYes ? 'yes' : 'no';
  const label = isYes ? 'YES' : 'NO';

  if (to === 'next' || (typeof to === 'object' && to.next)) {
    // 真下: decision.bottom → 次ノード.top
    // 次ノード = stepAnchors の自分の次 or endNode
    const idx = stepAnchors.indexOf(decisionAnchor);
    const next = idx + 1 < n ? stepAnchors[idx + 1] : endNode;
    // 真下方向は labelPos を 0.5 (矢印の中央) にして、ノードに被らないように
    A.drawDecisionFlow(slide, decisionAnchor.bottom, next.top,
      { kind, label, labelPos: 0.50 }, ctx);
  } else if (to === 'end') {
    A.drawDecisionFlow(slide, decisionAnchor.bottom, endNode.top,
      { kind, label, labelPos: 0.50 }, ctx);
  } else if (typeof to === 'object' && Number.isInteger(to.side)) {
    // 側方: decision.right → sideAnchors[to.side].left
    // 横向き矢印は起点側近く (0.18) にラベルを置いて視線が左→右に流れるように
    const sa = sideAnchors[to.side];
    if (!sa) return;
    A.drawDecisionFlow(slide, decisionAnchor.right, sa.left,
      { kind, label, labelPos: 0.30 }, ctx);
  }
}

/** メインの直線矢印 (decision 以外) */
function _drawMainArrow(slide, from, to, ctx) {
  A.drawArrow(slide, from, to, { color: 'brand', width: 1.75 }, ctx);
}

// ───────────────────────────────────────────────────────
// horizontal-flow (横一列に process が並ぶシンプルフロー)
// ───────────────────────────────────────────────────────
function _drawHorizontal(slide, sceneJson, area, ctx) {
  const start = sceneJson.start || {};
  const steps = sceneJson.steps || [];
  const end = sceneJson.end || {};
  const items = [{ kind: 'start', label: start.label || '開始' }, ...steps,
    { kind: 'end', label: end.label || '完了' }];
  const n = items.length;
  if (n === 0) return;

  const totalGap = (n - 1) * 0.30;
  const nodeW = (area.w * 0.95 - totalGap) / n;
  // Pill が映えるよう nodeH は横長比率で。
  // フルブリード時 (area.h ≈ 4.0+") は縦余裕があるが、Pill は横:縦=4:1 程度を目安に。
  const nodeH = Math.max(0.70, Math.min(area.h * 0.28, 1.20));
  const ny = area.y + (area.h - nodeH) / 2;
  const startX = area.x + (area.w - nodeW * n - totalGap) / 2;

  const anchors = items.map((it, i) => {
    const x = startX + i * (nodeW + 0.40);
    if (it.kind === 'start' || it.kind === 'end') {
      return A.drawTerminator(slide, { x, y: ny, w: nodeW, h: nodeH },
        { kind: it.kind, label: it.label, labelSize: 12 }, ctx);
    }
    return A.drawProcess(slide, { x, y: ny, w: nodeW, h: nodeH },
      { label: it.label, labelSize: 11 }, ctx);
  });

  for (let i = 0; i < n - 1; i++) {
    A.drawArrow(slide, anchors[i].right, anchors[i + 1].left,
      { color: 'brand', width: 1.75 }, ctx);
  }
}

// ───────────────────────────────────────────────────────
// simple-vertical (分岐無しの縦パイプライン)
// ───────────────────────────────────────────────────────
function _drawSimpleVertical(slide, sceneJson, area, ctx) {
  const start = sceneJson.start || {};
  const steps = sceneJson.steps || [];
  const end = sceneJson.end || {};
  const items = [{ kind: 'start', label: start.label || '開始' }, ...steps,
    { kind: 'end', label: end.label || '完了' }];
  const n = items.length;
  if (n === 0) return;

  const totalGap = (n - 1) * 0.30;
  const nodeH = Math.min((area.h * 0.90 - totalGap) / n, 0.65);
  const nodeW = Math.min(area.w * 0.55, 4.00);
  const cx = area.x + area.w / 2;
  const startY = area.y + (area.h - nodeH * n - totalGap) / 2;

  const anchors = items.map((it, i) => {
    const y = startY + i * (nodeH + 0.30);
    if (it.kind === 'start' || it.kind === 'end') {
      return A.drawTerminator(slide,
        { x: cx - nodeW / 2, y, w: nodeW, h: nodeH * 0.85 },
        { kind: it.kind, label: it.label, labelSize: 12 }, ctx);
    }
    return A.drawProcess(slide,
      { x: cx - nodeW / 2, y, w: nodeW, h: nodeH },
      { label: it.label, labelSize: 11 }, ctx);
  });

  for (let i = 0; i < n - 1; i++) {
    A.drawArrow(slide, anchors[i].bottom, anchors[i + 1].top,
      { color: 'brand', width: 1.75 }, ctx);
  }
}

module.exports = { drawScene06FlowChart };
