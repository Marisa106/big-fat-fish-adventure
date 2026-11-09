# -*- coding: utf-8 -*-
"""构建战士·铁甲鱼（深海骑士）的待机立绘与攻击动画精灵图。

素材来源（原样读取，不重绘角色）：
    立绘  artifacts/knight_front.png（原图同哈希副本）
    动画  sources/characters/warrior_attack.mp4（24fps / 3.04s / 1244x1660）

输出：
    assets/warrior/portrait.png        原始立绘，字节完全一致，仅作留档
    assets/warrior/idle.png            透明背景立绘，与攻击帧同画布、同比例、同锚点
    assets/warrior/attack_sheet.webp   37 帧攻击精灵图（8 列 × 5 行）
    assets/warrior/attack_sheet.png    PNG 备用图集（体积较大，默认不加载）
    artifacts/warrior_attack_preview.gif  深色底预览

用法：
    python tools/build_warrior_assets.py
可选环境变量：
    FFMPEG  指定 ffmpeg.exe；默认自动搜索常见位置。
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "warrior")
ARTIFACT_DIR = os.path.join(ROOT, "artifacts")

PORTRAIT_SRC = os.path.join(ARTIFACT_DIR, "knight_front.png")
PORTRAIT_EXPECTED_SHA256 = "49eb6570d55f6a030e884f3bd35bd2d0a7ff43a54f050c7e8955a1603e94a488"
SOURCE_DIR = os.environ.get("BIGFISH_SOURCE_DIR", os.path.join(ROOT, "sources"))
VIDEO_SRC = os.path.join(SOURCE_DIR, "characters", "warrior_attack.mp4")

# 输出画布：与视频同比例（1244:1660 = 3:4），保证待机与攻击完全同尺度
FRAME_W, FRAME_H = 300, 400
COLS = 8
FPS = 12              # 棋子尺寸用 12fps 足够，体积约为 24fps 的一半
PLAYBACK_SPEED = 2.5  # 游戏内播放倍速，原片 3.04s → 约 1.23s
IMPACT_INDEX = 21     # 三叉戟劈到最低点的帧（原片 24fps 第 42 帧）
SPRITE_HEIGHT_TILES = 3.0   # 精灵画布高度（格）
FEET_AT_TILE_PCT = 0.82     # 脚底落在格子高度的 82% 处

FFMPEG_CANDIDATES = [
    os.environ.get("FFMPEG", ""),
    shutil.which("ffmpeg") or "",
]


def find_ffmpeg():
    for candidate in FFMPEG_CANDIDATES:
        if candidate and os.path.isfile(candidate):
            return candidate
    raise SystemExit("找不到 ffmpeg.exe，请设置 FFMPEG 环境变量。")


def sha256_of(path):
    import hashlib

    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def cutout_white_background(path):
    """去掉纯白背景，返回裁到角色包围盒的 RGBA 图。"""
    im = Image.open(path).convert("RGB")
    work = im.copy()
    # 从四角灌入洋红，标记与边缘连通的白色背景
    w, h = work.size
    for point in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(work, point, (255, 0, 255), thresh=40)
    marked = np.asarray(work)
    bg = (marked[:, :, 0] == 255) & (marked[:, :, 1] == 0) & (marked[:, :, 2] == 255)

    rgb = np.asarray(im).astype(np.int16)
    alpha = np.where(bg, 0, 255).astype(np.uint8)

    # 移除被角色包围的封闭白色空洞（呆毛环、三叉戟与身体之间等）
    near_white = (
        (rgb[:, :, 0] >= 247)
        & (rgb[:, :, 1] >= 247)
        & (rgb[:, :, 2] >= 247)
        & (rgb.max(axis=2) - rgb.min(axis=2) <= 4)
    )
    alpha[near_white] = 0

    out = Image.fromarray(np.dstack([np.asarray(im), alpha]), "RGBA")
    return out.crop(out.getbbox())


def green_key(rgb):
    """按绿色占比生成 alpha，并压制绿边。"""
    arr = rgb.astype(np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    dominance = g - np.maximum(r, b)
    alpha = np.clip((105.0 - dominance) / 75.0, 0.0, 1.0)

    # 只在半透明边缘压低绿色通道，避免出现绿边
    despilled = np.minimum(g, np.maximum(r, b) + 6.0)
    g2 = np.where(alpha < 0.995, despilled, g)
    return np.dstack([r, g2, b]).clip(0, 255).astype(np.uint8), alpha.astype(np.float32)


def alpha_bbox(alpha, threshold=0.08, min_count=24):
    mask = alpha > threshold
    xs = np.where(mask.sum(axis=0) >= min_count)[0]
    ys = np.where(mask.sum(axis=1) >= min_count)[0]
    return int(xs[0]), int(ys[0]), int(xs[-1]), int(ys[-1])


def premultiplied_resize(rgb, alpha, size):
    """带 alpha 的缩放，避免透明边缘发黑。"""
    prem = rgb.astype(np.float32) * alpha[:, :, None]
    prem_img = Image.fromarray(prem.clip(0, 255).astype(np.uint8), "RGB").resize(size, Image.LANCZOS)
    alpha_img = Image.fromarray((alpha * 255.0).clip(0, 255).astype(np.uint8), "L").resize(size, Image.LANCZOS)
    a = np.asarray(alpha_img).astype(np.float32) / 255.0
    p = np.asarray(prem_img).astype(np.float32)
    safe = np.maximum(a, 1e-3)[:, :, None]
    out = np.where(a[:, :, None] > 1e-3, p / safe, 0.0)
    return np.dstack([out.clip(0, 255), a * 255.0]).astype(np.uint8)


def extract_frames(ffmpeg, video, out_dir):
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            video,
            "-vf",
            "fps=" + str(FPS),
            "-vsync",
            "0",
            os.path.join(out_dir, "f_%03d.png"),
        ],
        check=True,
    )
    frames = sorted(
        os.path.join(out_dir, name) for name in os.listdir(out_dir) if name.lower().endswith(".png")
    )
    if not frames:
        raise SystemExit("没有从视频里抽出任何帧。")
    return frames


def main():
    if not os.path.isfile(PORTRAIT_SRC):
        raise SystemExit("缺少立绘：" + PORTRAIT_SRC)
    if not os.path.isfile(VIDEO_SRC):
        raise SystemExit("缺少攻击动画视频：" + VIDEO_SRC)
    actual = sha256_of(PORTRAIT_SRC)
    if actual != PORTRAIT_EXPECTED_SHA256:
        print("[warn] 立绘哈希与预期不同：", actual)
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(ARTIFACT_DIR, exist_ok=True)

    # 1) 原图留档（字节完全一致）
    shutil.copyfile(PORTRAIT_SRC, os.path.join(OUT_DIR, "portrait.png"))
    print("立绘：", Image.open(PORTRAIT_SRC).size, "->", "assets/warrior/portrait.png")

    cut = cutout_white_background(PORTRAIT_SRC)
    print("立绘抠图包围盒：", cut.size)

    # 2) 抽帧
    ffmpeg = find_ffmpeg()
    temp_dir = tempfile.mkdtemp(prefix="warrior_atk_")
    try:
        frames = extract_frames(ffmpeg, VIDEO_SRC, temp_dir)
        print("攻击帧：", len(frames), "帧 @", FPS, "fps")

        raw0 = Image.open(frames[0]).convert("RGB")
        if raw0.size != (1244, 1660):
            print("[warn] 视频帧尺寸不是预期的 1244x1660：", raw0.size)
        rgb0, alpha0 = green_key(np.asarray(raw0))
        video_bbox = alpha_bbox(alpha0)
        video_char_w = video_bbox[2] - video_bbox[0] + 1
        video_char_h = video_bbox[3] - video_bbox[1] + 1
        print("视频首帧角色包围盒：", video_bbox, "尺寸：", video_char_w, "x", video_char_h)

        # 视频坐标 -> 输出画布坐标
        video_scale = FRAME_H / raw0.size[1]
        canvas_center_x = FRAME_W / 2.0
        feet_y = video_bbox[3] * video_scale

        # 待机立绘缩放到与视频角色同高，脚底对齐同一位置
        idle_scale = (video_char_h * video_scale) / cut.size[1]
        idle_size = (max(1, round(cut.size[0] * idle_scale)), max(1, round(cut.size[1] * idle_scale)))
        idle_resized = cut.resize(idle_size, Image.LANCZOS)
        idle_canvas = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        idle_canvas.alpha_composite(
            idle_resized,
            (
                round(canvas_center_x - idle_resized.size[0] / 2.0),
                round(feet_y - idle_resized.size[1]),
            ),
        )
        idle_canvas.save(os.path.join(OUT_DIR, "idle.png"))
        print("待机立绘：", idle_size, "-> assets/warrior/idle.png")

        # 头像：从同一张抠图里取头顶到胸口，正方形，用于职业卡与侧栏
        side = min(cut.size[0], cut.size[1])
        icon = cut.crop((0, 0, side, side)).resize((240, 240), Image.LANCZOS)
        icon.save(os.path.join(OUT_DIR, "icon.png"))

        # 3) 逐帧抠绿、缩放、拼图集
        cell_w, cell_h = FRAME_W, FRAME_H
        sheet = Image.new("RGBA", (cell_w * COLS, cell_h * ((len(frames) + COLS - 1) // COLS)), (0, 0, 0, 0))
        for index, frame_path in enumerate(frames):
            rgb = np.asarray(Image.open(frame_path).convert("RGB"))
            keyed, alpha = green_key(rgb)
            rgba = premultiplied_resize(keyed, alpha, (cell_w, cell_h))
            cell = Image.fromarray(rgba, "RGBA")
            sheet.alpha_composite(cell, ((index % COLS) * cell_w, (index // COLS) * cell_h))
            if index == 0:
                # 对比：首帧攻击姿势应与待机立绘基本重合
                diff = Image.new("RGBA", (FRAME_W * 2, FRAME_H), (11, 26, 23, 255))
                diff.alpha_composite(idle_canvas, (0, 0))
                diff.alpha_composite(cell, (FRAME_W, 0))
                diff.convert("RGB").save(os.path.join(ARTIFACT_DIR, "warrior_idle_vs_attack0.png"))

        sheet.save(os.path.join(OUT_DIR, "attack_sheet.webp"), "WEBP", quality=90, method=6)
        sheet.save(os.path.join(OUT_DIR, "attack_sheet.png"), "PNG", optimize=True)
        print(
            "攻击图集：",
            sheet.size,
            "webp",
            os.path.getsize(os.path.join(OUT_DIR, "attack_sheet.webp")) // 1024,
            "KB / png",
            os.path.getsize(os.path.join(OUT_DIR, "attack_sheet.png")) // 1024,
            "KB",
        )

        # 4) 深色底 GIF 预览（12fps 原速）
        preview_frames = []
        for index in range(len(frames)):
            cell = sheet.crop(
                (
                    (index % COLS) * cell_w,
                    (index // COLS) * cell_h,
                    (index % COLS) * cell_w + cell_w,
                    (index // COLS) * cell_h + cell_h,
                )
            )
            flat = Image.new("RGBA", (cell_w // 2, cell_h // 2), (11, 26, 23, 255))
            flat.alpha_composite(cell.resize((cell_w // 2, cell_h // 2), Image.LANCZOS), (0, 0))
            preview_frames.append(flat.convert("RGB"))
        preview_frames[0].save(
            os.path.join(ARTIFACT_DIR, "warrior_attack_preview.gif"),
            save_all=True,
            append_images=preview_frames[1:],
            duration=int(1000 / FPS),
            loop=0,
            optimize=True,
        )

        meta = {
            "sourceImage": "artifacts/knight_front.png",
            "sourceImageSha256": actual,
            "sourceVideo": "sources/characters/warrior_attack.mp4",
            "frameWidth": FRAME_W,
            "frameHeight": FRAME_H,
            "cols": COLS,
            "rows": (len(frames) + COLS - 1) // COLS,
            "frames": len(frames),
            "fps": FPS,
            "playbackSpeed": PLAYBACK_SPEED,
            "impactFrame": IMPACT_INDEX,
            "spriteHeightTiles": SPRITE_HEIGHT_TILES,
            "feetAtTilePct": FEET_AT_TILE_PCT,
            "footY": round(feet_y, 1),
            "footFraction": round(feet_y / FRAME_H, 5),
            "characterHeightPx": round(video_char_h * video_scale, 1)
        }
        with open(os.path.join(OUT_DIR, "warrior.json"), "w", encoding="utf-8") as handle:
            json.dump(meta, handle, ensure_ascii=False, indent=2)
        print(json.dumps(meta, ensure_ascii=False, indent=2))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
