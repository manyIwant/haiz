package space.haiz.app.preview;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;

/**
 * HAIZ Native 001 · one-tap updates, restored from the Flutter-era HaizUpdateInstaller and widened:
 *
 *  manifest  HTTPS only, ≤ 64 KB, follows the GitHub release redirect
 *  download  streamed to the app's private cache, resumable (HTTP Range) after pause or failure,
 *            progress events, byte count and SHA-256 checked against the manifest
 *  install   only the verified file: same package, strictly newer versionCode and the SAME signing
 *            certificate as the installed app, then Android's own installer asks the user. The app's
 *            data directory (SQLite identities, preferences) is untouched by an in-place update.
 */
@CapacitorPlugin(name = "HaizUpdater")
public class HaizUpdaterPlugin extends Plugin {
    private static final long MAX_APK = 400L * 1024 * 1024;
    private volatile Thread worker;
    private volatile boolean stop;

    private File dir() { File d = new File(getContext().getCacheDir(), "haiz_updates"); d.mkdirs(); return d; }
    private File part(long code) { return new File(dir(), "haiz-" + code + ".apk.part"); }
    private File done(long code) { return new File(dir(), "haiz-" + code + ".apk"); }

    @SuppressWarnings("deprecation")
    private long codeOf(PackageInfo p) { return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode; }

