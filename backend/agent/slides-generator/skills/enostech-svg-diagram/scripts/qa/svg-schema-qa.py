#!/usr/bin/env python3
"""
svg-schema-qa.py — cloudDesign 流の制約セットを機械検証する SchemaQA

このスキル本体が責任を持つ全ルール。enostech-slides 側はこの結果を W チェック
する程度で、ルール詳細は持たない (本ファイルが唯一の正)。

検証ルール (詳細は references/design-rules.md):
  R-SVG-1:  色は 4 色まで (canvas 除く)                                fatal
  R-SVG-2:  stroke-width は 2 か 3 のみ                                fatal
  R-SVG-3:  <marker> は 1 種類だけ                                     fatal
  R-SVG-4:  viewBox 必須                                              fatal
  R-SVG-5:  stroke-dasharray は '4 4' のみ                            fatal
  R-SVG-6:  シェイプは rect/circle/line/polygon/ellipse/path のみ      fatal
  R-SVG-7:  フォントは Noto Sans JP / JetBrains Mono のみ              warn
  R-SVG-7b: コンマ区切り fallback リスト禁止 (v9.3)                     warn
  R-SVG-8:  テキストは他の塗り面・別テキストと bbox 衝突しない          fatal
  R-SVG-9:  brand+accent 塗り面積は viewBox の 30% 以下 (v1.14 緩和)    warn
  R-SVG-10: brand+accent 大塗り (面積 >= 3%) は 1 SVG に最大 4 個 v1.14 warn
  R-SVG-11: 強調は塗りより線。塗り強調は真の主役か?                    guideline (検証なし)
  R-SVG-12: ink 塗りは禁止 (代わりに gray800/700 でマイルド強調) v1.5  fatal
  R-SVG-15: 縦方向の充填率 60% 以上 (v1.14 緩和 75% → 60%)             warn
  R-SVG-13: フォントサイズ下限 v1.4 (本文 22 / 補足 18 / 注記 16 px)   fatal/warn
  R-SVG-14: 準強調は brand ではなく gray500/gray700 を優先 (ガイドライン) — 検証なし
  R-SVG-16: テキストを内包する rect/path に amber 系塗り (#F59E0B 系) 禁止 v1.8 fatal

使い方:
  python3 svg-schema-qa.py path/to/file.svg
  cat file.svg | python3 svg-schema-qa.py -

終了コード:
  0 = OK (warn のみは 0)
  2 = fatal あり
"""

import sys
import os
import re
import json
import argparse
from xml.etree import ElementTree as ET

# ───── 定数 ─────

ALLOWED_ELEMENTS = {
    'svg', 'g', 'defs', 'marker',
    'rect', 'circle', 'line', 'polygon', 'ellipse', 'path', 'text', 'tspan',
    'title', 'desc', 'style',
}

DISALLOWED_ELEMENTS_HINT = {
    'foreignObject': 'HTML 埋め込み禁止 (レンダラ依存大)',
    'filter': 'カスタム filter 禁止 (装飾過多)',
    'feGaussianBlur': 'カスタム filter 禁止',
    'feColorMatrix': 'カスタム filter 禁止',
    'image': '外部画像埋め込み禁止 (SVG の意味が無くなる)',
    'use': 'クロスファイル参照禁止',
    'pattern': '装飾パターン禁止',
    'mask': 'マスク装飾禁止',
    'clipPath': 'クリップパス禁止',
    'symbol': 'シンボル参照禁止',
    'linearGradient': 'グラデーション禁止 (フラット原則)',
    'radialGradient': 'グラデーション禁止 (フラット原則)',
}

ALLOWED_STROKE_WIDTHS = {'2', '3', '2.0', '3.0', '2px', '3px'}
ALLOWED_DASHARRAY = {'4 4', '4,4', '4, 4'}
ALLOWED_FONTS = {'Noto Sans JP', 'JetBrains Mono', 'sans-serif', 'monospace'}

CANVAS_DEFAULTS = {
    '#FAFAF7', '#fafaf7', 'fafaf7',
    '#FFFFFF', '#ffffff', 'ffffff', 'white',
}

# 色カテゴリ判定用 (面積比検査で使う)
INK_COLORS = {'#1f2937', '#1F2937'}
BRAND_COLORS = {'#f59e0b', '#F59E0B', '#b45309', '#B45309'}  # brand + accent

# R-SVG-16 用: amber 200〜700 の塗り禁止対象 (#FEF3C7 amber-100 は除外 = 薄背景は OK)
AMBER_FILL_BAN_HEX = {
    '#fcd34d', '#FCD34D',   # amber-300
    '#fbbf24', '#FBBF24',   # amber-400
    '#f59e0b', '#F59E0B',   # amber-500 (主役)
    '#d97706', '#D97706',   # amber-600
    '#b45309', '#B45309',   # amber-700
    '#92400e', '#92400E',   # amber-800
}

# テキスト bbox 概算用 (font-size px → 1 文字あたりの幅)
# 半角文字: font-size * 0.55, 全角文字: font-size * 1.0 で近似
ASCII_WIDTH_RATIO = 0.55
CJK_WIDTH_RATIO = 1.0

# ───── ヘルパー ─────

def strip_ns(tag):
    return tag.split('}', 1)[-1] if '}' in tag else tag


def parse_svg(svg_text):
    cleaned = re.sub(r'\sxmlns(:\w+)?="[^"]*"', '', svg_text)
    try:
        root = ET.fromstring(cleaned)
        return root
    except ET.ParseError:
        return None


def collect_all_elements(root):
    result = [root]
    for child in root.iter():
        if child is not root:
            result.append(child)
    return result


def normalize_color(c):
    if c is None:
        return None
    c = c.strip().lower()
    if c.startswith('#'):
        if len(c) == 4:
            c = '#' + c[1]*2 + c[2]*2 + c[3]*2
    return c


def parse_viewbox(root):
    """viewBox から (min_x, min_y, w, h) を返す。なければ None"""
    vb = root.get('viewBox') or root.get('viewbox')
    if not vb:
        return None
    parts = re.split(r'[,\s]+', vb.strip())
    if len(parts) != 4:
        return None
    try:
        return tuple(float(p) for p in parts)
    except ValueError:
        return None


def get_float(el, attr, default=0.0):
    v = el.get(attr)
    if v is None:
        return default
    try:
        return float(re.sub(r'[a-zA-Z]+$', '', v))
    except ValueError:
        return default


def is_cjk(ch):
    """日本語・中国語・韓国語の文字を判定 (簡易)"""
    code = ord(ch)
    return (
        0x3000 <= code <= 0x9FFF or   # CJK 統合漢字 + ひらがな + カタカナ
        0xFF00 <= code <= 0xFFEF      # 全角英数記号
    )


def estimate_text_width(text, font_size):
    """テキストの描画幅を概算"""
    if not text:
        return 0
    w = 0
    for ch in text:
        if is_cjk(ch):
            w += font_size * CJK_WIDTH_RATIO
        else:
            w += font_size * ASCII_WIDTH_RATIO
    return w


