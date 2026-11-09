# -*- coding: utf-8 -*-
"""把用户提供的怪物立绘与传送门整理成游戏资源。

- 怪物：读取原始像素图，裁掉空白边、补成正方形、保留像素硬边（NEAREST）。
- 噪音蝙蝠：原图为洋红底，先抠图再裁切。
- 传送门：洋红底软抠图 + 去色边，统一缩放到 512。

用法（在项目根目录）：
    python tools/build_monster_assets.py
"""
import os
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = Path(os.environ.get("BIGFISH_SOURCE_DIR", ROOT / "sources"))
MONSTER_SRC = SOURCE_DIR / "monsters"
PORTAL_SRC = SOURCE_DIR / "portals"
OUT_MONSTERS = ROOT / "assets" / "monsters"
OUT_PORTALS = ROOT / "assets" / "portals"

# 输出文件名 -> 源文件（相对 MONSTER_SRC）
SPRITES = {
    "promptBubble.png": "提示词泡泡/bubble-monster-32.png",
    "noiseBat.png": "噪音蝙蝠/pixel-bat-sprite-final.png",
    "overfitSkeleton.png": "过拟态骷髅/skeleton-book-48.png",
    "hallucinationArcher.png": "幻觉弓手/archer-48.png",
    "cacheSpider.png": "缓存蜘蛛/3f97f9a2-cache-spider-48.png",
    "privacyGhost.png": "隐私幽灵/ghost-diary-48.png",
    "computeGolem.png": "算力石魔/399e3c63-exam-gargoyle-80.png",
    "jailbreakBox.png": "越狱盒子/box-monster-48.png",
    "tokenRiceball.png": "token饭团/onigiri-32.png",
    "bossOverfit.png": "过拟合石像鬼/e15fb3be-server-golem-64.png",
    "bossHallucination.png": "幻觉古树/ancient-tree-boss-80.png",
    "bossDataflood.png": "数据洪流巨兽/whale-octopus-80.png",
    "bossRicecooker.png": "终焉电饭煲/rice-cooker-96.png",
}

# 输出文件名 -> 附件里的洋红底原图
PORTALS = {
    "portal-left.png": str(PORTAL_SRC / "portal-left.png"),
    "portal-bottom.png": str(PORTAL_SRC / "portal-bottom.png"),
    "portal-right.png": str(PORTAL_SRC / "portal-right.png"),
}


def key_magenta(im, soft=70.0, cutoff=24.0, despill=False):
    """把纯洋红背景变成透明；边缘按到洋红的距离给半透明，并去掉洋红反光。

    绘制风格的原画边缘有大量半透明过渡，用较宽的 soft 区间（soft=200）
    反混合后再整体压一次洋红反光，才不会留下粉色描边。
    """
    rgb = np.asarray(im.convert("RGB")).astype(np.float64)
    dist = np.sqrt(((rgb - np.array([255.0, 0.0, 255.0])) ** 2).sum(axis=2))
    alpha = np.clip((dist - cutoff) / soft, 0.0, 1.0)
    alpha[alpha < 0.02] = 0.0
    alpha[alpha > 0.985] = 1.0

    # 反混合：C = a*F + (1-a)*K，已知 a 和 K，解出真正的颜色 F
    a = alpha[..., None]
    key = np.array([255.0, 0.0, 255.0])
    safe = np.maximum(a, 0.04)
    fg = (rgb - (1.0 - a) * key) / safe
    rgb = np.where(a > 0.02, np.clip(fg, 0, 255), 255.0)

    if despill:
        # 同时压掉“R、B 都明显高于 G”的洋红反光；灰/蓝/绿/橙本身不会被误伤
        excess = np.maximum(np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1] - 8, 0)
        k = np.clip(excess * 0.9, 0, 255)
        rgb[..., 0] = np.clip(rgb[..., 0] - k, 0, 255)
        rgb[..., 2] = np.clip(rgb[..., 2] - k, 0, 255)

    out = np.dstack([rgb, alpha * 255.0]).round().astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def square_crop(im, pad_ratio=0.04):
    """裁到内容边界，补成正方形，四周留一点安全边。"""
    box = im.getbbox()
    if not box:
        return im
    art = im.crop(box)
    side = max(art.width, art.height)
    side = int(round(side * (1.0 + pad_ratio * 2)))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(art, ((side - art.width) // 2, (side - art.height) // 2))
    return canvas


def build_sprites():
    OUT_MONSTERS.mkdir(parents=True, exist_ok=True)
    for out_name, rel in SPRITES.items():
        src = MONSTER_SRC / rel
        im = Image.open(src).convert("RGBA")
        if "pixel-bat" in rel:
            im = key_magenta(im)
            im = im.resize((512, 512), Image.NEAREST)
        im = square_crop(im)
        # 原始像素图不做缩放，交由 CSS 的 image-rendering: pixelated 处理
        im.save(OUT_MONSTERS / out_name, optimize=True)
        print("monster %-24s <- %-46s %s" % (out_name, rel, im.size))


def build_portals():
    OUT_PORTALS.mkdir(parents=True, exist_ok=True)
    for out_name, src in PORTALS.items():
        im = Image.open(src).convert("RGBA")
        im = key_magenta(im, soft=200.0, cutoff=20.0, despill=True)
        im = im.resize((512, 512), Image.LANCZOS)
        im.save(OUT_PORTALS / out_name, optimize=True)
        print("portal  %-24s %s" % (out_name, im.size))


if __name__ == "__main__":
    build_sprites()
    build_portals()
