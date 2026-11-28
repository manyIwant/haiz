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
