# v1.4 independent platform QA: ClassIsland and QQ

Date: 2026-10-27. Checkout: `/Users/a11/manyiwant/haiz-qa-v1.4`, HEAD `a03da324386b17d305e6a3698adc21f2b4bcf905`. Scope: integrations/classisland, integrations/qq-bot, read-only backend compatibility, this note and `evidence/platform/`. No business source edits, commits, QQ connection, real school data, or Windows installation. Backend source was read/imported to exercise synthetic integration contracts; no backend files changed by this QA.

## Verdict and evidence

| Area | Result | Evidence |
|---|---|---|
| QQ locked dependency installation | PASS, `npm ci --ignore-scripts`, 2 packages installed | [qq-install.log](evidence/platform/qq-install.log) |
| Existing adapter tests | PASS 2/2 | [qq-tests.log](evidence/platform/qq-tests.log) |
| npm dependency audit | PASS: 0 known vulnerabilities at run time; not a security guarantee | [qq-audit.json](evidence/platform/qq-audit.json) |
| Actual adapter + integrated backend compatibility | PASS 3/3 synthetic probes including SDK event shape and error propagation | [integration-probe.log](evidence/platform/integration-probe.log), [reproducible probe](evidence/platform/integration-probe.mjs) |
| Startup without QQ credentials | PASS: exit 1 with configuration message, before SDK import/start | [qq-missing-credentials.log](evidence/platform/qq-missing-credentials.log) |
| .NET restore + Release build | PASS: SDK 8.0.133, net8.0, 0 warnings / 0 errors, 5.79 seconds | [classisland-build.log](evidence/platform/classisland-build.log) |
| .cipx contents and integrity | PASS: CRC, manifest match, expected assembly; no screen config, .env or DB file | [classisland-package.log](evidence/platform/classisland-package.log), [inspection script](evidence/platform/inspect-package.py) |
| .NET dependency vulnerability audit | INCONCLUSIVE: exit 1, SSL unexpected EOF; no clean audit claim | [classisland-audit.log](evidence/platform/classisland-audit.log) |
| Resolved .NET dependency inventory | PASS inventory only, SDK resolves to 2.0.0.2, Avalonia 11.3.6 | [classisland-dependencies.json](evidence/platform/classisland-dependencies.json) |
| Windows import/install/render/lifecycle/CPU | NOT RUN, no available Windows runtime/VM/UIA host found | [host-tools.log](evidence/platform/host-tools.log) |

The build emitted an SDK packaging cleanup message, `rm: .../cipx/*.md5sum: No such file or directory`, on this first build. Packaging continued and produced a verified package. This message is retained in the log even though MSBuild reports zero warnings/errors.

## Implementation and contract review

Read actual `HomeworkComponent.cs`, `Plugin.cs`, project file and manifest; both integration READMEs; QQ `bot.mjs`, tests, package/lock; architecture WORK-REPORT/API-CONTRACT/COMPATIBILITY-V1.3/PR-DRAFT; backend legacy screen, relay, mapping, inbox and key-rotation routes and assignment projection; installed Tencent SDK dispatcher, QQBot callback wiring, default intents and logger.

The plugin is an Avalonia native `ComponentBase`, registered by the plugin entrance through `AddComponent`. It loads `haiz-screen.json` from `PluginConfigFolder`, requires a nonblank server URL and a 96-character key, permits HTTPS or local HTTP loopback, and requests `/api/screens/{key}`. It reads `className` plus assignment `subject`, `title` and nullable `due`, rendering at most five entries. It ignores additive id/version fields. Attach triggers a refresh and starts a 45-second timer; detach stops the timer. A shared HttpClient has a 7-second timeout; a per-component running flag avoids overlapping refreshes.

Synthetic HTTP evidence used the real exported `relayMention` and the integrated backend, with a disposable SQLite database and ephemeral loopback listener. It verifies valid HMAC acceptance, review-only intake, duplicate detection, manual publication, public screen JSON keys, nullable due, no sender/group/publisher/private fields, old-key rejection/new-key success after rotation, wrong signature rejection, unmapped group response, and ignored ordinary group events. V1 draft/review/retracted states remain absent from the legacy feed; a published v1 assignment appears with matching id/version. This proves the old JSON contract remains compatible with the parser's required field shape; it does not execute C# rendering.

The SDK 1.0.5 dispatcher produces the adapter's expected `kind`, `rawEventType`, `senderIsBot`, `messageId`, `groupOpenid` and `content`, and calls message handlers with `(ctx, msg)`. An offline probe imports the installed dispatcher and QQBot, invokes inbound handling, and asserts that callback/normalization shape without calling `bot.start`. No credentials, QQ account sessions, Tencent connection or production message are used.

## Findings requiring attention

### PLATFORM-01 — Readiness gap; stale-response behavior UNVERIFIED on host

References: `HomeworkComponent.cs:28-29,51-99`; architecture WORK-REPORT handoff row 06.

