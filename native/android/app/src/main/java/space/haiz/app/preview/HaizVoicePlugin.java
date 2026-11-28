package space.haiz.app.preview;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

/**
 * Voice input for the HAIZ keyboard's recorder. Uses the phone's own speech recognition service
 * (on-device or the vendor's), streaming partial text and the input level for the liquid recorder.
 * When the phone has no recognition service for apps, it falls back to the system voice-input
 * screen, and the page is told so it can say where the words came from.
 */
@CapacitorPlugin(name = "HaizVoice", permissions = { @Permission(alias = "mic", strings = { Manifest.permission.RECORD_AUDIO }) })
public class HaizVoicePlugin extends Plugin {
    private SpeechRecognizer rec;

    @PluginMethod public void available(PluginCall call) {
        JSObject o = new JSObject();
        o.put("recognizer", SpeechRecognizer.isRecognitionAvailable(getContext()));
        o.put("intent", new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).resolveActivity(getContext().getPackageManager()) != null);
        call.resolve(o);
    }

    @PluginMethod public void start(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) { viaIntent(call); return; }
        if (getPermissionState("mic") != PermissionState.GRANTED) { requestPermissionForAlias("mic", call, "micGranted"); return; }
        listen(call);
    }

    @PermissionCallback private void micGranted(PluginCall call) {
        if (getPermissionState("mic") == PermissionState.GRANTED) listen(call); else call.reject("没有麦克风权限", "denied");
    }

    private Intent intent(PluginCall call) {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("lang", "zh-CN"));
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        return i;
    }

    private void listen(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (rec != null) rec.destroy();
                rec = SpeechRecognizer.createSpeechRecognizer(getContext());
                rec.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle b) { emit("state", "listening"); }
                    @Override public void onBeginningOfSpeech() { emit("state", "speech"); }
                    @Override public void onRmsChanged(float db) { JSObject o = new JSObject(); o.put("db", db); notifyListeners("level", o); }
                    @Override public void onBufferReceived(byte[] buffer) {}
                    @Override public void onEndOfSpeech() { emit("state", "thinking"); }
                    @Override public void onError(int error) { JSObject o = new JSObject(); o.put("code", error); notifyListeners("error", o); }
                    @Override public void onResults(Bundle b) { text("final", b); }
                    @Override public void onPartialResults(Bundle b) { text("partial", b); }
                    @Override public void onEvent(int t, Bundle b) {}
                });
                rec.startListening(intent(call));
                JSObject o = new JSObject(); o.put("mode", "stream"); call.resolve(o);
            } catch (Exception e) { call.reject(e.getMessage() == null ? e.toString() : e.getMessage()); }
        });
    }

    private void viaIntent(PluginCall call) {
        try { startActivityForResult(call, intent(call), "intentResult"); }
        catch (ActivityNotFoundException e) { call.reject("这台手机没有可供应用使用的语音识别服务", "unavailable"); }
    }

    @ActivityCallback private void intentResult(PluginCall call, ActivityResult r) {
        JSObject o = new JSObject();
        o.put("mode", "system");
        String text = "";
        if (r.getData() != null) {
            ArrayList<String> l = r.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (l != null && !l.isEmpty()) text = l.get(0);
        }
        o.put("text", text);
        call.resolve(o);
    }

    @PluginMethod public void stop(PluginCall call) { getActivity().runOnUiThread(() -> { if (rec != null) rec.stopListening(); call.resolve(); }); }
    @PluginMethod public void cancel(PluginCall call) { getActivity().runOnUiThread(() -> { if (rec != null) { rec.cancel(); rec.destroy(); rec = null; } call.resolve(); }); }

    private void emit(String k, String v) { JSObject o = new JSObject(); o.put(k, v); notifyListeners("state", o); }
    private void text(String kind, Bundle b) {
        ArrayList<String> l = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        JSObject o = new JSObject(); o.put("text", l == null || l.isEmpty() ? "" : l.get(0));
        notifyListeners(kind, o);
    }

    @Override protected void handleOnDestroy() { if (rec != null) { rec.destroy(); rec = null; } }
}