def get_text_bbox(el):
    """text 要素の bbox を概算で返す。戻り値: (x, y, w, h) or None
    text-anchor: middle/end/start を考慮"""
    text = (el.text or '').strip()
    # tspan も拾う
    for child in el:
        if strip_ns(child.tag) == 'tspan':
            text += (child.text or '').strip()
    if not text:
        return None
    x = get_float(el, 'x', 0)
    y = get_float(el, 'y', 0)
    font_size = get_float(el, 'font-size', 11)
    if font_size == 0:
        font_size = 11
    text_w = estimate_text_width(text, font_size)
    text_h = font_size * 1.2  # 行高は font-size の 1.2 倍で近似
    anchor = el.get('text-anchor', 'start')
    if anchor == 'middle':
        x -= text_w / 2
    elif anchor == 'end':
        x -= text_w
    # y は baseline。bbox の top は y - font_size * 0.85 くらい
    y_top = y - font_size * 0.85
    return (x, y_top, text_w, text_h)


def get_filled_shape_bbox(el):
    """塗りつぶしのある shape の bbox を返す。塗りなしなら None
    rect / circle / ellipse のみ対応 (path/polygon はパース複雑なのでスキップ)"""
    fill = el.get('fill')
    if not fill or fill == 'none' or fill == 'transparent':
        return None
    norm = normalize_color(fill)
    # canvas 系の塗りは「重なり」検出から除外 (背景塗りは bg なので衝突に意味がない)
    if norm in {normalize_color(c) for c in CANVAS_DEFAULTS}:
        return None
    tag = strip_ns(el.tag)
    if tag == 'rect':
        x = get_float(el, 'x', 0)
        y = get_float(el, 'y', 0)
        w = get_float(el, 'width', 0)
        h = get_float(el, 'height', 0)
        if w > 0 and h > 0:
            return (x, y, w, h)
    elif tag == 'circle':
        cx = get_float(el, 'cx', 0)
        cy = get_float(el, 'cy', 0)
        r = get_float(el, 'r', 0)
        if r > 0:
            return (cx - r, cy - r, r * 2, r * 2)
    elif tag == 'ellipse':
        cx = get_float(el, 'cx', 0)
        cy = get_float(el, 'cy', 0)
        rx = get_float(el, 'rx', 0)
        ry = get_float(el, 'ry', 0)
        if rx > 0 and ry > 0:
            return (cx - rx, cy - ry, rx * 2, ry * 2)
    return None


def bbox_overlap(b1, b2, tolerance=0):
    """2 つの bbox が重なるか。tolerance だけ縮めて判定 (端っこ接触は許容)"""
    if b1 is None or b2 is None:
        return False
    x1, y1, w1, h1 = b1
    x2, y2, w2, h2 = b2
    # tolerance 縮小
    x1 += tolerance; y1 += tolerance; w1 -= tolerance * 2; h1 -= tolerance * 2
    x2 += tolerance; y2 += tolerance; w2 -= tolerance * 2; h2 -= tolerance * 2
    if w1 <= 0 or h1 <= 0 or w2 <= 0 or h2 <= 0:
        return False
    # 重なり判定
    return not (x1 + w1 <= x2 or x2 + w2 <= x1 or y1 + h1 <= y2 or y2 + h2 <= y1)


def get_shape_area(el):
    """rect/circle/ellipse の塗り面積を返す。塗りなしなら 0"""
    fill = el.get('fill')
    if not fill or fill == 'none' or fill == 'transparent':
        return 0
    tag = strip_ns(el.tag)
    if tag == 'rect':
        w = get_float(el, 'width', 0)
        h = get_float(el, 'height', 0)
        return w * h
    elif tag == 'circle':
        r = get_float(el, 'r', 0)
        return 3.14159 * r * r
    elif tag == 'ellipse':
        rx = get_float(el, 'rx', 0)
        ry = get_float(el, 'ry', 0)
        return 3.14159 * rx * ry
    return 0


# ───── 既存の検査 (R-SVG-1〜7) ─────

def check_viewbox(root, errors):
    if not parse_viewbox(root):
        errors.append({'rule': 'R-SVG-4', 'severity': 'fatal',
                       'message': 'svg 要素に viewBox 属性がありません。論理座標で書くため必須です。'})


def check_disallowed_elements(elements, errors):
    for el in elements:
        tag = strip_ns(el.tag)
        if tag in DISALLOWED_ELEMENTS_HINT:
            errors.append({'rule': 'R-SVG-6', 'severity': 'fatal',
                           'message': f'禁止された要素 <{tag}> が使われています。{DISALLOWED_ELEMENTS_HINT[tag]}'})
        elif tag not in ALLOWED_ELEMENTS:
            errors.append({'rule': 'R-SVG-6', 'severity': 'fatal',
                           'message': f'許可されていない要素 <{tag}> が使われています。許可: {sorted(ALLOWED_ELEMENTS)}'})


def check_polygon_points(elements, errors):
    for el in elements:
        if strip_ns(el.tag) != 'polygon':
            continue
        pts = el.get('points', '')
        coords = re.findall(r'-?\d+\.?\d*', pts)
        n = len(coords) // 2
        if n < 3 or n > 4:
            errors.append({'rule': 'R-SVG-6', 'severity': 'fatal',
                           'message': f'<polygon> は 3-4 点のみ許可。現在 {n} 点。複雑形状は path で書いてください。'})


def check_stroke_widths(elements, errors):
    for el in elements:
        sw = el.get('stroke-width')
        style = el.get('style', '') or ''
        m = re.search(r'stroke-width\s*:\s*([^;]+)', style)
        if m:
            sw = sw or m.group(1).strip()
        if sw is None:
            continue
        if sw.strip() not in ALLOWED_STROKE_WIDTHS:
            tag = strip_ns(el.tag)
            errors.append({'rule': 'R-SVG-2', 'severity': 'fatal',
                           'message': f'<{tag}> の stroke-width="{sw}" は禁止。2 か 3 のみ許可。'})


def check_markers(root, errors):
    markers = []
    for el in root.iter():
        if strip_ns(el.tag) == 'marker':
            markers.append(el.get('id') or '(no id)')
    if len(markers) > 1:
        errors.append({'rule': 'R-SVG-3', 'severity': 'fatal',
                       'message': f'<marker> が {len(markers)} 個定義されています ({markers})。1 種類だけ定義し、線の色を変えて使い回してください。'})


def check_dasharray(elements, errors):
    for el in elements:
        da = el.get('stroke-dasharray')
        style = el.get('style', '') or ''
        m = re.search(r'stroke-dasharray\s*:\s*([^;]+)', style)
        if m:
            da = da or m.group(1).strip()
        if da is None:
            continue
        if da.strip() not in ALLOWED_DASHARRAY:
            tag = strip_ns(el.tag)
            errors.append({'rule': 'R-SVG-5', 'severity': 'fatal',
                           'message': f'<{tag}> の stroke-dasharray="{da}" は禁止。"4 4" のみ許可。'})


def check_color_count(elements, errors, palette=None):
    used = set()
    for el in elements:
        for attr in ('fill', 'stroke'):
            v = el.get(attr)
            if v and v not in ('none', 'transparent', 'currentColor'):
                norm = normalize_color(v)
                if norm and norm not in CANVAS_DEFAULTS:
                    used.add(norm)
        style = el.get('style', '') or ''
        for m in re.finditer(r'(fill|stroke)\s*:\s*([^;]+)', style):
            v = m.group(2).strip()
            if v not in ('none', 'transparent', 'currentColor'):
                norm = normalize_color(v)
                if norm and norm not in CANVAS_DEFAULTS:
                    used.add(norm)
    if len(used) > 4:
        errors.append({'rule': 'R-SVG-1', 'severity': 'fatal',
                       'message': f'同時使用色が {len(used)} 色 (canvas 除く)。4 色までに絞ってください。検出色: {sorted(used)}'})
    if palette:
        palette_set = {normalize_color(c) for c in palette.values()}
        for c in used:
            if c not in palette_set:
                errors.append({'rule': 'R-SVG-1', 'severity': 'warn',
                               'message': f'palette トークン外の色 {c} が使われています。palette 推奨。'})