    @PluginMethod public void installed(PluginCall call) {
        try {
            PackageInfo p = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject o = new JSObject();
            o.put("packageId", p.packageName);
            o.put("versionCode", codeOf(p));
            o.put("versionName", p.versionName);
            o.put("installedAt", p.firstInstallTime);
            o.put("updatedAt", p.lastUpdateTime);
            o.put("certSha256", certDigest(installedSignatures()));
            call.resolve(o);
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    /** Fetch a small JSON manifest over HTTPS (native, so no CORS between github.com and its CDN). */
    @PluginMethod public void fetchManifest(PluginCall call) {
        String url = call.getString("url", "");
        new Thread(() -> {
            try {
                if (!url.startsWith("https://")) throw new HaizUpdateArgs.Fail(HaizUpdateArgs.BAD_VALUE, "更新清单必须使用 HTTPS");
                HttpURLConnection c = open(url, -1);
                int code = c.getResponseCode();
                if (code == 404) { JSObject o = new JSObject(); o.put("status", 404); call.resolve(o); return; }
                if (code != 200) throw new HaizUpdateArgs.Fail(HaizUpdateArgs.NETWORK, "清单请求失败 HTTP " + code);
                InputStream in = c.getInputStream();
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                byte[] b = new byte[8192]; int n;
                while ((n = in.read(b)) > 0) { bo.write(b, 0, n); if (bo.size() > 65536) throw new HaizUpdateArgs.Fail(HaizUpdateArgs.BAD_VALUE, "清单过大"); }
                in.close();
                JSObject o = new JSObject();
                o.put("status", 200);
                o.put("text", new String(bo.toByteArray(), StandardCharsets.UTF_8));
                call.resolve(o);
            } catch (HaizUpdateArgs.Fail e) { call.reject(e.getMessage(), e.code); }
            catch (Exception e) { call.reject("网络异常：" + (e.getMessage() == null ? e.toString() : e.getMessage()), HaizUpdateArgs.NETWORK); }
        }, "haiz-manifest").start();
    }

    /** How much of a version is already here (to offer "继续下载" after a pause or a restart). */
    @PluginMethod public void local(PluginCall call) {
        long code;
        try { code = HaizUpdateArgs.versionCode(call.getData().opt("versionCode")); }
        catch (HaizUpdateArgs.Fail f) { call.reject(f.getMessage(), f.code); return; }
        JSObject o = new JSObject();
        o.put("partial", part(code).length());
        o.put("complete", done(code).isFile());
        call.resolve(o);
    }

    @PluginMethod public void download(PluginCall call) {
        final HaizUpdateArgs.Download req;
        try { req = HaizUpdateArgs.download(call.getData().opt("url"), call.getData().opt("sha256"), call.getData().opt("sizeBytes"), call.getData().opt("versionCode")); }
        catch (HaizUpdateArgs.Fail f) { call.reject(f.getMessage(), f.code); return; }
        final String url = req.url, sha = req.sha256;
        final long size = req.size, code = req.code;
        if (worker != null && worker.isAlive()) { call.reject("已在下载", HaizUpdateArgs.BUSY); return; }
        call.setKeepAlive(true);
        stop = false;
        worker = new Thread(() -> {
            File p = part(code), f = done(code);
            try {
                for (File old : dir().listFiles()) if (!old.equals(p) && !old.equals(f)) old.delete();
                if (f.isFile() && f.length() == size && sha.equals(sha256(f))) { finish(call, f, size); return; }
                f.delete();
                long have = p.isFile() ? p.length() : 0;
                if (have > size) { p.delete(); have = 0; }
                int attempts = 0;
                while (have < size) {
                    try {
                        HttpURLConnection c = open(url, have);
                        int rc = c.getResponseCode();
                        if (rc == 200 && have > 0) { have = 0; p.delete(); }        // server ignored Range: start over
                        else if (rc != 200 && rc != 206) throw new HaizUpdateArgs.Fail(HaizUpdateArgs.NETWORK, "下载失败 HTTP " + rc);
                        InputStream in = c.getInputStream();
                        RandomAccessFile out = new RandomAccessFile(p, "rw");
                        out.seek(have);
                        byte[] b = new byte[64 * 1024]; int n; long lastEmit = 0, t0 = System.currentTimeMillis(), start = have;
                        try {
                            while ((n = in.read(b)) > 0) {
                                if (stop) break;
                                if (have + n > size) throw new HaizUpdateArgs.Fail(HaizUpdateArgs.SIZE_MISMATCH, "安装包超出清单声明的大小");
                                out.write(b, 0, n); have += n;
                                long now = System.currentTimeMillis();
                                if (now - lastEmit > 120) { lastEmit = now; emit(have, size, (have - start) * 1000.0 / Math.max(1, now - t0)); }
                            }
                        } finally { out.close(); in.close(); c.disconnect(); }
                        if (stop) { JSObject o = new JSObject(); o.put("state", "paused"); o.put("received", have); o.put("total", size); call.resolve(o); call.setKeepAlive(false); return; }
                        attempts = 0;
                    } catch (Exception e) {
                        if (stop || (e instanceof HaizUpdateArgs.Fail && !HaizUpdateArgs.NETWORK.equals(((HaizUpdateArgs.Fail) e).code))) throw e;
                        if (++attempts > 4) throw new HaizUpdateArgs.Fail(HaizUpdateArgs.NETWORK, "网络异常，下载失败：" + (e.getMessage() == null ? e.toString() : e.getMessage()));                                   // network retries with backoff
                        emitState("retry", attempts);
                        Thread.sleep(1000L * attempts * attempts);
                    }
                }
                emit(size, size, 0);
                emitState("verifying", 0);
                if (p.length() != size) throw new HaizUpdateArgs.Fail(HaizUpdateArgs.SIZE_MISMATCH, "下载不完整，文件大小与清单不符");
                if (!sha.equals(sha256(p))) { p.delete(); throw new HaizUpdateArgs.Fail(HaizUpdateArgs.SHA_MISMATCH, "安装包 SHA-256 校验失败，已删除，请重试"); }
                if (!p.renameTo(f)) throw new HaizUpdateArgs.Fail(HaizUpdateArgs.IO, "无法保存安装包");
                finish(call, f, size);
            } catch (HaizUpdateArgs.Fail e) {
                call.reject(e.getMessage(), e.code);
                call.setKeepAlive(false);
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? e.toString() : e.getMessage(), HaizUpdateArgs.IO);
                call.setKeepAlive(false);
            }
        }, "haiz-update");
        worker.start();
    }

    private void finish(PluginCall call, File f, long size) {
        JSObject o = new JSObject();
        o.put("state", "verified"); o.put("received", size); o.put("total", size); o.put("file", f.getName());
        call.resolve(o);
        call.setKeepAlive(false);
    }

    @PluginMethod public void pause(PluginCall call) { stop = true; call.resolve(); }

    @PluginMethod public void discard(PluginCall call) {
        stop = true;
        for (File f : dir().listFiles()) f.delete();
        call.resolve();
    }

    @PluginMethod public void install(PluginCall call) {
        try {
            long code = HaizUpdateArgs.versionCode(call.getData().opt("versionCode"));
            File apk = done(code);
            if (!apk.isFile()) throw new HaizUpdateArgs.Fail(HaizUpdateArgs.NO_VERIFIED_APK, "没有已校验的安装包");
            PackageManager pm = getContext().getPackageManager();
            int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
            PackageInfo a = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
            if (a == null) throw new HaizUpdateArgs.Fail(HaizUpdateArgs.IO, "安装包无法读取");
            if (!getContext().getPackageName().equals(a.packageName)) throw new HaizUpdateArgs.Fail(HaizUpdateArgs.PACKAGE_MISMATCH, "安装包包名不一致");
            PackageInfo cur = pm.getPackageInfo(getContext().getPackageName(), 0);
            if (codeOf(a) != code || codeOf(a) <= codeOf(cur)) throw new HaizUpdateArgs.Fail(HaizUpdateArgs.VERSION_NOT_NEWER, "安装包版本无效或不比当前版本新");
            Signature[] sig = archiveSignatures(a);
            String want = certDigest(installedSignatures()), got = certDigest(sig);
            if (want.isEmpty() || !want.equals(got)) throw new HaizUpdateArgs.Fail(HaizUpdateArgs.SIGNATURE_MISMATCH, "安装包签名与当前应用不同，无法覆盖安装");
            if (Build.VERSION.SDK_INT >= 26 && !pm.canRequestPackageInstalls()) {
                getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName())));
                JSObject o = new JSObject(); o.put("state", "permission_required"); call.resolve(o); return;
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".updates", apk);
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK));
            JSObject o = new JSObject(); o.put("state", "installer_opened"); call.resolve(o);
        } catch (HaizUpdateArgs.Fail e) { call.reject(e.getMessage(), e.code); }
        catch (Exception e) { call.reject(e.getMessage() == null ? e.toString() : e.getMessage(), HaizUpdateArgs.IO); }
    }

    /* ---------------- helpers ---------------- */

    private HttpURLConnection open(String url, long from) throws Exception {
        String u = url;
        for (int hop = 0; hop < 6; hop++) {
            HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(15000); c.setReadTimeout(30000);
            c.setRequestProperty("User-Agent", "HAIZ-Android-Updater");
            c.setRequestProperty("Accept", "*/*");
            if (from > 0) c.setRequestProperty("Range", "bytes=" + from + "-");
            int rc = c.getResponseCode();
            if (rc == 301 || rc == 302 || rc == 303 || rc == 307 || rc == 308) {
                String loc = c.getHeaderField("Location"); c.disconnect();
                URL next = new URL(new URL(u), loc);
                if (!"https".equals(next.getProtocol())) throw new IllegalStateException("拒绝非 HTTPS 跳转");
                u = next.toString(); continue;
            }
            return c;
        }
        throw new IllegalStateException("跳转次数过多");
    }

    private void emit(long got, long total, double bps) {
        JSObject o = new JSObject(); o.put("received", got); o.put("total", total); o.put("bytesPerSecond", Math.round(bps));
        notifyListeners("progress", o);
    }
    private void emitState(String s, int attempt) { JSObject o = new JSObject(); o.put("state", s); o.put("attempt", attempt); notifyListeners("state", o); }

    private static String sha256(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(f)) { byte[] b = new byte[256 * 1024]; int n; while ((n = in.read(b)) > 0) md.update(b, 0, n); }
        return hex(md.digest());
    }
    private static String hex(byte[] d) { StringBuilder s = new StringBuilder(); for (byte x : d) s.append(String.format(Locale.ROOT, "%02x", x)); return s.toString(); }

    @SuppressWarnings("deprecation")
    private Signature[] installedSignatures() throws Exception {
        PackageManager pm = getContext().getPackageManager();
        if (Build.VERSION.SDK_INT >= 28) {
            PackageInfo p = pm.getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
            return p.signingInfo == null ? new Signature[0] : p.signingInfo.getApkContentsSigners();
        }
        return pm.getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNATURES).signatures;
    }
    @SuppressWarnings("deprecation")
    private static Signature[] archiveSignatures(PackageInfo a) {
        if (Build.VERSION.SDK_INT >= 28) return a.signingInfo == null ? new Signature[0] : a.signingInfo.getApkContentsSigners();
        return a.signatures == null ? new Signature[0] : a.signatures;
    }
    private static String certDigest(Signature[] s) throws Exception {
        if (s == null || s.length == 0) return "";
        String[] parts = new String[s.length];
        for (int i = 0; i < s.length; i++) parts[i] = hex(MessageDigest.getInstance("SHA-256").digest(s[i].toByteArray()));
        Arrays.sort(parts);
        return String.join(",", parts);
    }
}
