#!/usr/bin/env bash
set -Eeuo pipefail
: "${HAIZ_SIM:?A supported CI simulator UDID must be selected}"
OUT=mobile-test-output
mkdir -p "$OUT"
xcrun simctl list devices available -j > "$OUT/simulator-devices.json"
{ sw_vers; xcodebuild -version; sysctl hw.memsize hw.ncpu; df -h; } > "$OUT/runner.txt"
xcrun simctl boot "$HAIZ_SIM"
xcrun simctl bootstatus "$HAIZ_SIM" -b
ruby tests/ios/create-ui-target.rb
xcodebuild -workspace ios/App/App.xcworkspace -scheme HAIZQA -sdk iphonesimulator -configuration Debug -destination "platform=iOS Simulator,id=$HAIZ_SIM" -derivedDataPath build/ios-sim CODE_SIGNING_ALLOWED=NO build-for-testing 2>&1 | tee "$OUT/build-for-testing.log"
xcrun simctl install "$HAIZ_SIM" build/ios-sim/Build/Products/Debug-iphonesimulator/App.app
video_pid=''
collect() {
  local result=$?
  trap - EXIT
  if [[ -n "$video_pid" ]]; then kill -INT "$video_pid" 2>/dev/null || printf 'video already stopped\n'; wait "$video_pid" || printf 'video interrupted\n'; fi
  xcrun simctl io "$HAIZ_SIM" screenshot "$OUT/ios-final-screen.png" > "$OUT/screenshot.log" 2>&1 || printf 'screenshot unavailable\n' >> "$OUT/screenshot.log"
  xcrun simctl spawn "$HAIZ_SIM" log show --last 5m --style compact --predicate 'process == "App" OR process == "HAIZ Study"' > "$OUT/ios-log.txt" 2>&1 || printf 'native log unavailable\n' >> "$OUT/ios-log.txt"
  printf '%s\n' "$result" > "$OUT/script-exit-code.txt"
  exit "$result"
}
trap collect EXIT
xcrun simctl io "$HAIZ_SIM" recordVideo "$OUT/ios-session.mp4" > "$OUT/video.log" 2>&1 & video_pid=$!
xcodebuild -workspace ios/App/App.xcworkspace -scheme HAIZQA -destination "platform=iOS Simulator,id=$HAIZ_SIM" -derivedDataPath build/ios-sim -resultBundlePath "$OUT/startup.xcresult" -only-testing:HAIZUITests/StartupTests/testColdNavigationAndRecovery CODE_SIGNING_ALLOWED=NO test-without-building 2>&1 | tee "$OUT/startup-ui.log"
# Reinstall the same build without uninstall or data reset, then verify the saved UI value.
xcrun simctl install "$HAIZ_SIM" build/ios-sim/Build/Products/Debug-iphonesimulator/App.app
xcodebuild -workspace ios/App/App.xcworkspace -scheme HAIZQA -destination "platform=iOS Simulator,id=$HAIZ_SIM" -derivedDataPath build/ios-sim -resultBundlePath "$OUT/reinstall.xcresult" -only-testing:HAIZUITests/StartupTests/testReinstallKeepsNote CODE_SIGNING_ALLOWED=NO test-without-building 2>&1 | tee "$OUT/reinstall-ui.log"
xcrun xcresulttool export attachments --path "$OUT/startup.xcresult" --output-path "$OUT/startup-screenshots"
xcrun xcresulttool export attachments --path "$OUT/reinstall.xcresult" --output-path "$OUT/reinstall-screenshots"
printf 'PASS: WKWebView touch navigation, editable note, warm/cold recovery and same-build reinstall\n'
