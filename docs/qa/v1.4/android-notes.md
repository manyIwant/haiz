# Android QA evidence — Mission 10

Date: 2026-10-27. Integration checkout: `a03da32` (PR21 `b308312` + PR22 `b65c783`, base `663b51d`). No Android or Flutter business source changed by Android QA.

## Build: PASS at compilation/signature layer

- Host: Apple Silicon macOS 26.6 / Darwin 25.6.0 arm64.
- Flutter 3.47.8, Dart 3.13.7; OpenJDK 21.0.13; Android compile/target SDK 36, min SDK 24.
- Unmodified command from `app/`: `flutter build apk --release --no-pub`.
- Result: exit 0, `Built build/app/outputs/flutter-apk/app-release.apk (105.9MB)`; original build log: `evidence/android-release-original-build.log`.
- Gradle consumes the existing local private signing configuration. QA did not read/print the properties or key and did not upload an APK or private material. A prior separate build also succeeded with a temporary synthetic seven-day QA certificate supplied only via `JAVA_TOOL_OPTIONS=-Duser.home=<temporary QA directory>`; no source signing configuration was edited. That synthetic build is not the final inspected APK.
- Final inspected original build: 105,878,504 bytes; SHA-256 `e6bf937bcb9a19d4de0710c3e72719391e374da233c7b2a5dec98222ac511666`.
- `apksigner verify --verbose`: exit 0; v2 true, v1/v3 false; one signer.
- `aapt dump badging`: package `space.haiz.app.preview`; versionName `1.3.0-preview.1`; versionCode `4`; min SDK 24, target SDK 36. This identifies an integration QA build whose package version was not bumped to v1.4. No release was created.
- Packaged permissions include `android.permission.INTERNET` and `ACCESS_NETWORK_STATE`. The main source manifest omits INTERNET, but the merged release manifest includes it from dependencies; source omission alone is not a reproduced connectivity defect.
- Evidence: `evidence/android-apk-inspection.log`, `evidence/android-environment.log`, `evidence/android-release-build.log` (synthetic signing experiment), `evidence/android-release-original-build.log`.

## Reproducibility boundary

`app/android/app/build.gradle.kts:34-44` unconditionally requires `$user.home/.config/haiz-android/signing.properties`; release selects that signing config at lines 47-52. The local successful build is not proof that a clean GitHub Actions runner without signing material can execute the same command. A future CI job must use reviewed synthetic signing or provision credentials securely. No private signing material belongs in the repository or public build logs.

## Device status

Initial `adb devices -l`: no attached Android device. `avdmanager list avd`: no AVD. Hypervisor.Framework acceleration check succeeds on this host. An Android Emulator binary (37.2.12) was installed by the previous setup command under `/opt/homebrew/share/android-commandlinetools/emulator`, rather than the canonical SDK.

The earlier SDK Manager command returned shell success but its log contains an actual package error:

> Warning: An error occurred while preparing SDK package Google APIs ARM 64 v8a System Image: Error reading Zip content from a SeekableByteChannel.

The corresponding image directory was empty. Therefore that command was not a working device environment. Android QA retried with explicit `--sdk_root=/Users/a11/Library/Android/sdk` and an official-image download, but obtained no usable AVD. The final independent recheck again returned an empty `adb devices -l` list and no entries from `emulator -list-avds`. Device acceptance is BLOCKED, not PASS. Download/package error logs remain in evidence; no device execution is claimed.

## Not yet certified

Compilation/signature checks do not certify APK installation, startup, login/logout, two-account switching, SharedPreferences durability after process death/reboot, native OCR, file picker/PDF/DOCX import, permission denial, rapid navigation, screen sizes, or offline/reconnect. These require an actually booted device or emulator and remain UNVERIFIED until separately evidenced. The native client accepts HTTPS remote origins and HTTP loopback only (`storage_scope.dart:13-21`); an emulator must use a suitable local reverse tunnel or a trusted HTTPS endpoint for backend testing. No cleartext-policy connectivity result is inferred from code alone.
