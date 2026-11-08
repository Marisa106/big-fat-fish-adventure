# -*- coding: utf-8 -*-
"""构建魔法师·灵光鱼（蓝发女仆法师）的待机立绘与攻击动画精灵图。

素材来源（原样读取，不重绘角色）：
    立绘   D:\\传智杯用\\图片\\角色\\20261108_gpt-image-2_01.png（1536x2048，白底）
    动画   D:\\传智杯用\\图片\\角色\\kling_20261108_作品__参考图_以上传的Q_83_0.mp4
           （836x1116，24fps，3.04s，白→绿渐变背景）

输出（assets/mage/）：
    portrait.png        原始立绘，字节完全一致，仅作留档
    idle.png            透明背景立绘，与攻击帧同画布、同比例、同锚点
    icon.png            头像（职业卡 / 侧栏）
    attack_sheet.webp   37 帧攻击精灵图（8 列 × 5 行，12fps）
    attack_sheet.png    PNG 备用图集
    mage.json           元数据（尺寸 / 帧率 / 命中帧 / 锚点）
    artifacts/mage_attack_preview.gif  深色底预览

用法：
    python tools/build_mage_assets.py
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
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "mage")
ARTIFACT_DIR = os.path.join(ROOT, "artifacts")

PORTRAIT_SRC = r"D:\传智杯用\图片\角色\20261108_gpt-image-2_01.png"
VIDEO_SRC = r"D:\传智杯用\图片\角色\kling_20261108_作品__参考图_以上传的Q_83_0.mp4"

FRAME_W, FRAME_H = 300, 400
COLS = 8
FPS = 12                # 24fps 原片抽一半，棋子尺寸足够
PLAYBACK_SPEED = 2.5    # 3.04s → 约 1.38s，节奏接近战士
CHAR_TILES = 1.60   # 角色在棋盘上的身高（格），与战士·铁甲鱼的 1.6 格对齐
FEET_AT_TILE_PCT = 0.82

FFMPEG_CANDIDATES = [
    os.environ.get("FFMPEG", ""),
    r"C:\Users\Yuan106\.dsh-wallpaper-engine\ffmpeg\ffmpeg.exe",
    r"C:\Users\Yuan106\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\ffmpeg\ffmpeg.exe",
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


def feather(alpha, radius=0.8):
    """0/255 硬边 → 1px 柔边，避免锯齿。"""
    img = Image.fromarray(alpha.astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(radius))
    a = np.asarray(img).astype(np.float32) / 255.0
    a = np.clip((a - 0.12) / 0.82, 0.0, 1.0)
    return (a * 255.0).astype(np.uint8)


def cutout_white_background(path):
    """抠白底：从四角灌入洋红，只删与画面边缘连通的白色。

    不做“删除所有近白像素”，否则围裙、蕾丝、白袜会被打穿。
    """
    im = Image.open(path).convert("RGB")
    work = im.copy()
    w, h = work.size
    for point in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(work, point, (255, 0, 255), thresh=26)
    marked = np.asarray(work)
    bg = (marked[:, :, 0] == 255) & (marked[:, :, 1] == 0) & (marked[:, :, 2] == 255)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    alpha = feather(alpha, 0.9)
    out = Image.fromarray(np.dstack([np.asarray(im), alpha]), "RGBA")
    return out.crop(out.getbbox())


def key_frame(rgb, edge_fade=0.07):
    """按每帧背景中位数抠图（视频背景在白→绿渐变，不能写死颜色）。

    两条通道合并：
      1) 与画面边缘连通的“背景色”区域 → 去白底/淡绿底，围裙白蕾丝不会被误删；
      2) 全局绿键 → 去掉被特效围住的绿色（水环内圈、闪光混色）。
    另外对画面边缘做 alpha 收边，柔化视频里被画幅切断的水环。
    """
    h, w, _ = rgb.shape
    border = np.concatenate(
        [
            rgb[:4].reshape(-1, 3),
            rgb[-4:].reshape(-1, 3),
            rgb[:, :4].reshape(-1, 3),
            rgb[:, -4:].reshape(-1, 3),
        ]
    )
    bg = np.median(border, axis=0)
    d = np.linalg.norm(rgb.astype(np.float32) - bg, axis=2)
    near = d < 24.0

    # Pillow 12 里 fromarray 出来的是只读图，floodfill 会静默失败 → 必须 copy
    binary = Image.fromarray((near * 255).astype(np.uint8), "L").copy()
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(binary, seed, 128, thresh=4)
    reach = np.asarray(binary) == 128

    arr = rgb.astype(np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    gmax = g - np.maximum(r, b)
    a_green = np.clip((62.0 - gmax) / 42.0, 0.0, 1.0)

    alpha = np.where(reach, 0.0, 1.0) * a_green

    yy, xx = np.mgrid[0:h, 0:w]
    fx = np.clip(np.minimum(xx, w - 1 - xx) / (w * edge_fade), 0.0, 1.0)
    fy = np.clip(np.minimum(yy, h - 1 - yy) / (h * edge_fade), 0.0, 1.0)
    alpha *= (fx * fy) ** 0.6

    alpha = np.asarray(
        Image.fromarray((alpha * 255.0).clip(0, 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(0.6))
    ).astype(np.float32)

    # 去绿边（只在绿偏强的像素压绿通道，蓝/青不受影响）
    g2 = np.where(gmax > 6, np.maximum(r, b) + 6.0, g)
    return np.dstack([r, np.minimum(g2, 255.0), b]).clip(0, 255).astype(np.uint8), alpha / 255.0


def alpha_bbox(alpha, threshold=0.06, min_count=12):
    mask = alpha > threshold
    xs = np.where(mask.sum(axis=0) >= min_count)[0]
    ys = np.where(mask.sum(axis=1) >= min_count)[0]
    if not len(xs) or not len(ys):
        return 0, 0, alpha.shape[1] - 1, alpha.shape[0] - 1
    return int(xs[0]), int(ys[0]), int(xs[-1]), int(ys[-1])


def premultiplied_resize(rgb, alpha, size):
    """alpha 为 0..1 浮点；预乘后缩放，避免透明边缘发黑。"""
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
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    sha = sha256_of(PORTRAIT_SRC)

    shutil.copyfile(PORTRAIT_SRC, os.path.join(OUT_DIR, "portrait.png"))
    print("立绘：", Image.open(PORTRAIT_SRC).size, "-> assets/mage/portrait.png")

    cut = cutout_white_background(PORTRAIT_SRC)
    print("立绘抠图：", cut.size)

    ffmpeg = find_ffmpeg()
    # 不用 tempfile.mkdtemp：Windows 下它给目录加的限制性 ACL 会让 ffmpeg 写不进去
    temp_dir = os.path.join(ARTIFACT_DIR, "_mage_frames_tmp")
    shutil.rmtree(temp_dir, ignore_errors=True)
    os.makedirs(temp_dir, exist_ok=True)
    try:
        frames = extract_frames(ffmpeg, VIDEO_SRC, temp_dir)
        print("攻击帧：", len(frames), "帧 @", FPS, "fps")

        keyed = []
        for path in frames:
            rgb = np.asarray(Image.open(path).convert("RGB"))
            rgb2, alpha = key_frame(rgb)
            keyed.append((rgb2, alpha))

        # 全片并集包围盒（含法阵 / 冲击环），保证特效不被裁切
        boxes = [alpha_bbox(a) for _, a in keyed]
        ux0 = min(b[0] for b in boxes)
        uy0 = min(b[1] for b in boxes)
        ux1 = max(b[2] for b in boxes)
        uy1 = max(b[3] for b in boxes)
        union_w, union_h = ux1 - ux0 + 1, uy1 - uy0 + 1
        print("并集包围盒：", (ux0, uy0, ux1, uy1), "尺寸：", union_w, "x", union_h)

        # 待机帧（第 1 帧）的角色包围盒 → 决定“角色身高”
        cb = alpha_bbox(keyed[0][1])
        char_h_src = cb[3] - cb[1] + 1
        char_w_src = cb[2] - cb[0] + 1
        print("首帧角色：", cb, "尺寸：", char_w_src, "x", char_h_src)

        # 视频像素 → 画布像素
        scale = min((FRAME_W * 0.98) / union_w, (FRAME_H * 0.96) / union_h)
        char_h_canvas = char_h_src * scale
        off_x = round(FRAME_W / 2.0 - (ux0 + ux1 + 1) / 2.0 * scale)
        off_y = round(FRAME_H / 2.0 - (uy0 + uy1 + 1) / 2.0 * scale)
        # 脚底锚点取“首帧角色包围盒底边”，水环/法阵允许溢出到格子下方
        feet_canvas = (cb[3] + 1) * scale + off_y
        print("缩放：%.4f 角色高：%.1fpx 脚底 y=%.1f" % (scale, char_h_canvas, feet_canvas))

        # 待机立绘缩放到与视频角色同高
        idle_scale = char_h_canvas / cut.size[1]
        idle_size = (max(1, round(cut.size[0] * idle_scale)), max(1, round(cut.size[1] * idle_scale)))
        idle_canvas = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        idle_canvas.alpha_composite(
            cut.resize(idle_size, Image.LANCZOS),
            (round(FRAME_W / 2.0 - idle_size[0] / 2.0), round(feet_canvas - idle_size[1])),
        )
        idle_canvas.save(os.path.join(OUT_DIR, "idle.png"))
        print("待机立绘：", idle_size, "-> assets/mage/idle.png")

        # 头像：头顶到胸口
        side = min(cut.size[0], int(cut.size[1] * 0.55))
        icon = cut.crop((0, 0, side, side)).resize((240, 240), Image.LANCZOS)
        icon.save(os.path.join(OUT_DIR, "icon.png"))

        # 逐帧合成到画布（整帧按同一映射落位，脚底锚点与待机立绘一致）
        cells = []
        for rgb2, alpha in keyed:
            rgba = premultiplied_resize(rgb2, alpha, (round(rgb2.shape[1] * scale), round(rgb2.shape[0] * scale)))
            cell_img = Image.fromarray(rgba, "RGBA")
            cell = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
            cell.alpha_composite(cell_img, (off_x, off_y))
            cells.append(cell)

        rows = (len(cells) + COLS - 1) // COLS
        sheet = Image.new("RGBA", (FRAME_W * COLS, FRAME_H * rows), (0, 0, 0, 0))
        for index, cell in enumerate(cells):
            sheet.alpha_composite(cell, ((index % COLS) * FRAME_W, (index // COLS) * FRAME_H))

        sheet.save(os.path.join(OUT_DIR, "attack_sheet.webp"), "WEBP", quality=90, method=6)
        sheet.save(os.path.join(OUT_DIR, "attack_sheet.png"), "PNG", optimize=True)

        # 命中帧：中心区域“近白像素”占比最大的一帧（冲击环炸开）
        profile = []
        for cell in cells:
            arr = np.asarray(cell)
            h, w, _ = arr.shape
            core = arr[int(h * 0.28) : int(h * 0.78), int(w * 0.12) : int(w * 0.88)]
            white = (core[:, :, 3] > 200) & (core[:, :, :3].min(axis=2) > 236)
            profile.append(float(white.mean()))
        impact = int(np.argmax(profile))
        print("命中帧候选：", impact, " 峰值占比 %.3f" % profile[impact])
        print("亮度曲线：", " ".join("%.2f" % p for p in profile))

        # 深色底 GIF 预览
        preview_frames = []
        for cell in cells:
            flat = Image.new("RGBA", (FRAME_W // 2, FRAME_H // 2), (14, 22, 30, 255))
            flat.alpha_composite(cell.resize((FRAME_W // 2, FRAME_H // 2), Image.LANCZOS), (0, 0))
            preview_frames.append(flat.convert("RGB"))
        preview_frames[0].save(
            os.path.join(ARTIFACT_DIR, "mage_attack_preview.gif"),
            save_all=True,
            append_images=preview_frames[1:],
            duration=int(1000 / FPS),
            loop=0,
            optimize=True,
        )

        # 待机 vs 攻击首帧 对比图
        diff = Image.new("RGBA", (FRAME_W * 2, FRAME_H), (14, 22, 30, 255))
        diff.alpha_composite(idle_canvas, (0, 0))
        diff.alpha_composite(cells[0], (FRAME_W, 0))
        diff.convert("RGB").save(os.path.join(ARTIFACT_DIR, "mage_idle_vs_attack0.png"))

        height_tiles = round(CHAR_TILES * FRAME_H / char_h_canvas, 2)
        meta = {
            "sourceImage": PORTRAIT_SRC,
            "sourceImageSha256": sha,
            "sourceVideo": VIDEO_SRC,
            "frameWidth": FRAME_W,
            "frameHeight": FRAME_H,
            "cols": COLS,
            "rows": rows,
            "frames": len(cells),
            "fps": FPS,
            "playbackSpeed": PLAYBACK_SPEED,
            "impactFrame": impact,
            "heightTiles": height_tiles,
            "feetAtTilePct": FEET_AT_TILE_PCT,
            "footY": round(feet_canvas, 1),
            "footFraction": round(feet_canvas / FRAME_H, 5),
            "characterHeightPx": round(char_h_canvas, 1)
        }
        with open(os.path.join(OUT_DIR, "mage.json"), "w", encoding="utf-8") as handle:
            json.dump(meta, handle, ensure_ascii=False, indent=2)
        print(json.dumps(meta, ensure_ascii=False, indent=2))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
