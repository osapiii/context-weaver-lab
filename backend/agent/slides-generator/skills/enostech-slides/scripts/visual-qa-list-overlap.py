#!/usr/bin/env python3
"""
VQA-25 detection — LIST-4 / LIST-1 / LIST-3 カード積み系の隣接カード重なり検出。
v9.30 新設。plan.json を読み、カード数とコンテンツ長から overlap risk を推定する。

usage:
  python3 visual-qa-list-overlap.py <plan.json> [<plan.json> ...]

exit code:
  0 — no fatal
  1 — fatal detected (overlap risk が高い)
"""
import json
import sys
from pathlib import Path

PRESETS = {
    3: dict(badge=48, title=16, spacer=8, body=11.5, gap=0.16, top_pad=0.10, bot_pad=0.05, inner_pad_y=0.10, max_body_lines=4, lsm=1.40),
    4: dict(badge=28, title=12, spacer=3, body=10,   gap=0.08, top_pad=0.04, bot_pad=0.02, inner_pad_y=0.05, max_body_lines=2, lsm=1.25),
    5: dict(badge=22, title=11, spacer=2, body=9,    gap=0.06, top_pad=0.03, bot_pad=0.02, inner_pad_y=0.04, max_body_lines=1, lsm=1.20),
    6: dict(badge=18, title=10, spacer=2, body=8.5,  gap=0.05, top_pad=0.02, bot_pad=0.02, inner_pad_y=0.03, max_body_lines=1, lsm=1.15),
}
DEFAULT_LSM = 1.40
CONTENT_Y = 1.65
CONTENT_BOT = 5.15
TEXT_W = 7.52  # ざっくり (10 - margin*2 - 2.0 inner 余白)


def line_inch(pt, lsm):
    return (pt / 72) * lsm


def get_preset(n):
    if n <= 3:
        return PRESETS[3]
    if n >= 6:
        return PRESETS[6]
    return PRESETS[n]


def estimate_body_lines(body, font_pt, text_w):
    if not body:
        return 0
    char_w = (font_pt * 0.92) / 72
    chars_per_line = max(8, int(text_w / char_w))
    return -(-len(body) // chars_per_line)  # ceil


def all_slides(plan):
    body = plan.get("body") or {}
    for ch in body.get("chapters") or []:
        for sec in ("head", "content", "tail"):
            for s in (ch.get(sec) or []):
                yield s


def check_list4(slide):
    """戻り値: (level, message) のリスト。level は 'fatal' or 'warn'."""
    issues = []
    cards = slide.get("cards") or []
    n = len(cards)
    if n == 0:
        return issues
    p = get_preset(n)
    total_h = (CONTENT_BOT - p["bot_pad"]) - (CONTENT_Y + p["top_pad"])
    card_h = (total_h - p["gap"] * (n - 1)) / n
    inner_h = card_h - p["inner_pad_y"] * 2
    sid = slide.get("id", "?")

    if n > 6:
        issues.append(("fatal", f"{sid} LIST-4 cards={n} > 6 / 切り詰め必須 (LIST-2 / LIST-5 を検討)"))

    lsm = p["lsm"]
    title_h = line_inch(p["title"], lsm)
    spacer_h = line_inch(p["spacer"], lsm)
    # badge は単一文字列なので em-height (LSM 抜き) で評価。'01' のような短い文字列は実際 ascender の 0.85em
    badge_h_em = (p["badge"] / 72) * 0.85
    # 隣接カード重なり判定の閾値: cardH (枠) を基準にし、視覚的安全マージン 0.04" を引いた値で評価。
    # inner_pad_y を超えても cardH 内部であれば隣のカードには侵食しないので fatal にしない。
    safe_h = max(card_h - 0.04, inner_h)

    if badge_h_em > safe_h:
        issues.append(("fatal", f"{sid} LIST-4 cards={n} badge {p['badge']}pt (em-h={badge_h_em:.2f}\") が cardH 安全域 {safe_h:.2f}\" を超過 (renderer 修正必要)"))

    # renderer 側と同じ動的キャップ計算 (fittedMaxLines)
    line_h = line_inch(p["body"], lsm)
    body_avail_h = max(line_h, inner_h - title_h - spacer_h)
    fitted_max_lines = max(1, min(p["max_body_lines"], int(body_avail_h / line_h)))

    for i, c in enumerate(cards):
        body = c.get("body") or ""
        body_lines = estimate_body_lines(body, p["body"], TEXT_W)
        # truncate 後 (renderer 側) は fitted_max_lines に制限される
        truncated_lines = min(body_lines, fitted_max_lines)
        truncated_h = title_h + spacer_h + truncated_lines * line_h

        # fatal: cardH (枠) 自体を超える → 隣接カードに侵食して読めない
        if truncated_h > card_h:
            issues.append(("fatal", f"{sid} LIST-4 card[{i}] (n={n}) truncated content_h={truncated_h:.2f}\" > cardH={card_h:.2f}\" / 隣接カードに侵食"))
        # warn: inner_h を超えるが cardH 内に収まる (badge と縦に重なる可能性は cardH 内なので軽微)
        elif truncated_h > inner_h * 1.05 and n >= 4:
            issues.append(("warn", f"{sid} LIST-4 card[{i}] (n={n}) truncated content_h={truncated_h:.2f}\" > inner_h={inner_h:.2f}\" — body 短縮を推奨"))
        elif len(body) > 120 and n >= 4:
            issues.append(("warn", f"{sid} LIST-4 card[{i}] body {len(body)} 字 / N={n} (compact mode) — 短縮または LIST-2 / LIST-5 推奨"))
    return issues


def main():
    if len(sys.argv) < 2:
        print("usage: visual-qa-list-overlap.py <plan.json> [...]", file=sys.stderr)
        sys.exit(2)
    fatal_count = 0
    warn_count = 0
    for path in sys.argv[1:]:
        try:
            plan = json.loads(Path(path).read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[ERROR] {path}: {e}", file=sys.stderr)
            continue
        for s in all_slides(plan):
            if s.get("template_id") != "LIST-4":
                continue
            for level, msg in check_list4(s):
                tag = f"[VQA-25 {level}]"
                print(f"{tag} {path}: {msg}")
                if level == "fatal":
                    fatal_count += 1
                else:
                    warn_count += 1
    print(f"\n--- VQA-25 summary: fatal={fatal_count}, warn={warn_count}")
    sys.exit(1 if fatal_count > 0 else 0)


if __name__ == "__main__":
    main()
