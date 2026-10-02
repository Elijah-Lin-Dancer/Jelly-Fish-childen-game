#!/usr/bin/env python3
"""暂停菜单 e2e：
  1. 进游戏后 Esc 弹出暂停；世界冻结（dt=0，水母位置不再变化）
  2. 继续游戏 → 遮罩关闭、世界恢复推进
  3. 右上角 ⏸ 按钮同样可打开
  4. 暂停中打开设置 → 设置可见；关掉设置回到游戏
  5. 保存并回到标题 → 标题屏出现、进度已落盘（continue 可用）
  6. 标题屏按 Esc 不应弹暂停
  7. 无页面错误
"""
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:8777/index.html"
CHECKS = []


def check(name, cond, info=""):
    CHECKS.append((name, bool(cond), info))
    print(f"  {'PASS' if cond else 'FAIL'} {name}" + (f" | {info}" if info else ""))
    return bool(cond)


def snapshot(pg):
    """世界快照：水母坐标 + 暂停状态"""
    return pg.evaluate(
        """() => {
          const o = window.__ocean;
          const j = (o.swimZ && o.swimZ.jellyfish) || [];
          return {
            paused: o.paused,
            open: o.pauseOpen,
            inGame: o.inGame,
            jelly: o.counts.jellyfish,
            // 用生命元素坐标当作"世界有没有在动"的探针（水母会游）
            positions: (o.life || []).slice(0, 6).map(i => [i.x, i.y]),
          };
        }"""
    )


def main():
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

        # ---------- 进游戏 ----------
        pg.click("#title-new")
        pg.wait_for_timeout(500)
        pg.click("#cw-terrains .create-terrain-card:nth-child(1)")
        pg.wait_for_timeout(200)
        pg.click("#cw-create")
        pg.wait_for_timeout(2600)
        try:
            pg.click("#coach-skip", timeout=2500)
        except Exception:
            pass

        s0 = snapshot(pg)
        check("已进入游戏", s0["inGame"] is True)
        check("初始未暂停", s0["paused"] is False and s0["open"] is False)

        # ---------- 1. Esc 暂停 ----------
        print("\n[1] Esc 暂停 + 世界冻结")
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(500)
        s1 = snapshot(pg)
        check("Esc 打开暂停遮罩", s1["open"] is True, f"open={s1['open']}")
        check("paused 标志置位", s1["paused"] is True)
        vis = pg.locator("#pause-modal").is_visible()
        check("遮罩可见", vis)
        # 菜单项
        for sel, nm in (("#pause-resume", "继续游戏"),
                        ("#pause-settings", "设置"),
                        ("#pause-quit", "保存回标题")):
            check(f"菜单项存在: {nm}", pg.locator(sel).count() == 1)

        # 世界冻结：等 1.2s 后再快照，坐标应完全不变
        before = snapshot(pg)["positions"]
        pg.wait_for_timeout(1200)
        after = snapshot(pg)["positions"]
        frozen = before == after
        check("世界已冻结（坐标不动）", frozen, f"{before[:2]} → {after[:2]}")

        # 暂停时按键不移动相机
        cam_a = pg.evaluate("() => ({x: window.__ocean.camera.x, y: window.__ocean.camera.y})")
        pg.keyboard.down("ArrowRight")
        pg.wait_for_timeout(700)
        pg.keyboard.up("ArrowRight")
        pg.wait_for_timeout(200)
        cam_b = pg.evaluate("() => ({x: window.__ocean.camera.x, y: window.__ocean.camera.y})")
        check("暂停时相机不响应移动键", abs(cam_a["x"] - cam_b["x"]) < 1.5,
              f"{cam_a['x']:.0f} → {cam_b['x']:.0f}")

        # ---------- 2. 继续游戏 ----------
        print("\n[2] 继续游戏")
        pg.click("#pause-resume")
        pg.wait_for_timeout(600)
        s2 = snapshot(pg)
        check("遮罩已关闭", s2["open"] is False)
        check("paused 已复位", s2["paused"] is False)
        # 世界恢复推进
        p1 = snapshot(pg)["positions"]
        pg.wait_for_timeout(1200)
        p2 = snapshot(pg)["positions"]
        check("世界恢复推进", p1 != p2, f"{p1[:1]} → {p2[:1]}")

        # ---------- 3. ⏸ 按钮 ----------
        print("\n[3] 右上角 ⏸ 按钮")
        pg.click("#pause-btn")
        pg.wait_for_timeout(400)
        check("按钮可打开暂停", snapshot(pg)["open"] is True)
        pg.click("#pause-resume")
        pg.wait_for_timeout(400)
        check("按钮暂停可关闭", snapshot(pg)["open"] is False)

        # ---------- 4. 暂停 → 设置 ----------
        print("\n[4] 暂停中打开设置")
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(400)
        pg.click("#pause-settings")
        pg.wait_for_timeout(500)
        check("设置面板可见", pg.locator("#settings-modal").is_visible())
        # 关掉设置 → 应回到游戏（暂停遮罩仍在）
        pg.click("#settings-close")
        pg.wait_for_timeout(400)
        st = snapshot(pg)
        check("关设置后仍处于暂停（可继续）", st["open"] is True or st["paused"] is True,
              f"open={st['open']} paused={st['paused']}")
        # Esc 关闭暂停
        if st["open"]:
            pg.keyboard.press("Escape")
            pg.wait_for_timeout(400)
        check("Esc 可关闭暂停", snapshot(pg)["open"] is False)

        # ---------- 5. 保存并回到标题 ----------
        print("\n[5] 保存并回到标题")
        pg.evaluate("() => { window.__ocean.nudgeCamera(120, 60); }")
        pg.wait_for_timeout(300)
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(400)
        pg.click("#pause-quit")
        pg.wait_for_timeout(900)
        s5 = snapshot(pg)
        check("回到标题屏", s5["inGame"] is False, f"inGame={s5['inGame']}")
        check("标题屏可见", pg.locator("#home").is_visible() or
              pg.locator(".home").count() > 0)
        # 存档已写 → continue 按钮可用
        cont_disabled = pg.evaluate(
            """() => {
              const c = document.getElementById('title-continue');
              return c ? c.classList.contains('disabled') : null;
            }"""
        )
        check("存档可续（continue 未禁用）", cont_disabled is False, f"disabled={cont_disabled}")

        # ---------- 6. 标题屏 Esc 不应暂停 ----------
        print("\n[6] 标题屏 Esc 防护")
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(400)
        check("标题屏 Esc 不弹暂停", snapshot(pg)["open"] is False)

        # ---------- 7. 稳定性 ----------
        print("\n[7] 稳定性")
        check("无页面错误", len(errors) == 0, str(errors[:2]))

    passed = sum(1 for _, c, _ in CHECKS if c)
    total = len(CHECKS)
    print(f"\n检查 {total} 项，通过 {passed} 项")
    print("PAUSE OK" if passed == total else "PAUSE FAIL")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
