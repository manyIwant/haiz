#!/usr/bin/env bash
# Run as one shell script: reactivecircus/android-emulator-runner executes individual script lines separately.
set -Eeuo pipefail
OUT="mobile-test-output"
mkdir -p "$OUT"
APK="world/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
[[ -s "$APK" ]] || { echo "FAIL: APK missing: $APK"; exit 1; }
adb wait-for-device
adb install -r "$APK"
set +e
adb shell am start -W -n space.haiz.study/.MainActivity > "$OUT/activity-start.txt" 2>&1
START_RC=$?
set -e
cat "$OUT/activity-start.txt"
if [[ "$START_RC" -ne 0 ]] || grep -q 'Status: timeout' "$OUT/activity-start.txt"; then
  echo 'WARN: Activity timeout/error; collecting process, screenshot and WebView evidence.'
fi
sleep 18
adb logcat -d -s AndroidRuntime:E chromium:E Capacitor:V > "$OUT/android-logcat.txt" || true
adb exec-out screencap -p > "$OUT/android-screen.png" || true
adb exec-out uiautomator dump /dev/tty > "$OUT/android-window.xml" || true
if ! adb shell pidof space.haiz.study > "$OUT/pid.txt"; then
  echo 'FAIL: HAIZ process is not running; see logcat.'
  exit 1
fi
if ! grep -Eq '思路不必重来|你的第一张思路卡|开始一件小事|打开专注书桌|把思路留下来' "$OUT/android-window.xml"; then
  echo 'FAIL: Expected interactive study UI not exposed. Inspect screenshot, accessibility dump and logcat.'
  exit 1
fi
echo 'PASS: HAIZ process and expected interactive study UI are present.'
