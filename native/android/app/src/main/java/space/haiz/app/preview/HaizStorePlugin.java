package space.haiz.app.preview;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.database.sqlite.SQLiteStatement;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;

/**
 * HAIZ Native 001 · local identities live in SQLite (Android's own, no extra native library), in the
 * app's private data directory: it survives in-place updates and is never uploaded. The schema and
 * every query live in the page (src/identity/db.ts), so the browser build runs the very same SQL on
 * sql.js. Backups go through the system file picker (Storage Access Framework): no storage permission.
 */
@CapacitorPlugin(name = "HaizStore")
public class HaizStorePlugin extends Plugin {
    private SQLiteDatabase db;

    private synchronized SQLiteDatabase db() {
        if (db == null) {
            db = new SQLiteOpenHelper(getContext(), "haiz-identities.db", null, 1) {
                @Override public void onConfigure(SQLiteDatabase d) { d.setForeignKeyConstraintsEnabled(true); d.enableWriteAheadLogging(); }
                @Override public void onCreate(SQLiteDatabase d) { }
                @Override public void onUpgrade(SQLiteDatabase d, int o, int n) { }
            }.getWritableDatabase();
        }
        return db;
    }

    private static Object[] args(JSONArray a) throws Exception {
        if (a == null) return new Object[0];
        Object[] o = new Object[a.length()];
        for (int i = 0; i < a.length(); i++) o[i] = a.isNull(i) ? null : a.get(i);
        return o;
    }
    private static void bind(SQLiteStatement st, Object[] a) {
        for (int i = 0; i < a.length; i++) {
            Object v = a[i];
            if (v == null) st.bindNull(i + 1);
            else if (v instanceof Integer || v instanceof Long) st.bindLong(i + 1, ((Number) v).longValue());
            else if (v instanceof Number) st.bindDouble(i + 1, ((Number) v).doubleValue());
            else if (v instanceof Boolean) st.bindLong(i + 1, ((Boolean) v) ? 1 : 0);
            else st.bindString(i + 1, v.toString());
        }
    }
    private static void run(SQLiteDatabase d, String sql, Object[] a) {
        SQLiteStatement st = d.compileStatement(sql);
        try { bind(st, a); st.execute(); } finally { st.close(); }
    }

    /** Several statements in one transaction: all or nothing. */
    @PluginMethod public void run(PluginCall call) {
        new Thread(() -> {
            SQLiteDatabase d = db();
            d.beginTransaction();
            try {
                JSArray list = call.getArray("statements");
                for (int i = 0; i < list.length(); i++) {
                    org.json.JSONObject s = list.getJSONObject(i);
                    run(d, s.getString("sql"), args(s.optJSONArray("params")));
                }
                d.setTransactionSuccessful();
                call.resolve();
            } catch (Exception e) { call.reject(e.getMessage()); }
            finally { d.endTransaction(); }
        }, "haiz-db").start();
    }

    @PluginMethod public void query(PluginCall call) {
        new Thread(() -> {
            try {
                Object[] a = args(call.getArray("params"));
                String[] sa = new String[a.length];
                for (int i = 0; i < a.length; i++) sa[i] = a[i] == null ? null : a[i].toString();
                Cursor c = db().rawQuery(call.getString("sql"), sa);
                JSArray rows = new JSArray();
                try {
                    String[] cols = c.getColumnNames();
                    while (c.moveToNext()) {
                        JSObject r = new JSObject();
                        for (int i = 0; i < cols.length; i++) {
                            switch (c.getType(i)) {
                                case Cursor.FIELD_TYPE_NULL: r.put(cols[i], JSObject.NULL); break;
                                case Cursor.FIELD_TYPE_INTEGER: r.put(cols[i], c.getLong(i)); break;
                                case Cursor.FIELD_TYPE_FLOAT: r.put(cols[i], c.getDouble(i)); break;
                                default: r.put(cols[i], c.getString(i));
                            }
                        }
                        rows.put(r);
                    }
                } finally { c.close(); }
                JSObject o = new JSObject(); o.put("rows", rows); call.resolve(o);
            } catch (Exception e) { call.reject(e.getMessage()); }
        }, "haiz-db").start();
    }

    /* ---------------- backups through the system file picker ---------------- */

    @PluginMethod public void saveFile(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE, call.getString("name", "haiz-backup.json"));
        startActivityForResult(call, i, "saved");
    }
    @ActivityCallback private void saved(PluginCall call, ActivityResult r) {
        if (call == null) return;
        if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null) { call.reject("cancelled"); return; }
        Uri u = r.getData().getData();
        try (OutputStream out = getContext().getContentResolver().openOutputStream(u, "wt")) {
            out.write(call.getString("text", "").getBytes(StandardCharsets.UTF_8));
            JSObject o = new JSObject(); o.put("uri", u.toString()); call.resolve(o);
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod public void openFile(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
        startActivityForResult(call, i, "opened");
    }
    @ActivityCallback private void opened(PluginCall call, ActivityResult r) {
        if (call == null) return;
        if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null) { call.reject("cancelled"); return; }
        try (InputStream in = getContext().getContentResolver().openInputStream(r.getData().getData())) {
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] b = new byte[65536]; int n;
            while ((n = in.read(b)) > 0) { bo.write(b, 0, n); if (bo.size() > 64 * 1024 * 1024) throw new IllegalStateException("文件过大"); }
            JSObject o = new JSObject(); o.put("text", new String(bo.toByteArray(), StandardCharsets.UTF_8)); call.resolve(o);
        } catch (Exception e) { call.reject(e.getMessage()); }
    }
}
