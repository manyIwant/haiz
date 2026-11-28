package space.haiz.app.preview;

import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.util.Locale;

/**
 * HAIZ Native 001 · the Android shell.
 *
 *  - True immersive full screen: status and navigation bars are hidden and come back only
 *    transiently from an edge swipe; the app draws under the camera cut-out. The bars are hidden
 *    again on every resume and focus regain (the system shows them after dialogs and app switches).
 *  - The real insets (cut-out, transient bars, the IME) are measured here and handed to the page as
 *    CSS variables, because the WebView does not resize for the keyboard in an edge-to-edge window.
 *  - The window asks for the display's highest refresh rate at the current resolution (90 Hz on a
 *    vivo S10); vivo and others default app windows to 60 Hz unless asked.
 *  - The WebView rasters off-screen tiles ahead of scrolling and runs at important priority.
 */
public class MainActivity extends BridgeActivity {
    private int lastTop = -1, lastBottom = -1, lastLeft = -1, lastRight = -1, lastIme = -1;

    @Override public void onCreate(Bundle state) {
        registerPlugin(HaizNativePlugin.class);
        registerPlugin(HaizUpdaterPlugin.class);
        registerPlugin(HaizStorePlugin.class);
        registerPlugin(HaizVoicePlugin.class);
        super.onCreate(state);

        Window w = getWindow();
        WindowCompat.setDecorFitsSystemWindows(w, false);
        w.setStatusBarColor(Color.TRANSPARENT);
        w.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30
                ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            w.setAttributes(lp);
        }
        if (Build.VERSION.SDK_INT >= 29) { w.setStatusBarContrastEnforced(false); w.setNavigationBarContrastEnforced(false); }
        requestHighestRefreshRate();
        hideSystemBars();

        WebView web = bridge.getWebView();
        WebSettings s = web.getSettings();
        if (Build.VERSION.SDK_INT >= 23) s.setOffscreenPreRaster(true);
        if (Build.VERSION.SDK_INT >= 26) web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        View root = w.getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            pushInsets(insets);
            return ViewCompat.onApplyWindowInsets(v, insets);
        });

        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            private boolean navigate(Uri url) {
                String scheme = url.getScheme();
                if ("https".equals(scheme) && "localhost".equals(url.getHost())) return false;
                if ("https".equals(scheme) || "http".equals(scheme) || "mailto".equals(scheme) || "tel".equals(scheme) || "geo".equals(scheme)) return bridge.launchIntent(url);
                return true;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return navigate(request.getUrl()); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return navigate(Uri.parse(url)); }
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                lastTop = -1; // re-send the insets to the freshly loaded page
                WindowInsetsCompat i = ViewCompat.getRootWindowInsets(getWindow().getDecorView());
                if (i != null) pushInsets(i);
            }
        });
    }

    /** Hide both system bars; an edge swipe shows them transiently over the app. */
    void hideSystemBars() {
        Window w = getWindow();
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, w.getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }

    void showSystemBars() {
        Window w = getWindow();
        WindowCompat.getInsetsController(w, w.getDecorView()).show(WindowInsetsCompat.Type.systemBars());
    }

    private void requestHighestRefreshRate() {
        if (Build.VERSION.SDK_INT < 23) return;
        Display d = getWindowManager().getDefaultDisplay();
        Display.Mode cur = d.getMode(), best = cur;
        for (Display.Mode m : d.getSupportedModes()) {
            if (m.getPhysicalWidth() == cur.getPhysicalWidth() && m.getPhysicalHeight() == cur.getPhysicalHeight() && m.getRefreshRate() > best.getRefreshRate()) best = m;
        }
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.preferredDisplayModeId = best.getModeId();
        if (Build.VERSION.SDK_INT >= 30) lp.preferredRefreshRate = best.getRefreshRate();
        getWindow().setAttributes(lp);
    }

    float refreshRate() {
        return Build.VERSION.SDK_INT >= 23 ? getWindowManager().getDefaultDisplay().getRefreshRate() : 60f;
    }

    private void pushInsets(WindowInsetsCompat insets) {
        float dp = getResources().getDisplayMetrics().density;
        Insets cut = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
        // stable insets of the hidden bars are deliberately ignored: the app owns that space; only the
        // cut-out (and a gesture strip at the bottom for the home indicator) is protected
        Insets gest = insets.getInsets(WindowInsetsCompat.Type.mandatorySystemGestures());
        int ime = Build.VERSION.SDK_INT >= 30 ? insets.getInsets(WindowInsetsCompat.Type.ime()).bottom : 0;
        int top = Math.round(cut.top / dp), bottom = Math.round(Math.max(cut.bottom, Math.min(gest.bottom, 24 * dp)) / dp);
        int left = Math.round(cut.left / dp), right = Math.round(cut.right / dp), imeDp = Math.round(ime / dp);
        if (top == lastTop && bottom == lastBottom && left == lastLeft && right == lastRight && imeDp == lastIme) return;
        lastTop = top; lastBottom = bottom; lastLeft = left; lastRight = right; lastIme = imeDp;
        final String js = String.format(Locale.ROOT, "window.__haizInsets&&window.__haizInsets({top:%d,bottom:%d,left:%d,right:%d,ime:%d})", top, bottom, left, right, imeDp);
        WebView web = bridge == null ? null : bridge.getWebView();
        if (web != null) web.post(() -> web.evaluateJavascript(js, null));
    }

    @Override public void onResume() { super.onResume(); hideSystemBars(); }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }
}
