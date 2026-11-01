#!/usr/bin/env bash
# Invoked as ONE emulator-runner command. Never splice if/fi across action lines.
set -Eeuo pipefail
: "${CI:?Run only on an explicitly provisioned CI emulator}"
OUT="${HAIZ_QA_OUTPUT:-mobile-test-output}"
APK="${HAIZ_QA_APK:-world/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk}"
PACKAGE=space.haiz.study
mkdir -p "$OUT"
record_pid=''
collect() {
  local result=$?
  trap - EXIT
  if [[ -n "$record_pid" ]]; then
    adb shell pkill -2 screenrecord > "$OUT/record-stop.txt" 2>&1 || printf 'record stop failed\n' >> "$OUT/record-stop.txt"
    wait "$record_pid" || printf 'screenrecord exited before finalization\n' >> "$OUT/record-stop.txt"
    adb pull /sdcard/haiz-qa.mp4 "$OUT/android-session.mp4" > "$OUT/record-pull.txt" 2>&1 || printf 'record unavailable\n' >> "$OUT/record-pull.txt"
  fi
  adb exec-out screencap -p > "$OUT/final-screen.png" 2> "$OUT/screenshot-error.txt" || printf 'screenshot unavailable\n' >> "$OUT/screenshot-error.txt"
  adb logcat -d -v threadtime > "$OUT/logcat.txt" 2>&1 || printf 'logcat unavailable\n' >> "$OUT/logcat.txt"
  adb shell dumpsys activity activities > "$OUT/activity.txt" 2>&1 || printf 'activity unavailable\n' >> "$OUT/activity.txt"
  adb shell dumpsys meminfo "$PACKAGE" > "$OUT/memory.txt" 2>&1 || printf 'memory unavailable\n' >> "$OUT/memory.txt"
  printf '%s\n' "$result" > "$OUT/script-exit-code.txt"
  exit "$result"
}
trap collect EXIT
{ date -u; uname -a; nproc; free -m; df -h; ls -l /dev/kvm; } > "$OUT/runner.txt" 2>&1
adb devices -l > "$OUT/adb-devices.txt"
adb shell getprop > "$OUT/device-properties.txt"
adb shell settings put system screen_off_timeout 600000
adb shell input keyevent KEYCODE_WAKEUP
adb shell wm dismiss-keyguard
adb logcat -c
start=$SECONDS
adb install -r "$APK" > "$OUT/install-new.txt" 2>&1
printf '%s\n' "$((SECONDS-start))" > "$OUT/install-seconds.txt"
adb shell screenrecord --time-limit 180 /sdcard/haiz-qa.mp4 > "$OUT/screenrecord.txt" 2>&1 & record_pid=$!
launch() {
  local label=$1
  adb shell am start -W -n "$PACKAGE/.MainActivity" > "$OUT/$label-launch.txt" 2>&1
  # am start may return exit 0 with Status: timeout. Preserve and FAIL, do not hide it.
  if grep -Eqi 'Status:[[:space:]]*timeout|Error:|Exception' "$OUT/$label-launch.txt"; then
    cat "$OUT/$label-launch.txt"
    return 1
  fi
  adb shell pidof "$PACKAGE" > "$OUT/$label-pid.txt"
}
launch cold
node world/apps/mobile/tests/android-ui.mjs exercise
adb shell input keyevent KEYCODE_HOME
launch warm
node world/apps/mobile/tests/android-ui.mjs warm-resume
adb shell am force-stop "$PACKAGE"
launch force-reopen
node world/apps/mobile/tests/android-ui.mjs force-reopen
# Same signed candidate reinstall proves update preservation, not old-release signature compatibility.
adb shell am force-stop "$PACKAGE"
adb install -r "$APK" > "$OUT/reinstall-same-signature.txt" 2>&1
launch reinstall
node world/apps/mobile/tests/android-ui.mjs reinstall
printf 'PASS: emulator UI, offline, warm, force reopen and same-signature reinstall\n'
