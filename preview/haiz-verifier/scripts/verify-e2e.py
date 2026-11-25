#!/usr/bin/env python3
"""HAIZ 动物验证码 · 全流程自动化验收脚本
覆盖：
1. 首屏冷加载与二次缓存加载耗时
2. 六款动物（黄鸭子 / 黑白熊猫 / 橙色狐狸 / 绿色青蛙 / 粉色小猪 / 浅蓝色大象）逐一完整抓取、移动、投放与服务端判定
3. 抓错回位提示 + 抓对「已验证」→「你已进入」演示凭证核销
4. 360×740 移动端窄屏无横向溢出 + 无障碍名单模式（选错 + 选对）
5. 生成 screenshots/flow.jpg 与移动端/无障碍模式检视图
"""
import io
import os
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

SCRIPT_DIR = Path(__file__).resolve().parent
VERIFIER_DIR = SCRIPT_DIR.parent
REPO_ROOT = VERIFIER_DIR.parent.parent
SHOTS_DIR = VERIFIER_DIR / "screenshots"
SHOTS_DIR.mkdir(parents=True, exist_ok=True)


class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(REPO_ROOT), **kwargs)

    def log_message(self, fmt, *args):
        pass


def project_world_x_to_canvas_px(page, world_x):
    """计算指定场景 X 在 canvas 内的像素坐标，模拟真实用户点击/拖动画面移动爪子。"""
    return page.evaluate(
        """(wx) => {
          const v = document.getElementById('scrim')._verifier;
          const scene = v.getScene();
          const canvas = v.element.querySelector('.hv-canvas');
          const rect = canvas.getBoundingClientRect();
          // 二分搜索 screenToX 精确反解，保证完全走真实指针坐标路径
          let lo = 0, hi = rect.width;
          for (let i = 0; i < 18; i++) {
            const mid = (lo + hi) * 0.5;
            const x = scene.screenToX(mid, rect.height * 0.65);
            if (x < wx) lo = mid; else hi = mid;
          }
          return { x: rect.left + (lo + hi) * 0.5, y: rect.top + rect.height * 0.65 };
        }""",
        world_x,
    )


def move_claw_to_x(page, target_x):
    pt = project_world_x_to_canvas_px(page, target_x)
    page.mouse.move(pt["x"], pt["y"])
    page.mouse.down()
    page.mouse.move(pt["x"] + 1, pt["y"])
    page.mouse.up()
    # 等待平滑插值到位
    page.wait_for_function(
        "(tx) => { const v = document.getElementById('scrim')._verifier; return v && Math.abs(v.getScene().clawX - tx) < 0.04; }",
        arg=target_x,
        timeout=5000,
    )


def stitch_horizontal(png_bytes_list, out_path):
    """用 Pillow（若可用）或浏览器 Canvas 拼接流程截图。"""
    try:
        from PIL import Image

        imgs = [Image.open(io.BytesIO(b)).convert("RGB") for b in png_bytes_list]
        h = imgs[0].height
        total_w = sum(im.width for im in imgs)
        out = Image.new("RGB", (total_w, h), (247, 243, 235))
        x = 0
        for im in imgs:
            out.paste(im, (x, 0))
            x += im.width
        out.save(out_path, "JPEG", quality=90)
        return True
    except ImportError:
        return False


