"""把白底的手绘地图道具（草丛 / 树丛）处理成可直接贴到棋盘上的透明 PNG。

输入：白底、带柔和落地投影的 2D 手绘稿。
输出：assets/map/ 下的透明 PNG（裁到内容外框、补正方形、统一 256px）。

处理思路
  1. 以「离白色的距离」估计不透明度（按实体最暗处约 0.6 定标），保留手绘边缘的柔和过渡；
  2. 用「低饱和 + 中高亮度」判掉落地投影：投影是中性灰，实体最亮处也带颜色，两者可分开；
  3. 反预乘还原前景色，避免边缘泛白；
  4. 内缩一圈 alpha 削掉白边，裁到内容外框后补成正方形并缩放，同一批素材视觉体量一致。
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "map")

# (输出文件名, 源图, 四周留白比例)
SOURCES = [
    ("grass-a.png", r"C:\Users\Yuan106\.dsh\attachments\v1\objects\a5\a5d392d17d0559d2f3eb0cb1142b59b8688aca0b76151ae1676ecf6ebf629649", 0.04),
    ("grass-b.png", r"C:\Users\Yuan106\.dsh\attachments\v1\objects\3a\3ac2d716b3899674d33aebaf89015f4d7e5601622acddb29f2839c5ad6b4dd04", 0.04),
    ("tree-a.png", r"C:\Users\Yuan106\.dsh\attachments\v1\objects\45\4598fcf8494bb3f235d88a79ba00a0ed658daea49252c3c849c564b619dd0b05", 0.02),
]

SIZE = 256
# 离白色多远算作完全不透明（实体实心处约 0.6）
ALPHA_LO, ALPHA_HI = 0.020, 0.500
# 落地投影：饱和度低、亮度中等偏上；软过渡避免硬边
SHADOW_SAT, SHADOW_LUMA = 0.120, 0.450
SHADOW_SAT_FEATHER, SHADOW_LUMA_FEATHER = 0.050, 0.060
# 收一圈 alpha，削掉抗锯齿留下的白边
EDGE_ERODE = 1


def cutout(src):
    img = Image.open(src).convert("RGB")
    rgb = np.asarray(img).astype(np.float32) / 255.0
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    lum = rgb.mean(axis=2)

    alpha = np.clip((1.0 - mn - ALPHA_LO) / (ALPHA_HI - ALPHA_LO), 0.0, 1.0)

    sat = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0.0)
    shadow = (
        np.clip((SHADOW_SAT - sat) / SHADOW_SAT_FEATHER, 0.0, 1.0)
        * np.clip((lum - SHADOW_LUMA) / SHADOW_LUMA_FEATHER, 0.0, 1.0)
    )
    alpha = alpha * (1.0 - shadow)

    # 反预乘：去掉混进来的白色，边缘才不会泛白
    safe = np.maximum(alpha, 1e-3)[..., None]
    fg = np.clip((rgb - (1.0 - alpha[..., None])) / safe, 0.0, 1.0)

    img = Image.fromarray((np.dstack([fg, alpha]) * 255.0 + 0.5).astype(np.uint8), "RGBA")
    if EDGE_ERODE:
        img.putalpha(img.getchannel("A").filter(ImageFilter.MinFilter(EDGE_ERODE * 2 + 1)))
    return img


def trim_and_fit(img, pad_ratio=0.04):
    bbox = img.getchannel("A").point(lambda v: 255 if v > 25 else 0).getbbox()
    if bbox:
        img = img.crop(bbox)
    w, h = img.size
    side = int(max(w, h) * (1 + pad_ratio * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - w) // 2, (side - h) // 2), img)
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, src, pad in SOURCES:
        if not os.path.exists(src):
            print("missing source:", src, file=sys.stderr)
            return 1
        out = trim_and_fit(cutout(src), pad)
        path = os.path.join(OUT_DIR, name)
        out.save(path, optimize=True)
        alpha = np.asarray(out.getchannel("A"))
        print("%-12s %s  %.1f%% 不透明  bytes=%d" % (
            name, out.size, (alpha > 25).mean() * 100.0, os.path.getsize(path)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
