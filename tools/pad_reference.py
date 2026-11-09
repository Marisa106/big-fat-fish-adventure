# -*- coding: utf-8 -*-
"""把正面立绘缩到画布内，四周留出动作余量，供可灵当首帧用。

默认输出 3:4、1080x1440、纯绿 #00FF00 背景。
角色高度 65%（跳砸用 55%），脚底在画面 88% 处，头顶留约 24% 空间。
"""
import os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "artifacts", "knight_front.png")
OUT = os.path.join(ROOT, "artifacts")

CANVAS = (1080, 1440)      # 3:4
FOOT_Y = 0.88              # 脚底在画面高度的位置
BG_GREEN = (0, 255, 0, 255)
BG_WHITE = (255, 255, 255, 255)


def cutout(path: str) -> Image.Image:
    im = Image.open(path).convert("RGB")
    work = im.copy()
    ImageDraw.floodfill(work, (0, 0), (255, 0, 255), thresh=40)
    a = np.asarray(work)
    bg = (a[:, :, 0] == 255) & (a[:, :, 1] == 0) & (a[:, :, 2] == 255)

    rgb = np.asarray(im).astype(np.int16)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    near_white = (
        (rgb[:, :, 0] >= 247)
        & (rgb[:, :, 1] >= 247)
        & (rgb[:, :, 2] >= 247)
        & (rgb.max(axis=2) - rgb.min(axis=2) <= 4)
    )
    alpha[near_white] = 0
    img = Image.fromarray(np.dstack([np.asarray(im), alpha]), "RGBA")
    return img.crop(img.getbbox())


def place(img: Image.Image, ratio: float, bg: tuple, foot_y: float = FOOT_Y) -> Image.Image:
    cw, ch = CANVAS
    target_h = ch * ratio
    scale = target_h / img.height
    target_w = round(img.width * scale)
    body = img.resize((target_w, round(target_h)), Image.LANCZOS)

    canvas = Image.new("RGBA", CANVAS, bg)
    x = (cw - target_w) // 2
    y = round(ch * foot_y) - body.height
    canvas.alpha_composite(body, (x, y))
    return canvas


def main():
    body = cutout(SRC)
    for ratio, tag in [(0.65, ""), (0.55, "_jump")]:
        green = place(body, ratio, BG_GREEN)
        green.convert("RGB").save(os.path.join(OUT, f"knight_front_pad_green{tag}.png"))
        white = place(body, ratio, BG_WHITE)
        white.convert("RGB").save(os.path.join(OUT, f"knight_front_pad_white{tag}.png"))
        alpha = place(body, ratio, (0, 0, 0, 0))
        alpha.save(os.path.join(OUT, f"knight_front_pad_alpha{tag}.png"))
    print("done", CANVAS)


if __name__ == "__main__":
    main()
