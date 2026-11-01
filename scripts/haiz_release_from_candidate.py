#!/usr/bin/env python3
"""Release a HAIZ APK, signed ONLY on its owner's Mac.

Usage:
  python3 scripts/haiz_release_from_candidate.py RUN_ID 1.5.0 2100 "更新说明"

The keystore, passwords and signing.properties are never sent to GitHub.
Only the resulting ordinary signed APK, SHA-256 and public update manifest
are uploaded. Requires gh login and Android SDK build-tools locally.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time

REPO = "manyIwant/haiz"
PACKAGE = "space.haiz.app.preview"
ARCHIVED_BUILD = 2008
OLD_SIGNER_SHA256 = "fec8d3962d1d35cf6a975722734da7d525e166421994c5d175ab71fc3c89d169"


def run(*args, input_text=None, extra_env=None, check=True):
    env = dict(os.environ, **(extra_env or {}))
    return subprocess.run(
        args, input=input_text, text=True, capture_output=True,
        check=check, env=env, timeout=240,
    )


def github_read(*args):
    """Retry transient GitHub network errors, never retry writes blindly."""
    last = None
    for attempt in range(4):
        result = run(*args, check=False)
        if result.returncode == 0 or "HTTP 404" in result.stderr:
            return result
        last = result
        time.sleep(2 ** attempt)
    raise RuntimeError("GitHub read/download failed after retries")


def github_json(endpoint):
    result = github_read("gh", "api", endpoint)
    if result.returncode:
        raise RuntimeError("GitHub API resource not found")
    return json.loads(result.stdout)


def get_tools():
    sdk = Path.home() / "Library/Android/sdk/build-tools"
    candidates = sorted((p for p in sdk.iterdir() if (p / "apksigner").exists()),
                        key=lambda p: tuple(int(n) for n in re.findall(r"\d+", p.name)))
    if not candidates:
        raise RuntimeError("Android SDK build-tools / apksigner is missing")
    return candidates[-1] / "apksigner", candidates[-1] / "aapt"


def signing_properties():
    config = Path.home() / ".config/haiz-android/signing.properties"
    props = dict(
        line.split("=", 1)
        for line in config.read_text().splitlines()
        if "=" in line and not line.lstrip().startswith("#")
    )
    for name in ("storeFile", "storePassword", "keyAlias", "keyPassword"):
        if not props.get(name):
            raise RuntimeError("Missing signing field: " + name)
    keystore = Path(props["storeFile"])
    if not keystore.is_file():
        raise RuntimeError("Existing HAIZ keystore not found")
    return props


def verify_signature(apksigner, apk):
    details = run(str(apksigner), "verify", "--print-certs", str(apk)).stdout
    match = re.search(r"Signer #1 certificate SHA-256 digest:\s*([0-9a-fA-F]+)", details)
    if not match:
        raise RuntimeError("Unable to verify APK certificate")
    digest = match.group(1).lower()
    if digest != OLD_SIGNER_SHA256:
        raise RuntimeError("APK certificate does not match shipped HAIZ v1.4.0")
    return digest


def verify_package(aapt, apk, version, code):
    info = run(str(aapt), "dump", "badging", str(apk)).stdout.splitlines()[0]
    match = re.match(
        r"^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'",
        info,
    )
    if not match:
        raise RuntimeError("Unable to read Android package metadata")
    fields = dict(zip(("name", "versionCode", "versionName"), match.groups()))
    if fields != {"name": PACKAGE, "versionCode": str(code), "versionName": version}:
        raise RuntimeError("Package ID or version mismatch: " + str(fields))


def read_existing_manifest():
    result = github_read("gh", "api", f"repos/{REPO}/contents/updates/latest.json")
    if result.returncode != 0:
        if "HTTP 404" in result.stderr:
            return None, None
        raise RuntimeError("Unable to verify current update manifest")
    payload = json.loads(result.stdout)
    content = base64.b64decode(payload["content"]).decode("utf-8")
    return payload["sha"], json.loads(content)


def main():
    if len(sys.argv) != 5:
        raise SystemExit("Usage: script RUN_ID VERSION VERSION_CODE RELEASE_NOTES")
    run_id, version, raw_code, notes = sys.argv[1:]
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version):
        raise RuntimeError("Version must look like 1.5.0")
    if not raw_code.isdecimal() or int(raw_code) <= ARCHIVED_BUILD:
        raise RuntimeError("Version code must exceed shipped v1.4.0 code 2008")
    code = int(raw_code)
    if len(notes) > 2000:
        raise RuntimeError("Release notes must be at most 2000 characters")

    run_info = github_json(f"repos/{REPO}/actions/runs/{run_id}")
    if (run_info.get("conclusion") != "success" or
            run_info.get("event") != "workflow_dispatch" or
            run_info.get("name") != "HAIZ Android candidate · local signing only"):
        raise RuntimeError("Candidate run has not successfully completed")
    manifest_sha, previous = read_existing_manifest()
    if previous and code <= int(previous["versionCode"]):
        raise RuntimeError("Version code must exceed the current published update")

    tag = f"haiz-android-v{version}"
    if run("gh", "release", "view", tag, "--repo", REPO, check=False).returncode == 0:
        raise RuntimeError("Release tag already exists; refusing to replace signed APK")

    props = signing_properties()
    apksigner, aapt = get_tools()
    with tempfile.TemporaryDirectory(prefix="haiz-release-") as temp:
        folder = Path(temp)
        artifact = f"haiz-android-candidate-{version}-{code}"
        print("Downloading CI candidate (not yet suitable for distribution)...", flush=True)
        github_read("gh", "run", "download", str(run_id), "--repo", REPO,
                    "--name", artifact, "--dir", str(folder))
        candidate = folder / "HAIZ-Pocket-Android-CANDIDATE.apk"
        if not candidate.is_file() or candidate.stat().st_size < 1_000_000:
            raise RuntimeError("Candidate APK missing")
        verify_package(aapt, candidate, version, code)

        signed = folder / "HAIZ-Pocket-Android.apk"
        env = {
            "HAIZ_STORE_PASS": props["storePassword"],
            "HAIZ_KEY_PASS": props["keyPassword"],
        }
        print("Signing locally with the existing HAIZ keystore...", flush=True)
        run(str(apksigner), "sign",
            "--ks", props["storeFile"],
            "--ks-key-alias", props["keyAlias"],
            "--ks-pass", "env:HAIZ_STORE_PASS",
            "--key-pass", "env:HAIZ_KEY_PASS",
            "--out", str(signed), str(candidate), extra_env=env)
        verify_package(aapt, signed, version, code)
        verify_signature(apksigner, signed)

        sha = hashlib.sha256()
        with signed.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                sha.update(chunk)
        sha256 = sha.hexdigest()
        checksum = folder / "SHA256SUMS.txt"
        checksum.write_text(f"{sha256}  HAIZ-Pocket-Android.apk\n")
        print("Old signer identity confirmed; publishing signed APK only.", flush=True)
        run("gh", "release", "create", tag,
            str(signed), str(checksum),
            "--repo", REPO, "--target", run_info["head_sha"],
            "--title", f"HAIZ Android {version}",
            "--notes", notes,
            "--latest")

        update = dict(
            packageId=PACKAGE,
            versionName=version,
            versionCode=code,
            apkUrl=(f"https://github.com/{REPO}/releases/download/"
                    f"{tag}/HAIZ-Pocket-Android.apk"),
            sha256=sha256,
            sizeBytes=signed.stat().st_size,
            notes=notes,
        )
        encoded = base64.b64encode(
            (json.dumps(update, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        ).decode()
        body = {"message": f"chore(updates): publish Android {version}",
                "branch": "main", "content": encoded}
        if manifest_sha:
            body["sha"] = manifest_sha
        run("gh", "api", "--method", "PUT",
            f"repos/{REPO}/contents/updates/latest.json",
            "--input", "-", input_text=json.dumps(body))
        print(f"Published version {version} (code {code}) and its update manifest.", flush=True)
        print("Signing key remained on this Mac. Real device upgrade is not yet tested.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError, OSError, KeyError, ValueError) as exc:
        # Do not dump subprocess env or private signing properties.
        print("Release failed. Check CI artifact, GitHub authorization and local signing setup.")
        print(type(exc).__name__ + ": " + (
            str(exc) if not isinstance(exc, subprocess.CalledProcessError) else "External command failed"
        ))
        sys.exit(1)