def check_fonts(root, elements, errors):
    """R-SVG-7 (推奨外フォント warn) に加えて、v9.3 で R-SVG-7b を新設。

    R-SVG-7b: コンマ区切り fallback 値を含む font-family は warn。
        理由: enostech-slides の svg → png レンダラ (lib/svg-render.js) が
              font-family を単一値に正規化するため、わざわざコンマ区切りで
              書く必要がなく、書いてしまうと SVG ソース上で「fallback が
              効くつもりだったのに実は効かない」というギャップを残す。
              SVG ソース時点で単一値に揃えるのがブランド標準 (v9.3〜)。
    """
    fonts = set()
    ff = root.get('font-family')
    if ff:
        fonts.add(ff)
    for el in elements:
        ff = el.get('font-family')
        if ff:
            fonts.add(ff)
        style = el.get('style', '') or ''
        m = re.search(r'font-family\s*:\s*([^;]+)', style)
        if m:
            fonts.add(m.group(1).strip())
    for ff in fonts:
        ff_clean = ff.replace("'", '').replace('"', '')
        candidates = [c.strip() for c in ff_clean.split(',')]
        if not any(any(allowed.lower() in c.lower() for allowed in ALLOWED_FONTS) for c in candidates):
            errors.append({'rule': 'R-SVG-7', 'severity': 'warn',
                           'message': f'font-family "{ff}" は推奨外。Noto Sans JP / JetBrains Mono のみ推奨。'})
        # v9.3: コンマ区切りが含まれる = fallback リストになっている → warn
        if len(candidates) > 1:
            errors.append({'rule': 'R-SVG-7b', 'severity': 'warn',
                           'message': (
                               f'font-family "{ff}" にコンマ区切り fallback が含まれています。'
                               'enostech-slides v9.3 のレンダラは font-family を単一値に正規化するため '
                               'fallback は実質効きません。SVG ソース時点で `Noto Sans JP` のみに揃えてください。'
                           )})


# ───── 新ルール R-SVG-8: テキスト重なり検知 (v1.2 でコントラスト判定追加) ─────

# 色の輝度概算 (sRGB → 0-255 レンジで relative luminance)
def color_luminance(hex_color):
    """#RRGGBB から相対輝度 (0-1) を返す。簡易版 (sRGB ガンマ無視)。"""
    if not hex_color or not hex_color.startswith('#'):
        return 0.5  # 不明色
    h = hex_color.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    if len(h) != 6:
        return 0.5
    try:
        r = int(h[0:2], 16) / 255
        g = int(h[2:4], 16) / 255
        b = int(h[4:6], 16) / 255
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    except ValueError:
        return 0.5


def has_sufficient_contrast(text_color, bg_color, threshold=0.30):
    """テキスト色と背景色の輝度差が threshold 以上なら True (= 重ねて OK)。
    threshold 0.45 は WCAG 4.5:1 相当のラフ近似。白 (1.0) on slate-800 (0.13) → 0.87 で十分通る。"""
    lt = color_luminance(text_color)
    lb = color_luminance(bg_color)
    return abs(lt - lb) >= threshold


def check_text_overlap(elements, errors):
    """テキスト bbox と他の塗り面 bbox / 別テキスト bbox の衝突を検知。
    v1.2: コントラスト OK な重なり (白文字 on 黒塗り 等) は許容するように修正。"""
    text_bboxes = []  # (el, bbox, text_content)
    shape_bboxes = []  # (el, bbox, color_norm)

    for el in elements:
        tag = strip_ns(el.tag)
        if tag == 'text':
            bb = get_text_bbox(el)
            if bb:
                content = (el.text or '').strip()
                for child in el:
                    if strip_ns(child.tag) == 'tspan':
                        content += (child.text or '').strip()
                text_bboxes.append((el, bb, content[:30]))
        elif tag in ('rect', 'circle', 'ellipse'):
            bb = get_filled_shape_bbox(el)
            if bb:
                fill_norm = normalize_color(el.get('fill', ''))
                shape_bboxes.append((el, bb, fill_norm))

    # ① テキスト vs 塗り面
    for txt_el, txt_bb, txt_content in text_bboxes:
        txt_fill = normalize_color(txt_el.get('fill', '#1F2937'))
        for shape_el, shape_bb, shape_fill in shape_bboxes:
            if not bbox_overlap(txt_bb, shape_bb, tolerance=1):
                continue
            # v1.2: コントラスト判定 — 白文字 on 黒塗り のような明確なコントラストは許容
            if has_sufficient_contrast(txt_fill, shape_fill):
                continue
            errors.append({
                'rule': 'R-SVG-8',
                'severity': 'fatal',
                'message': (
                    f'テキスト "{txt_content}" (font={txt_fill}) が '
                    f'塗り面 <{strip_ns(shape_el.tag)} fill={shape_fill}> と重なり、コントラスト不足。'
                    f' テキスト座標 ({txt_bb[0]:.0f},{txt_bb[1]:.0f},{txt_bb[2]:.0f}x{txt_bb[3]:.0f}) '
                    f'塗り面座標 ({shape_bb[0]:.0f},{shape_bb[1]:.0f},{shape_bb[2]:.0f}x{shape_bb[3]:.0f})。'
                    f' 配置移動 / 文字色変更 / 塗り色変更 のいずれかで対処。'
                ),
            })

    # ② テキスト vs テキスト
    for i, (e1, b1, c1) in enumerate(text_bboxes):
        for j, (e2, b2, c2) in enumerate(text_bboxes):
            if i >= j:
                continue
            if bbox_overlap(b1, b2, tolerance=2):
                errors.append({
                    'rule': 'R-SVG-8',
                    'severity': 'fatal',
                    'message': (
                        f'テキスト同士が重なっています: "{c1}" と "{c2}"。'
                        f' どちらかを移動してください。'
                    ),
                })


# ───── 新ルール R-SVG-9, R-SVG-10, R-SVG-12: 塗り面積比 ─────

