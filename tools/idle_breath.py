# -*- coding: utf-8 -*-
"""从静态立绘程序化生成 2 秒「待机呼吸」循环。

用法:
    python tools/idle_breath.py
输出:
    artifacts/idle/frames/*.png      48 帧 RGBA (源分辨率)
    artifacts/idle/frames_288/*.png  48 帧 RGBA (高 288px)
    artifacts/idle/idle_sheet_8x6.png
    artifacts/idle/idle_breath.gif
    artifacts/idle/idle_breath.webp
"""
import os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "artifacts", "knight_front.png")
OUT = os.path.join(ROOT, "artifacts", "idle")

FPS = 24
FRAMES = 48          # 2 秒
AMP_LIFT = 11.0      # 头顶上浮像素（源分辨率）
AMP_CHEST = 2.8      # 胸腔横向扩张像素
AMP_HEAD = 0.0


def cutout(path: str) -> Image.Image:
    im = Image.open(path).convert("RGB")
    work = im.copy()
    ImageDraw.floodfill(work, (0, 0), (255, 0, 255), thresh=40)
    a = np.asarray(work)
    bg = (a[:, :, 0] == 255) & (a[:, :, 1] == 0) & (a[:, :, 2] == 255)

    rgb = np.asarray(im).astype(np.int16)
    alpha = np.where(bg, 0, 255).astype(np.uint8)

    # 去掉封闭的白色背景窟窿（呆毛环内、武器与身体之间等）
    near_white = (
        (rgb[:, :, 0] >= 247)
        & (rgb[:, :, 1] >= 247)
        & (rgb[:, :, 2] >= 247)
        & (rgb.max(axis=2) - rgb.min(axis=2) <= 4)
    )
    alpha[near_white] = 0

    out = np.dstack([np.asarray(im), alpha])
    img = Image.fromarray(out, "RGBA")
    bbox = img.getbbox()
    return img.crop(bbox)


def pad(img: Image.Image, margin: int = 48) -> Image.Image:
    w, h = img.size
    canvas = Image.new("RGBA", (w + margin * 2, h + margin * 2), (0, 0, 0, 0))
    canvas.alpha_composite(img, (margin, margin))
    return canvas


def sample_bilinear(src: np.ndarray, sx: np.ndarray, sy: np.ndarray) -> np.ndarray:
    h, w = src.shape[:2]
    sx = np.clip(sx, 0, w - 1.001)
    sy = np.clip(sy, 0, h - 1.001)
    x0 = np.floor(sx).astype(np.int32)
    y0 = np.floor(sy).astype(np.int32)
    x1 = np.minimum(x0 + 1, w - 1)
    y1 = np.minimum(y0 + 1, h - 1)
    fx = (sx - x0)[..., None]
    fy = (sy - y0)[..., None]
    c00 = src[y0, x0].astype(np.float32)
    c10 = src[y0, x1].astype(np.float32)
    c01 = src[y1, x0].astype(np.float32)
    c11 = src[y1, x1].astype(np.float32)
    top = c00 * (1 - fx) + c10 * fx
    bot = c01 * (1 - fx) + c11 * fx
    return (top * (1 - fy) + bot * fy).astype(np.uint8)


def build_frames(base: Image.Image):
    arr = np.asarray(base).astype(np.float32)
    h, w = arr.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)

    # 以脚底为锚点：u=0 头顶，u=1 脚底
    u = yy / (h - 1)
    v = (xx - w / 2) / (w / 2)

    frames = []
    for i in range(FRAMES):
        t = i / FRAMES
        s = np.sin(2 * np.pi * t)

        dy = -AMP_LIFT * np.power(np.clip(1 - u, 0, 1), 2.0) * s
        bell = np.exp(-np.square((u - 0.56) / 0.17))
        dx = AMP_CHEST * v * bell * s

        out = sample_bilinear(arr, xx - dx, yy - dy)
        frames.append(Image.fromarray(out, "RGBA"))
    return frames


def main():
    os.makedirs(os.path.join(OUT, "frames"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "frames_288"), exist_ok=True)

    base = pad(cutout(SRC))
    frames = build_frames(base)
    print("canvas", base.size, "frames", len(frames))

    for i, f in enumerate(frames, 1):
        f.save(os.path.join(OUT, "frames", f"f_{i:03d}.png"))

    small = [f.resize((round(f.width * 288 / f.height), 288), Image.LANCZOS) for f in frames]
    for i, f in enumerate(small, 1):
        f.save(os.path.join(OUT, "frames_288", f"f_{i:03d}.png"))

    fw, fh = small[0].size
    sheet = Image.new("RGBA", (fw * 8, fh * 6), (0, 0, 0, 0))
    for i, f in enumerate(small):
        sheet.alpha_composite(f, ((i % 8) * fw, (i // 8) * fh))
    sheet.save(os.path.join(OUT, "idle_sheet_8x6.png"))

    bg_color = (11, 26, 23, 255)
    bgc = Image.new("RGBA", small[0].size, bg_color)
    flat = []
    for f in small:
        c = bgc.copy()
        c.alpha_composite(f)
        flat.append(c.convert("RGB"))

    flat[0].save(
        os.path.join(OUT, "idle_breath.gif"),
        save_all=True,
        append_images=flat[1:],
        duration=40,
        loop=0,
        optimize=False,
        disposal=2,
    )
    small[0].save(
        os.path.join(OUT, "idle_breath.webp"),
        save_all=True,
        append_images=small[1:],
        duration=1000 / FPS,
        loop=0,
        lossless=True,
    )
    print("done")


if __name__ == "__main__":
    main()