The v1.4 handoff calls for bearer projection, id/version cache, freshness/offline behavior and credential-rotation purge. Static inspection confirms the component still uses the key in the URL path, stores no persistent public cache, does not consume version/status and shows no last-success time. Its error branch sets a generic unavailable task string without clearing the class title. Config changes and visual detach do not cancel the in-flight request or check its credential generation before applying a response. These are code observations and readiness gaps. An old-class response appearing after a switch, delayed clearance following rotation, and post-detach UI updates are static risks only: they were not reproduced in a Windows/ClassIsland host and remain UNVERIFIED, without a confirmed-defect P level.

Legacy API compatibility passes, but this is not completed row-06 acceptance. Immediate clearance, freshness labeling, stale response suppression, real offline recovery and host behavior require target-host validation. Keep Windows/v1.4 integration acceptance open.

### PLATFORM-02 — Readiness gap: QQ has no durable retry/recovery queue

References: `bot.mjs:35-47,59-66`.

A relay has a 10-second timeout and errors propagate. Static inspection shows the live message handler catches an error, logs `error.message`, then returns; it neither persists nor retries the event and offers no delivery-failure receipt to a teacher. This is a known implementation limitation and offline-readiness gap, without a confirmed-defect P level. Synthetic probes confirm rejection propagation for 503, thrown offline error and malformed response JSON. Actual loss of a Tencent message, source redelivery and reconnect behavior were not reproduced and remain UNVERIFIED. Backend source deduplication would support retry safely; this adapter does not implement it. No reliable offline delivery claim is supported.

### PLATFORM-03 — MEDIUM: runtime SDK failures can be invisible; subscriptions are broader than forwarding

References: `bot.mjs:57-68`; installed SDK `QQBot.js:102,203-211,324-328`, gateway `constants.js:16-21`, `gateway-connection.js:322`.

The adapter registers ready/message callbacks only. Runtime SDK `error` and `disconnected` events have no handler and the default logger is a no-op. Startup rejection and per-relay errors are logged, but later gateway failures can be silent. The SDK defaults to FULL_INTENTS including private messages, guild members and group/C2C when no intents are set. The HAIZ adapter filters after receipt and forwards only group @mentions. This supports a minimal HAIZ-bound payload claim, not a claim that the process cannot receive other event classes when Tencent permissions permit them. Local group allowlisting is also absent; backend mapping rejects unmapped groups after the signed mention content has already reached HAIZ.

### PLATFORM-04 — Deployment boundary: public text requires content review

References: `HomeworkComponent.cs:80-89`; `bot.mjs:16-22`; backend screen projection.

The package contains no screen credentials and the tested screen response excludes structured student identity and internal fields. However, teacher-authored class names/titles and QQ text can contain names or other personal information. The plugin renders class name/subject/title verbatim; the adapter forwards mention content verbatim apart from trimming/truncation. Neither implements semantic PII detection. Human review/content policy, filesystem permissions for the cleartext screen configuration, proxy path-log redaction and classroom visibility remain deployment controls to verify. The screen credential grants read-only projection access and remains sensitive despite being distinct from a teacher session.

### PLATFORM-05 — MEDIUM: dependency/runtime compatibility remains bounded

References: project file lines 3,10; manifest lines 6-7; audit/host logs.

The SDK dependency floats at `2.0.0.*` without a committed lock, resolving to 2.0.0.2 today. Manifest advertises API 2.0.0.0 and plugin 0.1.0.0; runtimeconfig targets .NET 8. The .cipx has only five files (DLL, PDB, deps JSON, runtimeconfig JSON, manifest), relying on the host for excluded runtime/native dependencies. This builds against the restored API but does not establish Windows host dependency loading or ClassIsland 2.2 compatibility. The .NET vulnerability audit failed at TLS transport; inventory success does not clear vulnerabilities.

### PLATFORM-06 — LOW: IPv6 loopback differs between adapters

`relayMention` allows `::1` by comparing `URL.hostname`, but Node represents `http://[::1]` as hostname `[::1]`. Consequently that local HTTP URL is rejected by the HTTPS gate, unlike IPv4/localhost. Reproduced separately in `qq-edge-cases.log`. C# uses `Uri.IsLoopback` rather than this string list.

## Package record

Generated file: `integrations/classisland/HAIZ.ClassroomPlugin/cipx/HAIZ.ClassroomPlugin.cipx` (31,472 bytes).

- SHA256: `6ca33ec846c2a2e005a4fedfa5c5202db8d379aeddc1da92842d3bf712d71cb0`
- MD5: `AFA2A4E1FC286AE00240B54C63CAD4EA`, matches generated checksums.md (integrity record only, not signing/authenticity).
- Archive entries: HAIZ.ClassroomPlugin.dll (11,264), .pdb (18,440), .deps.json (62,856), .runtimeconfig.json (362), manifest.yml (283).
- No host executable, bundled screen config, .env, database, private key or student fixture file. Archive inspected in place without extraction.

## Host limits and required Windows acceptance

