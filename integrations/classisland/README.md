# HAIZ ClassIsland Unified Plugin v0.2 (preview)

## Packaging correction (2026-10-30)

The previously shared binary `artifacts/HAIZ-ClassIsland-Unified-v0.2.0-preview.cipx` is incomplete: it lacks the README.md file that the ClassIsland plugin manager opens by default, and it also lacks an icon. **Do not re-install the old package.** The source now includes `HAIZ.ClassroomPlugin/README.md` and `icon.png`, and the manifest references them explicitly in version 0.2.1.0. The new package needs to be rebuilt from source or locally patched and tested; no Windows host-load test has yet been performed.


This one ClassIsland 2.0 / .NET8 native plugin contains:
- The existing HAIZ homework component (poll every 45s).
- A separate, OPT-IN evening auto board using actual ClassIsland ILessonsService / IProfileService timetable information. It selects the LAST TWO enabled lessons named 自习 or 晚修, or matching explicitly configured subject GUIDs, with no hardcoded clock schedule.
- Every 2s it checks the current class slot. Only inside either of the last two valid slots does it fetch the HAIZ Academic readonly homework feed; it refreshes every 45s while active, hides at the end/between slots, and suppresses re-opening the same slot after the teacher manually closes it.
- Fail closed: no overlay on missing timetable, invalid key, missing HTTPS, API errors, or any response lacking readOnly=true and containsStudentIdentity=false.
- No student identity data, no mutations to ClassIsland timetables/notifications, no topmost/focus-stealing overlay. The ordinary manually-added component remains available.

## Manual configuration, only on authorized Windows test equipment

Save a private haiz-screen.json file under the ClassIsland plugin configuration folder (PluginConfigFolder). This file is NOT included in the package:

    {
      "enabled": false,
      "eveningAutoShow": false,
      "serverUrl": "https://academic.example.com",
      "screenKey": "REPLACE_WITH_REAL_96_CHAR_READ_ONLY_KEY",
      "selfStudySubjectIds": []
    }

Leave enabled and eveningAutoShow false by default. Only after a teacher authorizes testing, enter a working serverUrl and key, then set both flags to true. The plugin still supports the existing HAIZ Academic Node.js read-only endpoint GET /api/screens/{screenKey}. It does NOT yet support the GD/Supabase RPC or a GitHub Pages static URL. Never commit screen keys, student data, auth cookies, service-role keys or real teacher passwords.

The current v1.3 server feed has no studyDate or withdrawal version support. The overlay therefore labels displayed tasks as 最近已发布任务, NOT guaranteed "today only". A later backend contract update and real hardware validation are necessary before production daily/withdrawal guarantees.

## Build and local tests

Mac / .NET8:
- dotnet build integrations/classisland/HAIZ.ClassroomPlugin/HAIZ.ClassroomPlugin.csproj -c Release /p:CreateCipx=false
- dotnet run --project integrations/classisland/HAIZ.ClassroomPlugin.Tests/HAIZ.ClassroomPlugin.Tests.csproj -c Release

If the ClassIsland PluginSdk's official cipx packaging requires unavailable PowerShell (pwsh), manually zip together manifest.yml and the .NET8 Release output and use the .cipx extension. Verify the manifest/dll exist and the ZIP is valid.

## Hardware acceptance checklist (all NOT YET VERIFIED on Seewo Windows)

W01 ClassIsland 2.0 exact version / plugin SDK support; reject 1.x, assess 2.1/2.2 separately.
W02 Import .cipx and restart ClassIsland; host starts without exceptions; lesson timer unchanged.
W03 Default disabled/missing config -> no automatic window or network request.
W04 Today temporary timetable: last two study lessons -> auto opens within next poll.
W05 First study end, between-period break, second study start -> hide, hide, reopen.
W06 Missing or conflicting lessons, disabled lessons, unmatched study names -> fail closed.
W07 Teacher closes window -> does not reopen in same period; next period allowed.
W08 HTTPS read-only token; wrong/revoked key; class isolation and no personal data.
W09 Network disconnect/API 401/404/500 -> no stale overlay and host remains healthy.
W10 Time change, wake from sleep, after midnight, substitute schedule.
W11 Classroom display resolution, teacher software fullscreen, no focus theft.
W12 CPU/RAM after 2h, plugin uninstallation / cleanup.
W13 Date-scoped visibility and instant withdrawal: PENDING BACKEND CONTRACT.
W14 GD/Supabase cross-device sync: PENDING DATABASE DEPLOYMENT AND ADAPTER.

Tests use fictional homework and a teacher-approved timetable. Document exact Windows/ClassIsland versions, screenshots, start/end timestamps, network failures and test results; do not call build-only verification "real classroom verified".

Source reference: existing experimental timetable prototype in world/plugins/classisland/Haiz.ClassIsland, combined with the already-packaged native ClassIsland component integration.