def main():
    srv = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
    port = srv.server_address[1]
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()

    url = f"http://127.0.0.1:{port}/preview/haiz-verifier/"
    all_errors = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                executable_path="/usr/bin/google-chrome",
                headless=True,
                args=[
                    "--no-sandbox",
                    "--use-gl=angle",
                    "--use-angle=swiftshader",
                    "--enable-unsafe-swiftshader",
                ],
            )

            # ----------------------------------------------------------------
            # 1. 桌面/手机标准视口（400×820）：测试全部 6 款动物抓取与投放 + 流程截图
            # ----------------------------------------------------------------
            page = browser.new_page(viewport={"width": 400, "height": 820}, device_scale_factor=2)
            page.on("pageerror", lambda e: all_errors.append(f"pageerror: {e}"))
            page.on("console", lambda m: all_errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)

            t0 = time.time()
            page.goto(url, wait_until="networkidle")
            page.click("button.primary")
            page.wait_for_selector(".hv-loading[hidden]", state="attached", timeout=20000)
            cold_s = time.time() - t0
            time.sleep(0.35)

            sub_prompt = page.locator(".hv-sub-text").inner_text()
            print(f"[Cold load] {cold_s:.2f}s | prompt: {sub_prompt}")

            # 检查 6 只动物全部加载且拥有 5 段动画
            toys_info = page.evaluate(
                """() => {
                  const v = document.getElementById('scrim')._verifier;
                  const s = v.getScene();
                  const ch = v.getChallenge();
                  return {
                    target: ch.target,
                    toys: s.toys.map(t => ({
                      slot: t.slot,
                      characterId: t.characterId,
                      animalId: t.animalId,
                      name: t.animal.name,
                      emoji: t.animal.emoji,
                      x: t.root.position.x,
                      clips: Object.keys(t.clips),
                    })),
                  };
                }"""
            )
            assert len(toys_info["toys"]) == 6, f"Expected 6 toys, got {len(toys_info['toys'])}"
            for ti in toys_info["toys"]:
                assert set(["idle", "touch", "lifted", "land", "celebrate"]).issubset(set(ti["clips"])), f"Missing clips on {ti}"

            # 逐一抓取所有 6 只动物：先抓 5 只非目标（测试抓错回位 + 剩余次数，注意 maxAttempts=5 所以每局最多错 4 次，第 5 只换局再测！）
            tested_animals = set()
            flow_frames = []

            # 第一局：先抓 3 只非目标，再抓目标通关并截取 5 帧流程截图
            non_targets = [ti for ti in toys_info["toys"] if ti["characterId"] != toys_info["target"]]
            target_toy = [ti for ti in toys_info["toys"] if ti["characterId"] == toys_info["target"]][0]

            # 截帧 1：移动准备态
            move_claw_to_x(page, target_toy["x"])
            time.sleep(0.15)
            flow_frames.append(page.locator(".hv").screenshot())

            # 测试 3 只错误动物的完整 抓取→移动→投放→回位 流程
            for idx, wrong in enumerate(non_targets[:3]):
                move_claw_to_x(page, wrong["x"])
                page.click(".hv-go")
                page.wait_for_selector('.hv-steps li[data-i="2"].is-on', timeout=8000)
                held_id = page.evaluate("() => document.getElementById('scrim')._verifier.getScene().held.animalId")
                assert held_id == wrong["animalId"], f"Grabbed {held_id}, expected {wrong['animalId']}"

                move_claw_to_x(page, -1.68)
                page.wait_for_selector(".hv-chute-label.is-on", timeout=4000)
                page.click(".hv-go")
                # 等待回位并出现提示
                page.wait_for_function(
                    "(name) => document.querySelector('.hv-pill')?.textContent?.includes(name)",
                    arg=wrong["name"],
                    timeout=8000,
                )
                pill_txt = page.locator(".hv-pill").inner_text()
                print(f"  [Wrong grab #{idx+1}] {wrong['name']} {wrong['emoji']} -> pill: {pill_txt}")
                tested_animals.add(wrong["animalId"])

            # 抓取正确目标动物 → 截帧 2（提起）→ 移到投放口截帧 3（亮绿可放）→ 投放 → 截帧 4（已验证）→ 截帧 5（你已进入）
            move_claw_to_x(page, target_toy["x"])
            page.click(".hv-go")
            page.wait_for_selector('.hv-steps li[data-i="2"].is-on', timeout=8000)
            held_id = page.evaluate("() => document.getElementById('scrim')._verifier.getScene().held.animalId")
            assert held_id == target_toy["animalId"], f"Grabbed {held_id}, expected {target_toy['animalId']}"
            time.sleep(0.25)
            flow_frames.append(page.locator(".hv").screenshot())

            move_claw_to_x(page, -1.68)
            page.wait_for_selector(".hv-chute-label.is-on", timeout=4000)
            time.sleep(0.2)
            flow_frames.append(page.locator(".hv").screenshot())

            page.click(".hv-go")
            page.wait_for_selector(".hv.is-verified", timeout=8000)
            flow_frames.append(page.locator(".hv").screenshot(animations="disabled"))

            page.wait_for_selector(".app.is-done", timeout=6000)
            time.sleep(0.25)
            done_who = page.locator("#who").inner_text()
            print(f"  [Target pass] {target_toy['name']} {target_toy['emoji']} -> {done_who}")
            assert "演示核销通过" in done_who
            tested_animals.add(target_toy["animalId"])
            flow_frames.append(page.locator(".app").screenshot())

            # 第二局：验证缓存加速加载 + 测试其余尚未抓过的 2 只动物！
            t_warm0 = time.time()
            page.click("#again")
            page.click("button.primary")
            page.wait_for_selector(".hv-loading[hidden]", state="attached", timeout=10000)
            warm_s = time.time() - t_warm0
            print(f"[Warm cached load] {warm_s:.2f}s (vs cold {cold_s:.2f}s)")

            toys2 = page.evaluate(
                """() => {
                  const v = document.getElementById('scrim')._verifier;
                  const s = v.getScene();
                  const ch = v.getChallenge();
                  return {
                    target: ch.target,
                    toys: s.toys.map(t => ({
                      characterId: t.characterId,
                      animalId: t.animalId,
                      name: t.animal.name,
                      emoji: t.animal.emoji,
                      x: t.root.position.x,
                    })),
                  };
                }"""
            )
            remaining = [ti for ti in toys2["toys"] if ti["animalId"] not in tested_animals]
            # 先抓非目标的 remaining，再抓目标（如果 remaining 包含目标则放最后）
            remaining.sort(key=lambda x: 1 if x["characterId"] == toys2["target"] else 0)
            for item in remaining:
                move_claw_to_x(page, item["x"])
                page.click(".hv-go")
                page.wait_for_selector('.hv-steps li[data-i="2"].is-on', timeout=8000)
                held_id = page.evaluate("() => document.getElementById('scrim')._verifier.getScene().held.animalId")
                assert held_id == item["animalId"], f"Grabbed {held_id}, expected {item['animalId']}"
                move_claw_to_x(page, -1.68)
                page.wait_for_selector(".hv-chute-label.is-on", timeout=4000)
                page.click(".hv-go")
                if item["characterId"] == toys2["target"]:
                    page.wait_for_selector(".app.is-done", timeout=8000)
                    print(f"  [Remaining pass] {item['name']} {item['emoji']} -> verified!")
                else:
                    page.wait_for_function(
                        "(name) => document.querySelector('.hv-pill')?.textContent?.includes(name)",
                        arg=item["name"],
                        timeout=8000,
                    )
                    print(f"  [Remaining wrong] {item['name']} {item['emoji']} -> returned cleanly!")
                tested_animals.add(item["animalId"])

            assert tested_animals == {"duck", "panda", "fox", "frog", "pig", "elephant"}, f"Not all 6 tested: {tested_animals}"
            print("ALL 6 ANIMALS VERIFIED END-TO-END:", sorted(tested_animals))

            # 拼接 5 帧流程截图
            stitched = stitch_horizontal(flow_frames, SHOTS_DIR / "flow.jpg")
            if not stitched:
                # 兜底用浏览器 Canvas 拼接
                import base64

                b64s = [base64.b64encode(b).decode() for b in flow_frames]
                data_url = page.evaluate(
                    """async (list) => {
                      const imgs = await Promise.all(list.map(b => new Promise((res, rej) => {
                        const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + b;
                      })));
                      const h = Math.max(...imgs.map(i => i.height));
                      const w = imgs.reduce((s, i) => s + i.width, 0);
                      const c = document.createElement('canvas'); c.width = w; c.height = h;
                      const ctx = c.getContext('2d');
                      ctx.fillStyle = '#f7f3eb'; ctx.fillRect(0, 0, w, h);
                      let x = 0;
                      for (const im of imgs) { ctx.drawImage(im, x, Math.round((h - im.height) / 2)); x += im.width; }
                      return c.toDataURL('image/jpeg', 0.90);
                    }""",
                    b64s,
                )
                (SHOTS_DIR / "flow.jpg").write_bytes(base64.b64decode(data_url.split(",", 1)[1]))
            print(f"Saved flow screenshot: {SHOTS_DIR / 'flow.jpg'}")
            page.close()

            # ----------------------------------------------------------------
            # 2. 移动端 360×740 + 无障碍名单模式 + 键盘控制测试
            # ----------------------------------------------------------------
            mobile = browser.new_page(viewport={"width": 360, "height": 740}, device_scale_factor=2)
            mobile.on("pageerror", lambda e: all_errors.append(f"mobile pageerror: {e}"))
            mobile.on("console", lambda m: all_errors.append(f"mobile console.{m.type}: {m.text}") if m.type == "error" else None)

            mobile.goto(url, wait_until="networkidle")
            mobile.click("button.primary")
            mobile.wait_for_selector(".hv-loading[hidden]", state="attached", timeout=15000)
            time.sleep(0.35)

            overflow = mobile.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
            assert not overflow, "Horizontal overflow detected on 360x740 mobile!"
            mobile.screenshot(path=str(SHOTS_DIR / "mobile-360.jpg"), type="jpeg", quality=90)

            # 测试键盘移动（ArrowLeft）激活抓按钮
            mobile.keyboard.down("ArrowLeft")
            time.sleep(0.25)
            mobile.keyboard.up("ArrowLeft")
            go_disabled = mobile.locator(".hv-go").is_disabled()
            assert not go_disabled, "Keyboard ArrowLeft should enable grab button"

            # 切换到无障碍名单模式
            mobile.click(".hv-alt")
            mobile.wait_for_selector(".hv.is-accessible .hv-list:not([hidden])", timeout=5000)
            time.sleep(0.5)  # 满足 minElapsedMs=400
            mobile.screenshot(path=str(SHOTS_DIR / "accessible-mode.jpg"), type="jpeg", quality=90)

            acc_target = mobile.evaluate("() => document.getElementById('scrim')._verifier.getChallenge().target")
            # 先点一个错误的
            wrong_btn = mobile.locator(f".hv-list-btn:not([data-character-id='{acc_target}'])").first
            wrong_btn.click()
            mobile.wait_for_function(
                "() => document.querySelector('.hv-pill')?.textContent?.includes('还可以试')",
                timeout=5000,
            )
            acc_wrong_pill = mobile.locator(".hv-pill").inner_text()
            print(f"[Accessible wrong] {acc_wrong_pill}")

            # 再点正确的
            time.sleep(0.25)
            mobile.locator(f".hv-list-btn[data-character-id='{acc_target}']").click()
            mobile.wait_for_selector(".app.is-done", timeout=6000)
            print("[Accessible pass] Verified and entered cleanly on 360x740!")

            if all_errors:
                print("ERRORS:", all_errors)
                raise SystemExit(1)

            browser.close()
            print("ALL E2E CHECKS PASSED WITH ZERO ERRORS!")
    finally:
        srv.shutdown()


if __name__ == "__main__":
    main()
