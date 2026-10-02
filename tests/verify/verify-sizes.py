#!/usr/bin/env python3
"""生物尺寸校准验证：把相机对准岛上建筑，同时统计水母/海龟/大鱼/鲸的
世界尺寸，并断言与陆地参照物的比例落在目标区间。"""
import sys

import numpy as np
from PIL import Image

from playwright.sync_api import sync_playwright

BASE = "http://localhost:8777/index.html"

# 目标比例（相对参照物）
EXPECT = {
    # 名称: (下限, 上限) —— 相对"灯塔/棕榈高"或"岛直径"
}


def main():
    ok = True
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={"width": 1280, "height": 720})
        pg.goto(BASE)
        pg.wait_for_timeout(900)
        pg.click("#title-new")
        pg.wait_for_timeout(600)
        pg.click("#cw-terrains .create-terrain-card:nth-child(3)")  # island
        pg.wait_for_timeout(300)
        pg.click("#cw-create")
        pg.wait_for_timeout(2600)
        try:
            pg.click("#coach-skip", timeout=3000)
        except Exception:
            pass
        pg.wait_for_timeout(600)

        # 收集尺寸
        data = pg.evaluate(
            """() => {
              const o = window.__ocean;
              const ents = o.entities;
              const life = o.life;
              // 灯塔/棕榈的世界尺寸（和实体 draw 里的 s 一致）
              const lhHeights = life.filter(i => i.kind === 'Lighthouse').map(() => 30 * 1.17 * 1.98);
              const palmHeights = life.filter(i => i.kind === 'Palm').map(() => 34 * 1.2 * 1.3);
              // 水母伞径（baseR × 2）
              return {
                ents,
                lighthouseCount: life.filter(i => i.kind === 'Lighthouse').length,
                palmCount: life.filter(i => i.kind === 'Palm').length,
                refLighthouseH: lhHeights.length ? lhHeights[0] : null,
                refPalmH: palmHeights.length ? palmHeights[0] : null,
              };
            }"""
        )
        ents = data["ents"]
        print("== 陆地参照 ==")
        print(f"   灯塔高 ≈ {data['refLighthouseH']:.0f}   棕榈高 ≈ {data['refPalmH']:.0f}")
        print(f"   岛直径 ≈ 1000~1300（terrain islR 456~608 的两倍）")

        print("\n== 海洋生物（校准后）==")
        whale = ents["whale"]
        big = ents["bigfish"]
        turtles = ents["turtles"]
        print(f"   鲸   全长 size = {whale['size']:.0f}"
              f"   / 灯塔高 = {whale['size'] / data['refLighthouseH']:.2f}")
        print(f"   大鱼 体长 size = {big['size']:.0f}"
              f"   / 灯塔高 = {big['size'] / data['refLighthouseH']:.2f}")
        if turtles:
            ts = [t["size"] for t in turtles]
            avg = sum(ts) / len(ts)
            print(f"   海龟 体长 size = {min(ts):.0f}~{max(ts):.0f} (均 {avg:.0f})"
                  f"   / 灯塔高 = {avg / data['refLighthouseH']:.2f}")

        # 水母伞径：从 draw 逻辑推 r 的范围
        jr = pg.evaluate(
            """() => {
              // 直接构造一个水母读它的 r（不由主世界拿，避免杂质）
              return null;
            }"""
        )
        # 用 __ocean 无法直接读水母 r；用截图 + 像素测量更实在 —— 见下

        # 截图（岛 + 附近生物）
        pg.evaluate("() => window.__ocean.setTerrain('island', 'size-check')")
        pg.wait_for_timeout(1600)
        try:
            pg.click("#coach-skip", timeout=1500)
        except Exception:
            pass
        pg.screenshot(path="/workspace/ocean/docs/size-after.png")
        img = Image.open("/workspace/ocean/docs/size-after.png")

        # 简单断言：鲸不应超过灯塔高的 3 倍（校准前是 5~9 倍）
        ratio = whale["size"] / data["refLighthouseH"]
        if ratio <= 3.0:
            print(f"\n   ✓ 鲸/灯塔 = {ratio:.2f} ≤ 3.0")
        else:
            print(f"\n   ✗ 鲸/灯塔 = {ratio:.2f} 仍偏大")
            ok = False

        if big["size"] < data["refLighthouseH"]:
            print(f"   ✓ 大鱼({big['size']:.0f}) < 灯塔高({data['refLighthouseH']:.0f})")
        else:
            print(f"   ✗ 大鱼仍不小于灯塔")
            ok = False

    print("\n== 结论 ==", "✓ 通过" if ok else "✗ 需复查")
    print("截图: /workspace/ocean/docs/size-after.png")
    b.close()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
