package space.haiz.app.preview;

import android.app.ActivityManager;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Debug;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebView;
import androidx.webkit.WebViewCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Shell facts and controls the page needs: full screen, the system keyboard, device info for the perf panel. */
@CapacitorPlugin(name = "HaizNative")
public class HaizNativePlugin extends Plugin {
    private MainActivity act() { return (MainActivity) getActivity(); }

    @PluginMethod public void immersive(PluginCall call) {
        boolean on = call.getBoolean("on", true);
        getActivity().runOnUiThread(() -> { if (on) act().hideSystemBars(); else act().showSystemBars(); call.resolve(); });
    }

    /** Hide the system IME (the HAIZ keyboard takes over) or show it (the user chose the system keyboard). */
    @PluginMethod public void systemKeyboard(PluginCall call) {
        boolean show = call.getBoolean("show", false);
        getActivity().runOnUiThread(() -> {
            InputMethodManager imm = (InputMethodManager) getContext().getSystemService(Context.INPUT_METHOD_SERVICE);
            WebView web = getBridge().getWebView();
            if (show) { web.requestFocus(); imm.showSoftInput(web, 0); }
            else imm.hideSoftInputFromWindow(web.getWindowToken(), 0);
            call.resolve();
        });
    }

    /** Let the user pick another input method (the system picker). */
    @PluginMethod public void pickInputMethod(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            InputMethodManager imm = (InputMethodManager) getContext().getSystemService(Context.INPUT_METHOD_SERVICE);
            imm.showInputMethodPicker();
            call.resolve();
        });
    }

    /* ------------------------------------------------ Native 003 · frame timing from Android itself
     * FrameMetrics of the activity's window: the WebView's frames are drawn by the app's RenderThread,
     * so these are the real per-frame costs (including GPU time on Android 12+), without the
     * measurement itself forcing frames the way an rAF graph does. Collected only while asked for. */
    private final Object fmLock = new Object();
    private final java.util.ArrayList<long[]> fm = new java.util.ArrayList<>();
    private android.view.Window.OnFrameMetricsAvailableListener fmListener;
    private android.os.HandlerThread fmThread;

    @PluginMethod public void frameStart(PluginCall call) {
        if (Build.VERSION.SDK_INT < 24) { call.reject("Android 7+"); return; }
        getActivity().runOnUiThread(() -> {
            if (fmListener == null) {
                fmThread = new android.os.HandlerThread("haiz-fm"); fmThread.start();
                fmListener = (w, m, dropped) -> {
                    long total = m.getMetric(android.view.FrameMetrics.TOTAL_DURATION);
                    long gpu = Build.VERSION.SDK_INT >= 31 ? m.getMetric(android.view.FrameMetrics.GPU_DURATION) : -1;
                    long draw = m.getMetric(android.view.FrameMetrics.DRAW_DURATION) + m.getMetric(android.view.FrameMetrics.SYNC_DURATION) + m.getMetric(android.view.FrameMetrics.COMMAND_ISSUE_DURATION) + m.getMetric(android.view.FrameMetrics.SWAP_BUFFERS_DURATION);
                    long deadline = Build.VERSION.SDK_INT >= 31 ? m.getMetric(android.view.FrameMetrics.DEADLINE) : -1;
                    synchronized (fmLock) { if (fm.size() < 4000) fm.add(new long[] { total, gpu, draw, deadline, dropped }); }
                };
                getActivity().getWindow().addOnFrameMetricsAvailableListener(fmListener, new android.os.Handler(fmThread.getLooper()));
            }
            call.resolve();
        });
    }

    @PluginMethod public void frameStop(PluginCall call) {
        if (Build.VERSION.SDK_INT < 24) { call.resolve(); return; }
        getActivity().runOnUiThread(() -> {
            if (fmListener != null) { try { getActivity().getWindow().removeOnFrameMetricsAvailableListener(fmListener); } catch (Exception ignored) { } fmListener = null; }
            if (fmThread != null) { fmThread.quitSafely(); fmThread = null; }
            synchronized (fmLock) { fm.clear(); }
            call.resolve();
        });
    }

    /** frames since the last call: count, jank, and p50 / p95 / max of total, GPU and render-thread time (ms) */
    @PluginMethod public void frames(PluginCall call) {
        java.util.ArrayList<long[]> got;
        synchronized (fmLock) { got = new java.util.ArrayList<>(fm); fm.clear(); }
        JSObject o = new JSObject();
        o.put("frames", got.size());
        float hz = act().refreshRate();
        long vsync = (long) (1e9 / Math.max(30f, hz));
        int jank = 0; long skipped = 0;
        long[] total = new long[got.size()], gpu = new long[got.size()], draw = new long[got.size()];
        int ng = 0;
        for (int i = 0; i < got.size(); i++) {
            long[] f = got.get(i);
            total[i] = f[0]; draw[i] = f[2];
            if (f[1] >= 0) gpu[ng++] = f[1];
            long dl = f[3] > 0 ? f[3] : vsync;
            if (f[0] > dl) jank++;
            skipped += f[4];
        }
        o.put("jank", jank);
        o.put("droppedReported", skipped);
        o.put("total", pct(total, total.length));
        o.put("renderThread", pct(draw, draw.length));
        if (ng > 0) o.put("gpu", pct(gpu, ng));
        call.resolve(o);
    }

    private static JSObject pct(long[] v, int n) {
        JSObject o = new JSObject();
        if (n == 0) return o;
        long[] s = java.util.Arrays.copyOf(v, n);
        java.util.Arrays.sort(s);
        o.put("p50", s[n / 2] / 1e6);
        o.put("p95", s[Math.min(n - 1, (int) (n * 0.95))] / 1e6);
        o.put("max", s[n - 1] / 1e6);
        return o;
    }

    @PluginMethod public void info(PluginCall call) {
        JSObject o = new JSObject();
        o.put("model", Build.MANUFACTURER + " " + Build.MODEL);
        o.put("android", Build.VERSION.RELEASE);
        o.put("sdk", Build.VERSION.SDK_INT);
        o.put("refreshRate", act().refreshRate());
        PackageInfo wv = WebViewCompat.getCurrentWebViewPackage(getContext());
        o.put("webview", wv == null ? "?" : wv.packageName + " " + wv.versionName);
        ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(mi);
        o.put("memTotalMB", mi.totalMem / 1048576);
        o.put("memAvailMB", mi.availMem / 1048576);
        o.put("lowMemory", mi.lowMemory);
        Debug.MemoryInfo dm = new Debug.MemoryInfo();
        Debug.getMemoryInfo(dm);
        o.put("appPssMB", dm.getTotalPss() / 1024);
        if (Build.VERSION.SDK_INT >= 29) {
            android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            o.put("thermal", pm.getCurrentThermalStatus());
        }
        call.resolve(o);
    }
}
