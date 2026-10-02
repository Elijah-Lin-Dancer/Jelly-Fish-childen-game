#!/usr/bin/env python3
"""生物密度可调 e2e：
  1. 开局前在 Create New World 弹窗切密度 → 世界上限被影响（__ocean 计数）
  2. 游戏中在设置面板切密度 → 立即热过渡（补生成 / 裁撤）
  3. 稀疏档不崩、水母至少 1 只（不出现空海）
  4. 切换密度不触发页面错误
"""
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:8777/index.html"
CHECKS = []


def check(name, cond, info=""):
    CHECKS.append((name, bool(cond), info))
    print(f"  {'PASS' if cond else 'FAIL'} {name}" + (f" | {info}" if info else ""))
    return bool(cond)


def jelly_count(pg):
    return pg.evaluate("() => window.__ocean.entities ? "
                       "document.querySelectorAll('canvas').length && "
                       "window.__ocean.jellyfishCount || window.__ocean.life && 0 : 0")


def get_counts(pg):
    """从 __ocean 读实体计数与 quality 快照"""
    return pg.evaluate(
        """() => {
          const o = window.__ocean;
          return { c: o.counts, q: o.quality };
        }"""
    )


def main():
    ok = True
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={"width": 1280, "height": 720})
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(BASE)
        pg.wait_for_timeout(900)
        pg.evaluate("() => localStorage.clear()")
        pg.reload()
        pg.wait_for_timeout(900)

        # ---------- 1. 开局前：Create New World 里的密度行 ----------
        print("\n[1] 开局前密度选择")
        pg.click("#title-new")
        pg.wait_for_timeout(500)
        check("Create 弹窗有生物密度行", pg.locator("#cw-density").count() == 1)
        label = pg.locator("#cw-density-label").inner_text()
        check("密度行有标签", bool(label.strip()), repr(label))
        default_txt = pg.locator("#cw-density").inner_text().strip()
        print(f"     默认显示: {default_txt}")
        seen = [default_txt]
        for _ in range(2):
            pg.click("#cw-density")
            pg.wait_for_timeout(200)
            seen.append(pg.locator("#cw-density").inner_text().strip())
        check("三档循环可达", len(set(seen)) == 3, str(seen))

        # 回到默认档再创建
        guard = 0
        while pg.locator("#cw-density").inner_text().strip() != default_txt and guard < 5:
            pg.click("#cw-density"); pg.wait_for_timeout(150); guard += 1
        pg.click("#cw-terrains .create-terrain-card:nth-child(3)")
        pg.wait_for_timeout(200)
        pg.click("#cw-create")
        pg.wait_for_timeout(2600)
        try:
            pg.click("#coach-skip", timeout=2500)
        except Exception:
            pass

        base = get_counts(pg)
        print(f"     [标准] {base['c']}  quality.jellyfish={base['q']['jellyfish']}")
        check("标准档有实体", base["c"]["jellyfish"] >= 1)

        # ---------- 2. 游戏中：设置面板切密度 ----------
        print("\n[2] 游戏中热过渡")
        pg.evaluate("() => window.__ocean.openSettings ? window.__ocean.openSettings() : null")
        pg.wait_for_timeout(400)
        segs = pg.locator("#settings-density .seg")
        n = segs.count()
        check("设置面板有密度三段", n == 3, f"n={n}")
        if n == 3:
            segs.nth(0).click()          # 稀疏
            pg.wait_for_timeout(1300)
            sparse = get_counts(pg)
            print(f"     [稀疏] {sparse['c']}  多={sparse['q']['densityMult']}")
            check("稀疏档水母减少", sparse["c"]["jellyfish"] < base["c"]["jellyfish"],
                  f"{base['c']['jellyfish']} → {sparse['c']['jellyfish']}")
            check("稀疏档不空海（≥1）", sparse["c"]["jellyfish"] >= 1,
                  f"jelly={sparse['c']['jellyfish']}")
            check("稀疏档密度系数=0.5", abs(sparse["q"]["densityMult"] - 0.5) < 1e-6,
                  f"mult={sparse['q']['densityMult']}")

            segs.nth(2).click()          # 热闹
            pg.wait_for_timeout(1600)
            busy = get_counts(pg)
            print(f"     [热闹] {busy['c']}  多={busy['q']['densityMult']}")
            check("热闹档水母增多", busy["c"]["jellyfish"] > sparse["c"]["jellyfish"],
                  f"{sparse['c']['jellyfish']} → {busy['c']['jellyfish']}")
            check("热闹档密度系数=1.5", abs(busy["q"]["densityMult"] - 1.5) < 1e-6,
                  f"mult={busy['q']['densityMult']}")
            check("热闹档 > 标准档", busy["c"]["jellyfish"] > base["c"]["jellyfish"],
                  f"busy={busy['c']['jellyfish']} base={base['c']['jellyfish']}")

        # ---------- 3. 持久化 ----------
        print("\n[3] 持久化")
        saved = pg.evaluate("() => JSON.parse(localStorage.getItem('ocean.settings')||'{}').density")
        check("密度已写入 ocean.settings", saved == 2, f"density={saved}")
        pg.reload()
        pg.wait_for_timeout(1300)
        after = pg.evaluate("() => window.__ocean.quality.densityIndex")
        check("重载后密度沿用（=2 热闹）", after == 2, f"index={after}")

        # ---------- 4. 稳定性 ----------
        print("\n[4] 稳定性")
        check("无页面错误", len(errors) == 0, str(errors[:2]))

    passed = sum(1 for _, c, _ in CHECKS if c)
    total = len(CHECKS)
    print(f"\n检查 {total} 项，通过 {passed} 项")
    print("DENSITY OK" if passed == total else "DENSITY FAIL")
    sys.exit(0 if passed == total else 1)




if __name__ == "__main__":
    main()