def check_fill_area_ratio(root, elements, errors):
    """brand/accent/ink の塗り面積を集計し、viewBox 全体に対する比率を判定"""
    vb = parse_viewbox(root)
    if not vb:
        return  # viewBox 検査で別途 fatal が出る
    _, _, vw, vh = vb
    total_area = vw * vh
    if total_area <= 0:
        return

    brand_total = 0
    ink_total = 0
    brand_large_count = 0  # 面積 >= 3% の brand 塗りの数 (R-SVG-10, v1.14 で 2% → 3% に緩和)

    for el in elements:
        if strip_ns(el.tag) not in ('rect', 'circle', 'ellipse'):
            continue
        fill = el.get('fill')
        if not fill or fill == 'none' or fill == 'transparent':
            continue
        norm = normalize_color(fill)
        area = get_shape_area(el)
        if area <= 0:
            continue
        ratio = area / total_area

        if norm in {normalize_color(c) for c in BRAND_COLORS}:
            brand_total += area
            if ratio >= 0.03:
                brand_large_count += 1
        elif norm in {normalize_color(c) for c in INK_COLORS}:
            ink_total += area

    # R-SVG-9 (v1.14 緩和): brand+accent 合算 30% 超で warn (旧: 15% で fatal)
    # 「曖昧でいいから調整に難儀しない程度に」という運用方針.
    # 15-30% は OK (guidance なし), 30-40% は warn (絵的に重い兆候), 40%超は強い warn.
    brand_ratio = brand_total / total_area
    if brand_ratio > 0.30:
        errors.append({
            'rule': 'R-SVG-9',
            'severity': 'warn',
            'message': (
                f'brand+accent の塗り面積比が {brand_ratio*100:.1f}% (目安 30% 以下).'
                f' オレンジ塗りが目立つので「強調 1-2 箇所だけ塗り、残りは線・薄黄カード」'
                f' で軽くするのが望ましいです (絶対 NG ではありません).'
            ),
        })

    # R-SVG-10 (v1.14 緩和): brand 大塗り 5 個超で warn (旧: 大塗り = 2% 以上が 3 個以上で warn)
    if brand_large_count > 4:
        errors.append({
            'rule': 'R-SVG-10',
            'severity': 'warn',
            'message': (
                f'brand+accent の大塗り (面積 ≥ 3%) が {brand_large_count} 個.'
                f' 「主役の主役」がボヤけるので、可能なら強い塗りは 2-3 箇所に絞ると視線誘導が利きます.'
            ),
        })

    # R-SVG-12 (v1.5): ink (#1F2937) 塗りは 全面禁止 → 代わりに gray800 (#374151) / gray700 (#4B5563)
    # ink は文字・線・輪郭のための色。塗り面に使うと真っ黒に見えて図全体の重心が歪む。
    # 強調塗りが必要な場面では「マイルドグレー」を使い、視覚的圧を 30% ほど抑える。
    ink_ratio = ink_total / total_area
    if ink_ratio > 0.005:  # ほぼ 0% (rounding 誤差を許容)
        errors.append({
            'rule': 'R-SVG-12',
            'severity': 'fatal',
            'message': (
                f'ink (#1F2937) の塗り面積比が {ink_ratio*100:.2f}% (上限 0.5%)。'
                f' ink は文字・線・輪郭の色であり、塗りに使うと真っ黒に見えて圧が強すぎます。'
                f' 塗りで強調したい場合は gray800 (#374151) か gray700 (#4B5563) を使ってください'
                f' (マイルドグレーで 30%% ほど圧を抑える)。淡い塗りなら gray100 (#F3F4F6) や'
                f' canvas (#FAFAF7) に置き換えてください。'
            ),
        })


# ───── 新ルール R-SVG-13 (v1.2): フォントサイズ下限 ─────

# viewBox 1840x820 (16:9 横長スライド) を pptx 9.20" x 4.10" に貼る前提で、
# 実際の表示サイズが「読める」最低ラインを下から強制する。
# pptx 9.20" = 約 880 SVG ピクセル相当 (scale 0.48)。
# v1.3 (1920x1080 viewBox / 9.20×4.95" 貼付):
# SVG 上の 14px → pptx 上 約 6.7px → ぎりぎり読める下限
# SVG 上の 18px → pptx 上 約 8.6px → 本文として安心
# SVG 上の 24px → pptx 上 約 11.5px → ノード本文の推奨サイズ
# SVG 上の 18px → pptx 上 8.6px → 約 10pt 相当 = 章タイトル下限
# v1.4 (2026-05-02) で再底上げ: 縮尺次第で 14px が潰れる事例があったため
# 視認性下限を更に 2px 引き上げ
FONT_SIZE_MIN_FATAL = 16   # これ未満は fatal (絶対読めない、v1.3: 14)
FONT_SIZE_MIN_WARN = 22    # これ未満は warn (本文として薄い、v1.3: 18)
FONT_SIZE_TITLE_RECOMMENDED = 18  # 章タイトル・大見出しの下限推奨

def check_font_size(elements, errors):
    """text / tspan の font-size 下限チェック (R-SVG-13)"""
    for el in elements:
        tag = strip_ns(el.tag)
        if tag not in ('text', 'tspan'):
            continue
        fs = get_float(el, 'font-size', 0)
        if fs == 0:
            # font-size 未指定は親から継承するので警告だけ
            continue
        text = (el.text or '').strip()
        snippet = text[:20] if text else '(空)'
        if fs < FONT_SIZE_MIN_FATAL:
            errors.append({
                'rule': 'R-SVG-13',
                'severity': 'fatal',
                'message': (
                    f'<{tag} font-size="{fs}"> "{snippet}" — '
                    f'最小 {FONT_SIZE_MIN_FATAL}px を下回ると pptx 表示時に読めません。'
                    f' 本文は 13px、補足は 12px、注記は 11px が下限。'
                ),
            })
        elif fs < FONT_SIZE_MIN_WARN:
            errors.append({
                'rule': 'R-SVG-13',
                'severity': 'warn',
                'message': (
                    f'<{tag} font-size="{fs}"> "{snippet}" — '
                    f'本文用としては薄すぎる。'
                    f' 本文 13px / 補足 12px / 注記 11px の使い分けを意識してください。'
                ),
            })


# ───── メイン ─────


# ───── 新ルール R-SVG-15 (v1.5): 縦方向の充填率 ─────
#
# SVG 内のコンテンツ ymin/ymax を集計し、viewBox 高さの何 % を使えているかを判定。
# 75% 未満は warn (下余白が大きすぎ、画面の下半分が無駄)。
# pptx に貼った時にスライドの下半分が真っ白になる事故を防ぐ。

VFILL_MIN_WARN = 0.60   # v1.14 緩和: 75% → 60%. これより下なら warn (調整に難儀しない程度の曖昧 guidance)

def check_vertical_fill(svg_root, viewBox, errors):
    """SVG 内の描画要素の bbox を集計し、縦方向の充填率を見る"""
    if not viewBox or len(viewBox) != 4:
        return
    vb_h = viewBox[3]
    if vb_h <= 0:
        return

    ymin, ymax = float('inf'), float('-inf')

    def update_y(el):
        nonlocal ymin, ymax
        tag = strip_ns(el.tag)
        # rect / circle / ellipse / line / polygon / path / text の bbox 上下
        if tag == 'rect':
            y = get_float(el, 'y', 0)
            h = get_float(el, 'height', 0)
            if h > 0:
                ymin = min(ymin, y)
                ymax = max(ymax, y + h)
        elif tag == 'circle':
            cy = get_float(el, 'cy', 0)
            r = get_float(el, 'r', 0)
            if r > 0:
                ymin = min(ymin, cy - r)
                ymax = max(ymax, cy + r)
        elif tag == 'ellipse':
            cy = get_float(el, 'cy', 0)
            ry = get_float(el, 'ry', 0)
            if ry > 0:
                ymin = min(ymin, cy - ry)
                ymax = max(ymax, cy + ry)
        elif tag == 'line':
            y1 = get_float(el, 'y1', 0)
            y2 = get_float(el, 'y2', 0)
            ymin = min(ymin, y1, y2)
            ymax = max(ymax, y1, y2)
        elif tag == 'text':
            y = get_float(el, 'y', 0)
            fs = get_float(el, 'font-size', 16)
            ymin = min(ymin, y - fs)
            ymax = max(ymax, y + fs * 0.3)
        # path / polygon は座標列パースが面倒なので集計はスキップ (大半は他要素でカバー)

    for el in svg_root.iter():
        update_y(el)

    if ymin == float('inf') or ymax == float('-inf'):
        return  # 何も検出できない

    used_h = ymax - ymin
    fill_ratio = used_h / vb_h
    if fill_ratio < VFILL_MIN_WARN:
        errors.append({
            'rule': 'R-SVG-15',
            'severity': 'warn',
            'message': (
                f'縦方向の充填率が {fill_ratio*100:.1f}% (目安 {VFILL_MIN_WARN*100:.0f}% 以上).'
                f' SECSUMMARY-1 など SVG 専用テンプレでは下余白が大きすぎると pptx 上で'
                f' 「未完成感」が出やすいです. 余裕があればコンテンツを縦に広げてください'
                f' (絶対 NG ではありません. 構図上必要な余白なら無視して OK).'
            ),
        })


