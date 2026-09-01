#!/usr/bin/env python3
"""Extract rough N1 vocabulary heads from the user-provided red book PDF.

The source PDF is treated as study material only. This script extracts compact
word metadata so the website can use original examples and UI copy.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pdfplumber


ENTRY_MARKERS = "□口ロ園圏圃囲國国闔阖飼闇陶麗顒隔團固冒躅瀬匱原貫MHIQSEB1!Il・•"
JAPANESE_WORD = r"〜～ぁ-んァ-ヶー一-龥々〆ヵヶ・･A-Za-z0-9/／＋+\-"
ACCENT_MARKS = "①②③④⑤⑥⑦⑧⑨⑩◎〇○⓪®©0-9（）() "


def normalize_ocr(text: str) -> str:
    replacements = {
        "〔": "（",
        "〈": "（",
        "〉": "）",
        "[": "［",
        "]": "］",
        "・": "•",
        "叮": "1］",
        "门": "1］",
        "□": "□",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = re.sub(r"動口", "動1］", text)
    text = re.sub(r"動□", "動1］", text)
    text = re.sub(r"畐1］", "副］", text)
    text = re.sub(r"［([^］\n]{1,18})(?:11|:1)(?=[\u3400-\u9fff])", r"［\1］", text)
    text = re.sub(r"［([^］\n]{1,18})1］", r"［\1］", text)
    text = text.replace("I:名", "［名")
    text = text.replace("［ナ形］1", "［ナ形］")
    return text


def clean_word(value: str) -> str:
    value = re.sub(rf"^[{re.escape(ENTRY_MARKERS)}\s]+", "", value)
    value = re.sub(r"^(?:原貫!?|匱］|IB!|Iffl|cm|陶|麗|顒|隔|團|固|冒|躅|瀬)+", "", value)
    value = value.replace("･", "・").replace("／", "/")
    value = re.sub(r"\s+", "", value)
    value = value.strip("・•,，.。:：;；")
    return value


def clean_reading(value: str | None) -> str:
    if not value:
        return ""
    value = value.replace("･", "・").replace("〇", "").replace("○", "")
    value = re.sub(r"[®©①②③④⑤⑥⑦⑧⑨⑩◎⓪0-9\s]", "", value)
    return value.strip("・•,，.。:：;；")


def clean_pos(value: str) -> str:
    value = value.replace("･", "・")
    value = re.sub(r"[®©①②③④⑤⑥⑦⑧⑨⑩◎⓪0-9\s]", "", value)
    value = value.strip("［］[]:：・•")
    return value


def clean_meaning(value: str) -> str:
    value = re.sub(r"\s+", " ", value)
    value = re.split(r"[△□口ロ園圏圃囲國国闔阖飼陶麗顒隔團固冒躅瀬]|\.{4,}|…{2,}|。/", value)[0]
    value = re.sub(r"[®©①②③④⑤⑥⑦⑧⑨⑩◎⓪]", "", value)
    value = re.sub(r"\b\d{3,5}\b", "", value)
    value = value.replace("〇", "").replace("○", "")
    value = value.strip(" ・•,，.。:：;；/／-—")
    return value


def looks_like_vocab(word: str, pos: str, meaning: str) -> bool:
    if len(word) < 1 or len(word) > 28:
        return False
    if not re.search(r"[ぁ-んァ-ヶー一-龥]", word):
        return False
    if not re.search(r"[名副接形動慣連]", pos):
        return False
    if not re.search(r"[\u3400-\u9fff]", meaning):
        return False
    if word.startswith("第") or "単元" in word:
        return False
    return True


def extract_entries(text: str) -> list[dict[str, str]]:
    text = normalize_ocr(text)
    pattern = re.compile(
        rf"(?P<lead>[{re.escape(ENTRY_MARKERS)}\s]{{0,8}})"
        rf"(?P<word>[{JAPANESE_WORD}]{{1,28}})"
        rf"(?:[（(](?P<reading>[^）)]{{1,36}})[）)])?"
        rf"[{ACCENT_MARKS}]{{0,16}}\s*"
        rf"［(?P<pos>[^］\n]{{1,24}})］"
        rf"(?P<meaning>.{{1,180}})",
        re.UNICODE,
    )

    entries: list[dict[str, str]] = []
    for match in pattern.finditer(text):
        word = clean_word(match.group("word"))
        reading = clean_reading(match.group("reading"))
        pos = clean_pos(match.group("pos"))
        meaning = clean_meaning(match.group("meaning"))
        if not looks_like_vocab(word, pos, meaning):
            continue
        entries.append(
            {
                "japanese": word,
                "reading": reading,
                "pos": pos,
                "zh": meaning,
            }
        )
    return entries


def dedupe(entries: list[dict[str, str]]) -> list[dict[str, str]]:
    by_key: dict[str, dict[str, str]] = {}
    for entry in entries:
        key = f"{entry['japanese']}|{entry.get('reading','')}"
        current = by_key.get(key)
        if current is None or len(entry["zh"]) > len(current["zh"]):
            by_key[key] = entry
    return list(by_key.values())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--start-page", type=int, default=14)
    parser.add_argument("--end-page", type=int, default=342)
    args = parser.parse_args()

    entries: list[dict[str, str]] = []
    with pdfplumber.open(args.pdf) as pdf:
        end_page = min(args.end_page, len(pdf.pages))
        for page_number in range(args.start_page, end_page + 1):
            text = pdf.pages[page_number - 1].extract_text(x_tolerance=1, y_tolerance=3) or ""
            for entry in extract_entries(text):
                entry["page"] = str(page_number)
                entries.append(entry)

    output = dedupe(entries)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {len(output)} vocabulary entries from {args.pdf.name}.")


if __name__ == "__main__":
    main()
