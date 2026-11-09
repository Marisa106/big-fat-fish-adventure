"""重建技术文档 PDF：打印封面 / 正文 → 回填目录页码 → 合并 → 加书签。

依赖（仅重建文档时需要，不影响游戏运行）：
  - Chrome / Edge
  - Python 3.10+ 与 pypdf（pip install pypdf）

用法：
  python docs/build_pdf.py
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
BUILD = DOCS / "build"
HTML = DOCS / "tech-doc.html"
COVER = DOCS / "cover.html"
COVER_PDF = BUILD / "cover.pdf"
BODY_PDF = BUILD / "body.pdf"
FINAL_PDF = DOCS / "大肥鱼历险记_技术文档.pdf"

CHAPTERS = [
    ("ch1", "第 1 章 项目与赛事定位", "WHAT WE BUILT"),
    ("ch2", "第 2 章 十分钟极速复现", "DEPENDENCIES · ENVIRONMENT"),
    ("ch3", "第 3 章 意图控制策略", "HOW CONTEXT"),
    ("ch4", "第 4 章 架构设计与约束", "WHAT ARCHITECTURE"),
    ("ch5", "第 5 章 可复现性论证", "ENVIRONMENT · RANDOMNESS"),
    ("ch6", "第 6 章 三次核心迭代的 Prompt 链", "PROMPT → AI PROPOSAL"),
    ("ch7", "第 7 章 开发者模式与验收路径", "ONE BUTTON"),
    ("ch8", "第 8 章 边界、风险与结论", "WHAT IS GUARANTEED"),
    ("appA", "附录 A 命令、变量与文件地图", "ONE-PAGE CHEAT"),
]


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True)


def print_pdfs() -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    run(["node", "docs/print_pdf.mjs", "cover", "docs/cover.html", "docs/build/cover.pdf"])
    run(["node", "docs/print_pdf.mjs", "body", "docs/tech-doc.html", "docs/build/body.pdf"])


def body_pages() -> list[str]:
    reader = PdfReader(str(BODY_PDF))
    return [(page.extract_text() or "").replace("\n", " ") for page in reader.pages]


def find_pages(pages: list[str]) -> dict[str, int]:
    found: dict[str, int] = {}
    for key, _title, needle in CHAPTERS:
        found[key] = next(
            (index + 1 for index, text in enumerate(pages) if index >= 2 and needle in text),
            0,
        )
    return found


def fill_toc(found: dict[str, int]) -> bool:
    html = HTML.read_text(encoding="utf-8")
    updated = html
    for key, page in found.items():
        if not page:
            continue
        updated = re.sub(
            r'(<span class="toc-page" data-ref="' + key + r'">)(?:—|\d+)(</span>)',
            r"\g<1>" + str(page) + r"\g<2>",
            updated,
        )
    if updated != html:
        HTML.write_text(updated, encoding="utf-8")
        return True
    return False


def merge(found: dict[str, int]) -> None:
    cover = PdfReader(str(COVER_PDF))
    body = PdfReader(str(BODY_PDF))
    writer = PdfWriter()
    for page in cover.pages:
        writer.add_page(page)
    for page in body.pages:
        writer.add_page(page)

    writer.add_metadata({
        "/Title": "大肥鱼历险记 · 技术文档",
        "/Author": "大肥鱼历险记项目组",
        "/Subject": "意图控制策略、架构设计与可复现性论证",
        "/Keywords": "DeepSeek, AI 素养, 回合制棋盘, 零依赖, 可复现性, Prompt 工程",
        "/Creator": "Chrome printToPDF + pypdf",
    })

    # 书签：封面、文档信息、目录、各章。正文第 n 页在合并后是第 n+1 页。
    writer.add_outline_item("封面", 0)
    writer.add_outline_item("文档信息", 1)
    writer.add_outline_item("目录", 2)
    for key, title, _needle in CHAPTERS:
        page = found.get(key)
        if page:
            writer.add_outline_item(title, page)  # body 第 page 页 = 合并后第 page+1 页，索引 page

    with FINAL_PDF.open("wb") as handle:
        writer.write(handle)
    writer.close()


def main() -> None:
    print_pdfs()
    pages = body_pages()
    found = find_pages(pages)
    print("found:", found)
    if fill_toc(found):
        print("TOC page numbers updated, reprinting body...")
        run(["node", "docs/print_pdf.mjs", "body", "docs/tech-doc.html", "docs/build/body.pdf"])
        pages = body_pages()
        found = find_pages(pages)
        print("remapped:", found)
    if not all(found.values()):
        raise SystemExit("Could not locate every chapter heading in the PDF.")
    merge(found)
    final = PdfReader(str(FINAL_PDF))
    print("final pages:", len(final.pages))
    print("final size:", round(FINAL_PDF.stat().st_size / 1024 / 1024, 2), "MB")


if __name__ == "__main__":
    main()
