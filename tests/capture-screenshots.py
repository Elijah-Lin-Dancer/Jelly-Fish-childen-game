#!/usr/bin/env python3
"""README 截图生成器：实机跑游戏，抓各关键画面到 docs/（web 友好 JPG）。

用法：
    python3 -m http.server 8777 &      # 先起本地服务
    python3 tests/capture-screenshots.py

依赖：playwright（pip install playwright && playwright install chromium）
"""
import os

from playwright.sync_api import sync_playwright

BASE = "http://localhost:8777/index.html"
# 输出目录：仓库根的 docs/
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs")
RAW = os.path.join(ROOT, ".screenshots-raw")  # 原始 2x PNG 暂存


def snap(pg, name):
    pg.screenshot(path=f"{RAW}/{name}.png")


def enter_world(pg):
    """复用验证脚本的进游戏流程。"""
    pg.wait_for_timeout(1600)
    pg.click("#title-new")
    pg.wait_for_timeout(600)
    pg.click("#cw-terrains .create-terrain-card:nth-child(1)")
    pg.wait_for_timeout(300)
    pg.click("#cw-create")
    pg.wait_for_timeout(3000)
    try:
        pg.click("#coach-skip", timeout=2500)
    except Exception:
        pass
    pg.wait_for_timeout(800)


def main():
    os.makedirs(RAW, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        errs = []

        # ---------- 桌面 16:9（2x 高清）----------
        pg = b.new_page(viewport={"width": 1440, "height": 810}, device_scale_factor=2)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(BASE)
        pg.wait_for_timeout(1600)
        pg.evaluate("() => localStorage.clear()")
        pg.reload()
        enter_world(pg)

        snap(pg, "ingame-spawn")
        pg.evaluate("() => window.__ocean.nudgeCamera(600, 1600)")
        pg.wait_for_timeout(1200)
        snap(pg, "deep")

        # 新建世界面板（回标题重进）
        pg.evaluate("() => localStorage.clear()")
        pg.reload()
        pg.wait_for_timeout(1600)
        pg.click("#title-new")
        pg.wait_for_timeout(700)
        snap(pg, "create")
        pg.click("#create-close")
        pg.wait_for_timeout(400)
        enter_world(pg)

        # FAB
        try:
            pg.click("#fab-main")
            pg.wait_for_timeout(600)
            snap(pg, "fab")
            pg.click("#fab-main")
            pg.wait_for_timeout(300)
        except Exception:
            pass
        # 图鉴
        try:
            pg.click("#dex")
            pg.wait_for_timeout(700)
            snap(pg, "dex")
            pg.click("#dex-close")
            pg.wait_for_timeout(400)
        except Exception:
            pass
        # 暂停
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(600)
        snap(pg, "pause")
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(400)
        # 设置
        try:
            pg.click("#settings-btn")
            pg.wait_for_timeout(600)
            snap(pg, "settings")
            pg.click("#settings-close")
            pg.wait_for_timeout(400)
        except Exception:
            pass
        pg.close()

        # ---------- 移动端竖屏 ----------
        pm = b.new_page(viewport={"width": 414, "height": 896}, device_scale_factor=2,
                        is_mobile=True, has_touch=True)
        pm.on("pageerror", lambda e: errs.append(str(e)))
        pm.goto(BASE)
        enter_world(pm)
        snap(pm, "mobile-ingame")
        pm.close()

        b.close()

    # ---- 压缩成 web 友好 JPG ----
    try:
        from PIL import Image
    except ImportError:
        print("需要 Pillow：pip install pillow")
        return
    plan = {"ingame-spawn": 1440, "mobile-ingame": 500, "create": 1440,
            "fab": 1440, "dex": 1440, "pause": 1440, "settings": 1440, "deep": 1440}
    for name, w in plan.items():
        p = f"{RAW}/{name}.png"
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert("RGB")
        if im.width > w:
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        im.save(f"{OUT}/shot-{name}.jpg", "JPEG", quality=88, optimize=True)
        print(f"  docs/shot-{name}.jpg")

    print(f"完成。页面错误: {len(errs)}")


if __name__ == "__main__":
    main()
