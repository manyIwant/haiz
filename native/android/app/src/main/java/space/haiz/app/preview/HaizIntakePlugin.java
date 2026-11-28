package space.haiz.app.preview;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;
import org.json.JSONArray;
import org.json.JSONObject;

/** 收件 · the page's handle on the opt-in notice queue (HaizIntakeStore) and the share sheet. */
@CapacitorPlugin(name = "HaizIntake")
public class HaizIntakePlugin extends Plugin {
    private static WeakReference<HaizIntakePlugin> live = new WeakReference<>(null);

    @Override public void load() { live = new WeakReference<>(this); }

    static void emit(JSONObject entry) {
        HaizIntakePlugin p = live.get();
        if (p == null) return;
        try { p.notifyListeners("entry", JSObject.fromJSONObject(entry)); } catch (Exception ignored) { }
    }

    @PluginMethod public void getConfig(PluginCall call) { resolve(call, HaizIntakeStore.config(getContext())); }

    @PluginMethod public void setConfig(PluginCall call) {
        JSONArray groups = call.getArray("groups", new JSArray());
        JSONObject sources = call.getObject("sources", new JSObject());
        resolve(call, HaizIntakeStore.setConfig(getContext(), Boolean.TRUE.equals(call.getBoolean("enabled", false)), groups, sources));
    }

    @PluginMethod public void openAccessSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (ActivityNotFoundException e) { call.reject("这台手机没有通知使用权设置页"); }
    }

    @PluginMethod public void entries(PluginCall call) {
        JSObject o = new JSObject();
        o.put("entries", HaizIntakeStore.entries(getContext()));
        call.resolve(o);
    }

    @PluginMethod public void ack(PluginCall call) {
        HaizIntakeStore.ack(getContext(), HaizIntakeStore.ids(call.getArray("ids", new JSArray())));
        call.resolve();
    }

    @PluginMethod public void clear(PluginCall call) { HaizIntakeStore.clear(getContext()); call.resolve(); }

    @PluginMethod public void startDiscovery(PluginCall call) { HaizIntakeStore.startDiscovery(getContext()); resolve(call, HaizIntakeStore.config(getContext())); }
    @PluginMethod public void stopDiscovery(PluginCall call) { HaizIntakeStore.stopDiscovery(getContext()); call.resolve(); }
    @PluginMethod public void discovered(PluginCall call) {
        JSObject o = new JSObject();
        o.put("groups", HaizIntakeStore.found(getContext()));
        call.resolve(o);
    }

    private static void resolve(PluginCall call, JSONObject o) {
        try { call.resolve(JSObject.fromJSONObject(o)); } catch (Exception e) { call.reject(e.getMessage()); }
    }
}