# ───── 新ルール R-SVG-16 (v1.8): amber 塗り × text 内包 = fatal ─────
#
# 「テキストカード / コールアウトの背景に amber 塗り (例: #F59E0B / #B45309) を使うと
#  ダサい」という osanai さんの強い指摘 (2026-05-03 ベアフットデッキ SECSUMMARY-1) を
#  受けて新設。アンバーは stroke / 文字色 / 細帯 / 矢印 / アイコン fill のみで使う、
#  という決め事を機械強制する。
#
# 例外:
#   - rect 高さが AMBER_FILL_THIN_BAR_PX 未満 (薄帯・アンダーライン用途)
#   - rect 面積が AMBER_FILL_ICON_AREA_PX2 未満 (アイコン・チップ・badge)
#
# どちらも viewBox 1920x1080 を前提に決めている数値。viewBox が 16:9 でない場合は
# 幅 1920 相当に正規化して判定する。

AMBER_FILL_THIN_BAR_PX = 50           # 高さ < 50px は薄帯として許容
AMBER_FILL_ICON_AREA_PX2 = 1600       # 面積 < 1600 px² (≒ 40x40) はアイコンとして許容


def _amber_fill_normalize_scale(viewBox):
    """viewBox の幅を 1920 に正規化するスケール係数を返す。"""
    if not viewBox:
        return 1.0
    _, _, vw, _ = viewBox
    if vw <= 0:
        return 1.0
    return 1920.0 / vw


def _has_text_descendant(g_el):
    """要素以下のサブツリーに <text> があるか"""
    for sub in g_el.iter():
        if strip_ns(sub.tag) == 'text':
            return True
    return False


def _build_parent_map(root):
    """子→親 の辞書を作る"""
    return {child: parent for parent in root.iter() for child in parent}


def _text_inside_bbox(text_bboxes, target_bbox, tolerance=2):
    """text bbox のうち、target_bbox に内包/重なるものがあるか"""
    if not target_bbox:
        return False
    tx, ty, tw, th = target_bbox
    for _el, tb, _content in text_bboxes:
        if tb is None:
            continue
        cx = tb[0] + tb[2] / 2
        cy = tb[1] + tb[3] / 2
        if (tx - tolerance) <= cx <= (tx + tw + tolerance) and \
           (ty - tolerance) <= cy <= (ty + th + tolerance):
            return True
    return False


def check_amber_fill_on_text_box(root, elements, errors):
    """R-SVG-16: amber 塗りの rect/path で内側に text を含むものを fatal にする

    判定:
      1. fill が amber 系 (AMBER_FILL_BAN_HEX) の rect / path を抽出
      2. その要素の子 / 親 <g> の子に <text> があるか、
         または bbox 内に text 要素が物理的に重なるか をチェック
      3. 例外: 高さ < 50px (薄帯) / 面積 < 1600 px² (アイコン)
    """
    vb = parse_viewbox(root)
    scale = _amber_fill_normalize_scale(vb)
    parent_map = _build_parent_map(root)

    # 全 text bbox を一度集めておく (位置ベースの内包判定用)
    text_bboxes = []
    for el in elements:
        if strip_ns(el.tag) == 'text':
            bb = get_text_bbox(el)
            if bb:
                content = (el.text or '').strip()
                for child in el:
                    if strip_ns(child.tag) == 'tspan':
                        content += (child.text or '').strip()
                text_bboxes.append((el, bb, content[:30]))

    for el in elements:
        tag = strip_ns(el.tag)
        if tag not in ('rect', 'path'):
            continue
        fill = el.get('fill')
        if not fill or fill == 'none' or fill == 'transparent':
            continue
        norm = normalize_color(fill)
        if norm not in {normalize_color(c) for c in AMBER_FILL_BAN_HEX}:
            continue

        # bbox 取得 (rect のみ、path は座標パースが面倒なので親 <g> の text 有無で判定)
        bbox = None
        if tag == 'rect':
            x = get_float(el, 'x', 0)
            y = get_float(el, 'y', 0)
            w = get_float(el, 'width', 0)
            h = get_float(el, 'height', 0)
            if w > 0 and h > 0:
                bbox = (x, y, w, h)
                # 例外: 薄帯 (h < 50px / 1920基準) ならスキップ
                if h * scale < AMBER_FILL_THIN_BAR_PX:
                    continue
                # 例外: アイコン (面積 < 1600 px²) ならスキップ
                if (w * h) * (scale ** 2) < AMBER_FILL_ICON_AREA_PX2:
                    continue

        # text 内包判定:
        #   ① 親 <g> の子に <text> がある (構造的にカード化されている)
        #   ② bbox 内に text 要素が物理的に重なる (構造を組まずベタ書きしているケース)
        has_text = False
        parent = parent_map.get(el)
        if parent is not None and strip_ns(parent.tag) == 'g':
            for sib in parent:
                if strip_ns(sib.tag) == 'text':
                    has_text = True
                    break
        if not has_text and bbox is not None:
            has_text = _text_inside_bbox(text_bboxes, bbox)

        if has_text:
            loc = (
                f' rect ({bbox[0]:.0f},{bbox[1]:.0f},{bbox[2]:.0f}x{bbox[3]:.0f})'
                if bbox else f' <{tag}>'
            )
            errors.append({
                'rule': 'R-SVG-16',
                'severity': 'fatal',
                'message': (
                    f'amber 塗り fill="{fill}"{loc} の内側に <text> が含まれます。'
                    f' テキストカード / コールアウトの背景に amber を塗るのは禁止 (C-14)。'
                    f' 代わりに background = #FFFFFF / #FAFAF7 / #F5F5F4 / #1F2937 inverse のいずれかにし、'
                    f' amber は stroke / 文字色 / 矢印 / 細帯 (高さ < 50px) でだけ使ってください。'
                    f' light yellow #FEF3C7 (amber-100) + amber stroke + amber 文字 の組み合わせは可。'
                ),
            })



# ───── 新ルール R-SVG-18 (v1.9): 枠付きテキストボックスからのはみ出し ─────
R_SVG_18_PADDING_PX = 4
R_SVG_18_PADDING_PX_LOOSE = 2

def _has_stroke(el):
    s = el.get('stroke')
    return bool(s and s != 'none' and s != 'transparent')

def _rect_bbox_xyxy(el):
    if strip_ns(el.tag) != 'rect':
        return None
    x = get_float(el, 'x', 0); y = get_float(el, 'y', 0)
    w = get_float(el, 'width', 0); h = get_float(el, 'height', 0)
    if w <= 0 or h <= 0:
        return None
    return (x, y, x + w, y + h)

def _xyxy_from_xywh(b):
    x, y, w, h = b
    return (x, y, x + w, y + h)

def _bbox_contains_point(box, px, py):
    x1, y1, x2, y2 = box
    return x1 <= px <= x2 and y1 <= py <= y2

