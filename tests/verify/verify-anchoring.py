#!/usr/bin/env python3
"""锚定回归测试 v4（最终）：避开相机边界夹取，精确验证实体坐标变换。

关键约束：世界 3200x4000，视口 vw≈2304 → 相机 x 可达区间仅 [0, 896]。
所以用「两次小位移」而非一次大位移，且都发生在区间中段。

判据：静态实体（灯塔红环带）的屏幕位移必须 == -scale·Δcam。
  正确 (p-cam)·s   → 位移 = -s·Δcam  ✓
  错误 s·p - cam   → 位移 = -1·Δcam  ✗（差 (1-s)·Δcam，s=0.556 时差 44%）
"""
import sys

import numpy as np
from PIL import Image

from playwright.sync_api import sync_playwright

BASE = "http://localhost:8777/index.html"
TOL = 9


def red_centers(img, min_px=18):
    a = np.asarray(img.convert("RGB"), dtype=np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = (r > 155) & (g > 20) & (g < 140) & (b > 20) & (b < 140) & (r - g > 50) & (r - b > 50)
    ys, xs = np.nonzero(m)
    if len(xs) < min_px:
        return []
    clusters = []
    for x, y in zip(xs.tolist(), ys.tolist()):
        hit = None
        for c in clusters:
            if abs(c[0] / c[2] - x) < 16 and abs(c[1] / c[2] - y) < 16:
                hit = c
                break
        if hit:
            hit[0] += x; hit[1] += y; hit[2] += 1
        else:
            clusters.append([x, y, 1])
    return [[c[0] / c[2], c[1] / c[2], c[2]] for c in clusters if c[2] >= min_px]


def main():
    ok = True
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={"width": 1280, "height": 720})
        pg.goto(BASE)
        pg.wait_for_timeout(900)
        pg.click("#title-new")
        pg.wait_for_timeout(700)
        pg.click("#cw-terrains .create-terrain-card:nth-child(3)")
        pg.wait_for_timeout(400)
        pg.click("#cw-create")
        pg.wait_for_timeout(2800)
        try:
            pg.click("#coach-skip", timeout=3000)
        except Exception:
            pass
        pg.wait_for_timeout(600)

        # 用 setTerrain 强制重建一次，确保 camera.scale 经过 resize()
        pg.evaluate("() => window.__ocean.setTerrain('island', 'anchor-test')")
        pg.wait_for_timeout(1500)
        try:
            pg.click("#coach-skip", timeout=1500)
        except Exception:
            pass

        cam0 = pg.evaluate("() => window.__ocean.camera")
        s = cam0["scale"]
        print(f"== scale={s}  vw={cam0['vw']}  cam=({cam0['x']:.0f},{cam0['y']:.0f})")
        if not s or abs(s - 1) < 1e-6:
            print("!! scale 仍为 1，无法区分两个模型（此测试失效）")
            b.close(); sys.exit(1)
        print(f"   模型差异系数 (1-s)/s = {(1 - s) / s:.2%}  → 位移 {300} 单位时两模型差 {abs((1 - s) * 300):.0f}px")

        def frame(tag):
            pg.screenshot(path=f"/tmp/anc_{tag}.png")
            return Image.open(f"/tmp/anc_{tag}.png"), pg.evaluate("() => window.__ocean.camera")

        imA, camA = frame("A")
        cA = red_centers(imA)
        print(f"== A 帧: cam.x={camA['x']:.0f}  签名={[[round(v) for v in c] for c in cA]}")
        if not cA:
            print("!! A 帧无红色签名，无法测")
            b.close(); sys.exit(1)

        # 位移 1：+260（世界单位），确保不越界
        step = 260
        camB = pg.evaluate(f"() => window.__ocean.nudgeCamera({step}, 0)")
        pg.wait_for_timeout(800)
        imB, camBf = frame("B")
        cB = red_centers(imB)
        dx = camBf["x"] - camA["x"]
        exp = -s * dx
        print(f"== B 帧: cam.x={camBf['x']:.0f}  实测Δcam={dx:.0f}  期望屏幕Δx={exp:.1f}  "
              f"[bug 模型会是 {-dx:.1f}]")
        print(f"   签名={[[round(v) for v in c] for c in cB]}")

        matched = 0
        for c1 in cA:
            near = [c for c in cB if abs(c[0] - c1[0]) < 300 and abs(c[1] - c1[1]) < 45]
            if not near:
                continue
            # 在「期望位置」和「bug 位置」里选最近的那个，判定
            c_exp_pos = min(near, key=lambda c: abs(c[0] - (c1[0] + exp)))
            c_bug_pos = min(near, key=lambda c: abs(c[0] - (c1[0] - dx)))
            d_exp = abs((c_exp_pos[0] - c1[0]) - exp)
            d_bug = abs((c_bug_pos[0] - c1[0]) - (-dx))
            # 只有两种模型解释得开时才有意义（位移足够大）
            pick = c_exp_pos if d_exp <= d_bug else c_bug_pos
            mx = pick[0] - c1[0]
            d = abs(mx - exp)
            verdict = "✓" if d <= TOL else "✗"
            if d <= TOL:
                matched += 1
            else:
                ok = False
            print(f"   锚 ({c1[0]:6.0f},{c1[1]:5.0f}) → Δx实测={mx:7.1f}  期望={exp:7.1f}"
                  f"  (bug={-dx:7.1f})  偏差={d:5.1f}  {verdict}")

        print(f"== 匹配锚点数 = {matched}/{len(cA)}")
        if matched == 0:
            ok = False
            print("   ✗ 无锚点符合正确模型 —— 坐标变换 bug 回归")

    print()
    print("== 结论 ==", "✓ 通过（实体与地形同坐标系）" if ok else "✗ 失败")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