Actual host: macOS 26.6/Darwin 25.6.0 ARM64, Node 24.22.1/npm 11.19.1, .NET SDK 8.0.133/runtime 8.0.33. No wine/wine64, PowerShell on PATH, VBoxManage, prlctl, qemu-system-x86_64/aarch64, xfreerdp or mstsc. `/Applications` search found no UTM, Parallels, VMware, VirtualBox or ClassIsland entry. A local `/Users/a11/.dotnet/tools/pwsh` exists: with DOTNET_ROOT it runs PowerShell 7.4.14 **Unix**, sufficient for SDK packaging, not Windows UIA or installation. Its first direct invocation without DOTNET_ROOT failed to locate .NET; the configured invocation used for packaging succeeds. No authorized remote Windows host was supplied or contacted. No UIA/pywinauto test was run. These checks describe available tooling, not proof that no Windows machine exists elsewhere.

Pending on an authorized Windows ClassIsland 2.0 target: .cipx import and dependency load; add/remove/re-add component; UTF-8 Chinese text, empty and >5-item lists, long text/DPI clipping; missing/malformed config; 401/404/429/500, wrong TLS certificate, timeout, unplug/reconnect; class switch/rotation during an in-flight request and immediate stale-content clearance; restart/offline freshness; lifecycle disposal; screenshot/log/config privacy; sustained idle/error/refresh CPU and memory measurements alongside baseline ClassIsland. ClassIsland 2.2 requires its own migration/compatibility run. No CPU percentage, classroom-device receipt, successful render or crash-free offline claim is established by this QA.

QQ authorized production validation also remains pending: platform approval/intents, authorized group mapping, live mention receipt, reconnect, outage recovery/redelivery, rate limits and service supervision. Existing 2 adapter tests and 3 added evidence probes do not establish 80% coverage or production E2E.

## Reproduction commands

Run from any cwd; all project paths refer to this checkout. Logs in `docs/qa/v1.4/evidence/platform/` contain command output. Test databases are synthetic and removed by the probe. `npm ci` uses the committed lock and suppresses dependency lifecycle scripts.

```bash
QA_ROOT=/Users/a11/manyiwant/haiz-qa-v1.4
QA_EVIDENCE="$QA_ROOT/docs/qa/v1.4/evidence/platform"
QA_PLUGIN="$QA_ROOT/integrations/classisland/HAIZ.ClassroomPlugin"
npm --prefix "$QA_ROOT/integrations/qq-bot" ci --ignore-scripts > "$QA_EVIDENCE/qq-install.log" 2>&1
npm --prefix "$QA_ROOT/integrations/qq-bot" test > "$QA_EVIDENCE/qq-tests.log" 2>&1
npm --prefix "$QA_ROOT/integrations/qq-bot" audit --json > "$QA_EVIDENCE/qq-audit.json" 2>&1
node --test "$QA_EVIDENCE/integration-probe.mjs" > "$QA_EVIDENCE/integration-probe.log" 2>&1
DOTNET_ROOT=/opt/homebrew/opt/dotnet@8/libexec PATH="/Users/a11/.dotnet/tools:$PATH" dotnet build "$QA_PLUGIN/HAIZ.ClassroomPlugin.csproj" -c Release > "$QA_EVIDENCE/classisland-build.log" 2>&1
python3 -I "$QA_EVIDENCE/inspect-package.py" "$QA_PLUGIN" > "$QA_EVIDENCE/classisland-package.log" 2>&1
DOTNET_ROOT=/opt/homebrew/opt/dotnet@8/libexec dotnet list "$QA_PLUGIN/HAIZ.ClassroomPlugin.csproj" package --include-transitive --format json > "$QA_EVIDENCE/classisland-dependencies.json" 2>&1
DOTNET_ROOT=/opt/homebrew/opt/dotnet@8/libexec dotnet list "$QA_PLUGIN/HAIZ.ClassroomPlugin.csproj" package --vulnerable --include-transitive --format json > "$QA_EVIDENCE/classisland-audit.log" 2>&1
env -u HAIZ_QQ_APP_ID -u HAIZ_QQ_APP_SECRET -u HAIZ_QQ_RELAY_SECRET node "$QA_ROOT/integrations/qq-bot/bot.mjs" > "$QA_EVIDENCE/qq-missing-credentials.log" 2>&1
```

The final command is expected to exit 1. The vulnerability audit exited 1 because of an SSL unexpected EOF. The other listed commands exited 0. Package hashes may change on rebuild due to build/archive metadata; always rerun the inspection and use the resulting hashes.

Host evidence can be reproduced with `date -u`, `uname -a`, `sw_vers`, `node --version`, `npm --version`, `dotnet --info`; `command -v` for wine/wine64/pwsh/powershell/VBoxManage/prlctl/qemu-system-x86_64/qemu-system-aarch64/xfreerdp/mstsc; `/usr/bin/find /Applications -maxdepth 2` with case-insensitive names matching UTM/Parallels/VMware/VirtualBox/ClassIsland; and `DOTNET_ROOT=/opt/homebrew/opt/dotnet@8/libexec /Users/a11/.dotnet/tools/pwsh -NoProfile -Command '$PSVersionTable | ConvertTo-Json'`. Missing-command lookups return nonzero as expected. The exact inventory result is retained in host-tools.log.