def _bbox_contains_inner(outer, inner, padding=0):
    ox1, oy1, ox2, oy2 = outer
    ix1, iy1, ix2, iy2 = inner
    return (ox1 + padding <= ix1 and oy1 + padding <= iy1
            and ix2 <= ox2 - padding and iy2 <= oy2 - padding)

def check_text_box_overflow(root, errors):
    """R-SVG-18: 枠付きテキストボックスからテキストがはみ出している"""
    candidates = []
    for el in root.iter():
        if strip_ns(el.tag) != 'rect':
            continue
        if not _has_stroke(el):
            continue
        b = _rect_bbox_xyxy(el)
        if not b:
            continue
        fill = el.get('fill') or 'none'
        is_loose = (fill == 'none'
                    or normalize_color(fill) in {normalize_color(c) for c in CANVAS_DEFAULTS})
        candidates.append((el, b, is_loose))

    for tel in root.iter():
        if strip_ns(tel.tag) != 'text':
            continue
        tb_xywh = get_text_bbox(tel)
        if tb_xywh is None:
            continue
        tb = _xyxy_from_xywh(tb_xywh)
        cx = (tb[0] + tb[2]) / 2.0
        cy = (tb[1] + tb[3]) / 2.0
        best = None
        best_area = float('inf')
        best_loose = False
        for rel, rb, loose in candidates:
            if not _bbox_contains_point(rb, cx, cy):
                continue
            area = (rb[2] - rb[0]) * (rb[3] - rb[1])
            if area < best_area:
                best_area = area
                best = rb
                best_loose = loose
        if best is None:
            continue
        padding = R_SVG_18_PADDING_PX_LOOSE if best_loose else R_SVG_18_PADDING_PX
        if not _bbox_contains_inner(best, tb, padding=padding):
            text_preview = (tel.text or '')[:30]
            errors.append({
                'rule': 'R-SVG-18',
                'severity': 'fatal',
                'message': (
                    f'枠付きテキストボックスからテキストがはみ出ています: '
                    f'"{text_preview}" '
                    f'(text=[{tb[0]:.0f},{tb[1]:.0f},{tb[2]:.0f},{tb[3]:.0f}], '
                    f'box=[{best[0]:.0f},{best[1]:.0f},{best[2]:.0f},{best[3]:.0f}], '
                    f'内側 padding={padding}px 必要)。'
                    f' rect の幅・高さを増やすか、font-size / 文字数を減らしてください。'
                ),
            })


# ───── 新ルール R-SVG-19 (v1.9): テキストと line / path / circle 周の重なり ─────
R_SVG_19_MARGIN_RATIO = 0.5
R_SVG_19_LEADER_TOLERANCE = 8.0

def _point_segment_distance(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5
    t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    nx, ny = x1 + t * dx, y1 + t * dy
    return ((px - nx) ** 2 + (py - ny) ** 2) ** 0.5

def _segments_intersect(p1, p2, p3, p4):
    """線分 p1-p2 と線分 p3-p4 が交差するか。共有端点を持つ場合は False。"""
    def ccw(a, b, c):
        return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0])
    return ccw(p1, p3, p4) != ccw(p2, p3, p4) and ccw(p1, p2, p3) != ccw(p1, p2, p4)

def _bbox_segment_min_distance(bbox_xyxy, x1, y1, x2, y2):
    bx1, by1, bx2, by2 = bbox_xyxy
    # 端点が bbox 内
    if bx1 <= x1 <= bx2 and by1 <= y1 <= by2:
        return 0.0
    if bx1 <= x2 <= bx2 and by1 <= y2 <= by2:
        return 0.0
    # 線分が bbox の 4 辺と交差するか
    p1 = (x1, y1); p2 = (x2, y2)
    bbox_corners = [(bx1, by1), (bx2, by1), (bx2, by2), (bx1, by2)]
    for i in range(4):
        a = bbox_corners[i]
        b = bbox_corners[(i + 1) % 4]
        if _segments_intersect(p1, p2, a, b):
            return 0.0
    # bbox の 4 頂点から線分への距離 + 線分端点から bbox 辺への距離を全部取る
    cands = [
        _point_segment_distance(bx1, by1, x1, y1, x2, y2),
        _point_segment_distance(bx2, by1, x1, y1, x2, y2),
        _point_segment_distance(bx1, by2, x1, y1, x2, y2),
        _point_segment_distance(bx2, by2, x1, y1, x2, y2),
    ]
    for ex, ey in [(x1, y1), (x2, y2)]:
        cx_ = max(bx1, min(bx2, ex))
        cy_ = max(by1, min(by2, ey))
        cands.append(((cx_ - ex) ** 2 + (cy_ - ey) ** 2) ** 0.5)
    return min(cands)

def _bbox_circle_min_distance(bbox_xyxy, cx, cy, r):
    """テキスト bbox と円周 (半径 r の円の周) の最短距離。
    判定: bbox の各頂点・各辺上の点で「円中心からの距離 d」を取り、
          d == r になりうる範囲があれば 0 (周がテキストを横切る)、
          全頂点 d < r ならテキストは円内側 (距離は r - max(d))、
          全頂点 d > r ならテキストは円外側 (距離は min(d) - r)。
    """
    bx1, by1, bx2, by2 = bbox_xyxy
    # bbox の 4 頂点と円中心の距離
    corners = [(bx1, by1), (bx2, by1), (bx1, by2), (bx2, by2)]
    dists = [((px - cx) ** 2 + (py - cy) ** 2) ** 0.5 for px, py in corners]
    # 円中心が bbox 内 → 円周は bbox 内側 (頂点 dist より小さい場合あり)
    inside = (bx1 <= cx <= bx2 and by1 <= cy <= by2)
    if inside:
        # 中心が bbox 内 = 0 から max(dists) までの全距離が bbox から円中心までの範囲
        # 円周は r。0 <= r <= max(dists) なら円周は bbox 内 (横切る)
        if r <= max(dists):
            return 0.0
        return r - max(dists)
    # bbox 外に円中心 → 全頂点が円内 (d < r) / 全頂点が円外 (d > r) / 混在 (周がよぎる)
    dmin, dmax = min(dists), max(dists)
    if dmin <= r <= dmax:
        return 0.0  # 周が bbox 内
    if dmax < r:
        return r - dmax  # bbox 全体が円内
    return dmin - r  # bbox 全体が円外

def _path_segments(d):
    if not d:
        return []
    tokens = re.findall(r'[MLZmlz]|-?\d+(?:\.\d+)?', d)
    segments = []
    cur = None; start = None; i = 0
    while i < len(tokens):
        t = tokens[i]
        if t in ('M', 'm'):
            if i + 2 < len(tokens):
                x = float(tokens[i + 1]); y = float(tokens[i + 2])
                if t == 'm' and cur is not None:
                    x += cur[0]; y += cur[1]
                cur = (x, y); start = cur; i += 3
            else:
                break
        elif t in ('L', 'l'):
            if i + 2 < len(tokens):
                x = float(tokens[i + 1]); y = float(tokens[i + 2])
                if t == 'l' and cur is not None:
                    x += cur[0]; y += cur[1]
                if cur is not None:
                    segments.append((cur[0], cur[1], x, y))
                cur = (x, y); i += 3
            else:
                break
        elif t in ('Z', 'z'):
            if cur is not None and start is not None and cur != start:
                segments.append((cur[0], cur[1], start[0], start[1]))
            cur = start; i += 1
        else:
            i += 1
    return segments

def check_text_line_collision(root, errors):
    """R-SVG-19: テキスト bbox と line / path 直線 / circle/ellipse 周の被り判定"""
    text_items = []
    for el in root.iter():
        if strip_ns(el.tag) != 'text':
            continue
        b_xywh = get_text_bbox(el)
        if b_xywh is None:
            continue
        b = _xyxy_from_xywh(b_xywh)
        font_size = get_float(el, 'font-size', 11)
        margin = font_size * R_SVG_19_MARGIN_RATIO
        text_items.append((el, b, font_size, margin))

    for el in root.iter():
        if strip_ns(el.tag) != 'line':
            continue
        x1 = get_float(el, 'x1', 0); y1 = get_float(el, 'y1', 0)
        x2 = get_float(el, 'x2', 0); y2 = get_float(el, 'y2', 0)
        for tel, tb, fs, margin in text_items:
            d = _bbox_segment_min_distance(tb, x1, y1, x2, y2)
            if d >= margin:
                continue
            text_preview = (tel.text or '')[:24]
            errors.append({
                'rule': 'R-SVG-19',
                'severity': 'fatal',
                'message': (
                    f'テキスト "{text_preview}" と <line> ({x1:.0f},{y1:.0f}-{x2:.0f},{y2:.0f}) '
                    f'が被っています (距離 {d:.1f}px、許容 {margin:.1f}px)。'
                    f' テキスト座標を {margin:.0f}px 以上ずらすか、線を別位置に動かしてください。'
                ),
            })

    for el in root.iter():
        tag = strip_ns(el.tag)
        if tag not in ('circle', 'ellipse'):
            continue
        fill = el.get('fill') or 'none'
        norm_fill = normalize_color(fill) if fill not in ('none', 'transparent') else 'none'
        if norm_fill != 'none' and norm_fill not in {normalize_color(c) for c in CANVAS_DEFAULTS}:
            continue
        cx = get_float(el, 'cx', 0); cy = get_float(el, 'cy', 0)
        if tag == 'circle':
            r = get_float(el, 'r', 0)
            if r <= 0:
                continue
            for tel, tb, fs, margin in text_items:
                d = _bbox_circle_min_distance(tb, cx, cy, r)
                if d >= margin:
                    continue
                text_preview = (tel.text or '')[:24]
                errors.append({
                    'rule': 'R-SVG-19',
                    'severity': 'fatal',
                    'message': (
                        f'テキスト "{text_preview}" と <circle> 周 (半径 {r:.0f}, 中心 {cx:.0f},{cy:.0f}) '
                        f'が被っています (距離 {d:.1f}px、許容 {margin:.1f}px)。'
                        f' テキストを円弧から {margin:.0f}px 以上離してください。'
                    ),
                })
        elif tag == 'ellipse':
            rx = get_float(el, 'rx', 0); ry = get_float(el, 'ry', 0)
            if rx <= 0 or ry <= 0:
                continue
            for tel, tb, fs, margin in text_items:
                bcx = (tb[0] + tb[2]) / 2.0
                bcy = (tb[1] + tb[3]) / 2.0
                ndx = (bcx - cx) / rx if rx else 0
                ndy = (bcy - cy) / ry if ry else 0
                test = ndx * ndx + ndy * ndy
                if 0.85 <= test <= 1.15:
                    text_preview = (tel.text or '')[:24]
                    errors.append({
                        'rule': 'R-SVG-19',
                        'severity': 'fatal',
                        'message': (
                            f'テキスト "{text_preview}" と <ellipse> 周 が被っています'
                            f' (中心 {cx:.0f},{cy:.0f}, rx={rx:.0f}, ry={ry:.0f})。'
                        ),
                    })

    for el in root.iter():
        if strip_ns(el.tag) != 'path':
            continue
        d_attr = el.get('d', '')
        for x1, y1, x2, y2 in _path_segments(d_attr):
            for tel, tb, fs, margin in text_items:
                d = _bbox_segment_min_distance(tb, x1, y1, x2, y2)
                if d >= margin:
                    continue
                text_preview = (tel.text or '')[:24]
                errors.append({
                    'rule': 'R-SVG-19',
                    'severity': 'fatal',
                    'message': (
                        f'テキスト "{text_preview}" と <path> セグメント '
                        f'({x1:.0f},{y1:.0f}-{x2:.0f},{y2:.0f}) が被っています'
                        f' (距離 {d:.1f}px、許容 {margin:.1f}px)。'
                    ),
                })



# ───── 新ルール R-SVG-20 (v1.10): box 系 rect の角丸推奨 ─────
R_SVG_20_MIN_W = 40
R_SVG_20_MIN_H = 30
R_SVG_20_MIN_RX = 4


def check_box_rounded_corners(root, errors):
    """R-SVG-20 (warn): box (textbox/card) サイズの rect に rx>=4 を推奨"""
    vb = parse_viewbox(root)
    vb_w = vb[2] if vb else 0
    vb_h = vb[3] if vb else 0
    for el in root.iter():
        if strip_ns(el.tag) != 'rect':
            continue
        w = get_float(el, 'width', 0)
        h = get_float(el, 'height', 0)
        if w < R_SVG_20_MIN_W or h < R_SVG_20_MIN_H:
            continue
        if vb_w and vb_h and w >= vb_w * 0.95 and h >= vb_h * 0.95:
            continue
        rx = get_float(el, 'rx', 0)
        ry = get_float(el, 'ry', 0)
        if rx >= R_SVG_20_MIN_RX or ry >= R_SVG_20_MIN_RX:
            continue
        x = get_float(el, 'x', 0); y = get_float(el, 'y', 0)
        errors.append({
            'rule': 'R-SVG-20',
            'severity': 'warn',
            'message': (
                f'box サイズ ({w:.0f}x{h:.0f}) の <rect> に角丸 (rx>={R_SVG_20_MIN_RX}) が指定されていません'
                f' (x={x:.0f}, y={y:.0f})。'
                f' 柔らかさを出すために rx="6" 〜 rx="12" を付けてください。'
                f' (薄帯やアイコンチップは width<{R_SVG_20_MIN_W} または height<{R_SVG_20_MIN_H} で除外)'
            ),
        })



# ───── 新ルール R-SVG-21 / R-SVG-22 (v1.11): Chips 比率 / Chip 横 padding ─────
#
# Chip 定義: 「rx >= height/3 (pill 型に近い) + 塗り (fill が canvas 以外) を持つ
#  rect」のうち、内側に text を内包しているもの。
#
# osanai 氏指針 (2026-05-08):
#  ① Chip 使いすぎ抑制: 全テキスト量の 10% 以下、0% も許容
#  ② Chip 横 padding: 詰まりすぎが見栄え悪いので fatal で強制

R_SVG_21_MAX_RATIO = 0.10           # Chip 内テキスト文字数 / 全テキスト文字数 の上限
R_SVG_22_PADDING_RATIO = 0.6        # 横 padding は font-size * 0.6 以上


def _detect_chips(root):
    """Chip と判定できる (rect, [内包 text 一覧]) のリストを返す。

    Chip 条件:
      - rect の fill が canvas 色 / none / transparent でない (= 塗り Chip)
      - rect の rx (or ry) >= height / 3
      - rect の width <= 600 (大きい card は Chip ではない)
      - rect 内側の中心点を text 中心が含む
    """
    chip_candidates = []
    for el in root.iter():
        if strip_ns(el.tag) != 'rect':
            continue
        fill = el.get('fill') or 'none'
        if fill in ('none', 'transparent'):
            continue
        norm = normalize_color(fill)
        if norm in {normalize_color(c) for c in CANVAS_DEFAULTS}:
            continue
        w = get_float(el, 'width', 0)
        h = get_float(el, 'height', 0)
        if w <= 0 or h <= 0 or w > 600:
            continue
        rx = get_float(el, 'rx', 0)
        ry = get_float(el, 'ry', 0)
        if max(rx, ry) < h / 3.0:
            continue
        x = get_float(el, 'x', 0); y = get_float(el, 'y', 0)
        chip_candidates.append((el, (x, y, x + w, y + h)))

    chips = []
    for cel, cbox in chip_candidates:
        bx1, by1, bx2, by2 = cbox
        contained_texts = []
        for tel in root.iter():
            if strip_ns(tel.tag) != 'text':
                continue
            tb_xywh = get_text_bbox(tel)
            if tb_xywh is None:
                continue
            tx, ty, tw, th = tb_xywh
            cx = tx + tw / 2.0
            cy = ty + th / 2.0
            if bx1 <= cx <= bx2 and by1 <= cy <= by2:
                contained_texts.append((tel, tb_xywh))
        if contained_texts:
            chips.append({'rect': cel, 'box': cbox, 'texts': contained_texts})
    return chips


def check_chips_ratio(root, chips, errors):
    """R-SVG-21 (fatal): Chip 内テキスト文字数 / 全テキスト文字数 が 10% 超で fatal"""
    total_chars = 0
    for tel in root.iter():
        if strip_ns(tel.tag) != 'text':
            continue
        s = (tel.text or '').strip()
        for child in tel:
            if strip_ns(child.tag) == 'tspan':
                s += (child.text or '').strip()
        total_chars += len(s)
    if total_chars == 0:
        return
    chip_chars = 0
    for chip in chips:
        for tel, _bb in chip['texts']:
            s = (tel.text or '').strip()
            for child in tel:
                if strip_ns(child.tag) == 'tspan':
                    s += (child.text or '').strip()
            chip_chars += len(s)
    ratio = chip_chars / total_chars
    if ratio > R_SVG_21_MAX_RATIO:
        errors.append({
            'rule': 'R-SVG-21',
            'severity': 'fatal',
            'message': (
                f'Chip 内テキスト比率が {ratio*100:.1f}% で上限 {R_SVG_21_MAX_RATIO*100:.0f}% を超過'
                f' (chip 内 {chip_chars} 文字 / 全体 {total_chars} 文字)。'
                f' Chip は「強調メッセージ」用なので使い過ぎは強調が利かなくなります。'
                f' 一部の Chip を太字 (font-weight 700) のプレーンテキストに格下げしてください。'
            ),
        })


def check_chip_horizontal_padding(chips, errors):
    """R-SVG-22 (fatal): Chip 内テキスト bbox の左右余白が font-size * 0.6 未満で fatal"""
    for chip in chips:
        bx1, by1, bx2, by2 = chip['box']
        for tel, tb_xywh in chip['texts']:
            tx, ty, tw, th = tb_xywh
            font_size = get_float(tel, 'font-size', 11)
            min_padding = font_size * R_SVG_22_PADDING_RATIO
            left_pad = tx - bx1
            right_pad = bx2 - (tx + tw)
            if left_pad >= min_padding and right_pad >= min_padding:
                continue
            content = (tel.text or '')[:24]
            errors.append({
                'rule': 'R-SVG-22',
                'severity': 'fatal',
                'message': (
                    f'Chip 内テキスト "{content}" の横 padding が不足'
                    f' (左 {left_pad:.1f}px / 右 {right_pad:.1f}px、必要 {min_padding:.1f}px 以上)。'
                    f' Chip rect の width を増やすか、文字数を減らしてください。'
                ),
            })


def validate_svg(svg_text, palette=None):
    errors = []
    root = parse_svg(svg_text)
    if root is None:
        return [{'rule': '_PARSE', 'severity': 'fatal', 'message': 'SVG をパースできませんでした (XML 構文エラー)'}]
    if strip_ns(root.tag) != 'svg':
        return [{'rule': '_ROOT', 'severity': 'fatal', 'message': f'ルート要素が <svg> ではなく <{strip_ns(root.tag)}>'}]

    elements = collect_all_elements(root)

    # R-SVG-1〜7 (既存)
    check_viewbox(root, errors)
    check_disallowed_elements(elements, errors)
    check_polygon_points(elements, errors)
    check_stroke_widths(elements, errors)
    check_markers(root, errors)
    check_dasharray(elements, errors)
    check_color_count(elements, errors, palette=palette)
    check_fonts(root, elements, errors)

    # R-SVG-8〜12 (v1.1 新設)
    check_text_overlap(elements, errors)
    check_fill_area_ratio(root, elements, errors)

    # R-SVG-13 (v1.2 新設): フォントサイズ下限
    check_font_size(elements, errors)

    # R-SVG-16 (v1.8 新設): amber 塗り × text 内包 = fatal
    check_amber_fill_on_text_box(root, elements, errors)

    # R-SVG-15 (v1.5 / 呼び出しは v1.9 で有効化): 縦方向の充填率 75% 以上
    viewBox = parse_viewbox(root)
    check_vertical_fill(root, viewBox, errors)

    # R-SVG-18 (v1.9 新設): 枠付きテキストボックスからテキストがはみ出している
    check_text_box_overflow(root, errors)

    # R-SVG-19 (v1.9 新設): テキストと line / path / circle 周の重なり
    check_text_line_collision(root, errors)

    # R-SVG-20 (v1.10 新設): box 系 rect には rx>=4 を持たせて柔らかさを出す
    check_box_rounded_corners(root, errors)

    # R-SVG-21 (v1.11 新設): Chips 強調比率は全テキストの 10% 以下
    # R-SVG-22 (v1.11 新設): Chip 内テキストの横 padding が font-size * 0.6 以上
    chips = _detect_chips(root)
    check_chips_ratio(root, chips, errors)
    check_chip_horizontal_padding(chips, errors)

    return errors


def load_palette(skill_dir):
    tokens_path = os.path.join(skill_dir, 'assets', 'tokens.json')
    if os.path.exists(tokens_path):
        with open(tokens_path, 'r', encoding='utf-8') as f:
            return json.load(f).get('palette', {})
    return None


def main():
    ap = argparse.ArgumentParser(description='cloudDesign 流の制約セットで SVG を検証')
    ap.add_argument('input', nargs='?', default='-')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--no-palette', action='store_true')
    args = ap.parse_args()

    if args.input == '-':
        svg_text = sys.stdin.read()
    else:
        with open(args.input, 'r', encoding='utf-8') as f:
            svg_text = f.read()

    skill_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    palette = None if args.no_palette else load_palette(skill_dir)

    errors = validate_svg(svg_text, palette=palette)
    fatals = [e for e in errors if e['severity'] == 'fatal']
    warns = [e for e in errors if e['severity'] == 'warn']

    if args.json:
        print(json.dumps({'fatals': len(fatals), 'warns': len(warns), 'errors': errors},
                         ensure_ascii=False, indent=2))
    else:
        if not errors:
            print('OK: 全制約をパス')
        else:
            for e in errors:
                marker = '✗' if e['severity'] == 'fatal' else '⚠'
                print(f'{marker} [{e["rule"]}] {e["message"]}')
            print(f'\n結果: fatal {len(fatals)} 件 / warn {len(warns)} 件')

    sys.exit(2 if fatals else 0)


if __name__ == '__main__':
    main()
