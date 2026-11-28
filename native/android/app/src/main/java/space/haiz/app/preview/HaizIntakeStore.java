package space.haiz.app.preview;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 收件 · the device-side notice queue (HAIZ Native 002).
 *
 * Migrated from HAIZ Pocket's MessageIntakeStore + SchoolNoticePolicy (PR #38), ported from
 * Kotlin to the Capacitor shell's Java. Explicit opt-in only:
 *
 *  - OFF by default. Nothing is kept unless the user turned intake on in HAIZ, chose at least one
 *    group, enabled that app as a source (WeChat is its own switch, never on by default), AND
 *    granted Android's notification access separately.
 *  - A notification is kept only when its conversation title / title / subtext (never the body)
 *    matches a chosen group, and its text reads like a task (an action, academic or deadline word).
 *    Everything else is dropped inside onNotificationPosted and never written anywhere.
 *  - Group discovery ("find my groups") is a 10-minute window the user starts; it remembers only
 *    the titles of conversations that look like group chats, no message text, and is cleared when
 *    the window ends or a group is chosen.
 *  - No network, no WeChat account, no reading of any other app's database or chat history: only
 *    notifications Android delivers from now on. The page imports the queue into the current
 *    identity's SQLite records and acknowledges it, after which the entries are deleted here.
 */
final class HaizIntakeStore {
    private static final String PREF = "haiz_intake_v1";
    private static final int MAX_QUEUE = 200, MAX_SEEN = 400, MAX_TEXT = 4000, MAX_GROUPS = 20;
    private static final long DISCOVERY_MS = 10 * 60 * 1000L, SEEN_MS = 7L * 24 * 60 * 60 * 1000;

    /** source apps HAIZ understands (each needs its own switch) */
    static final String[][] SOURCES = {
        { "com.tencent.mm", "wechat", "微信群通知" },
        { "com.tencent.mobileqq", "qq", "QQ 群通知" },
        { "com.tencent.tim", "tim", "TIM 群通知" },
        { "com.alibaba.android.rimet", "dingtalk", "钉钉群通知" },
        { "com.chaoxing.mobile", "chaoxing", "学习通通知" },
    };
    static String sourceOf(String pkg) { for (String[] s : SOURCES) if (s[0].equals(pkg)) return s[1]; return null; }
    static String labelOf(String key) { for (String[] s : SOURCES) if (s[1].equals(key)) return s[2]; return "系统分享"; }

    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREF, Context.MODE_PRIVATE); }

    static synchronized JSONObject config(Context c) {
        SharedPreferences p = prefs(c);
        JSONObject o = new JSONObject();
        try {
            o.put("enabled", p.getBoolean("enabled", false));
            o.put("groups", new JSONArray(p.getString("groups", "[]")));
            o.put("sources", new JSONObject(p.getString("sources", "{}")));
            o.put("granted", accessGranted(c));
            o.put("discoveringUntil", p.getLong("discoverUntil", 0));
            o.put("pending", new JSONArray(p.getString("queue", "[]")).length());
            JSONObject src = new JSONObject(p.getString("sources", "{}"));
            boolean any = false; for (String[] s : SOURCES) any |= src.optBoolean(s[1], false);
            boolean connected = p.getBoolean("connected", false);
            o.put("connected", connected);
            o.put("connectedAt", p.getLong("connectedAt", 0));
            o.put("state", HaizIntakePolicy.state(p.getBoolean("enabled", false), accessGranted(c), connected, any, new JSONArray(p.getString("groups", "[]")).length()));
            o.put("diag", new JSONObject(p.getString("diag", "{}")));
        } catch (Exception ignored) { }
        return o;
    }

    static synchronized JSONObject setConfig(Context c, boolean enabled, JSONArray groups, JSONObject sources) {
        JSONArray clean = new JSONArray();
        Set<String> seen = new HashSet<>();
        for (int i = 0; groups != null && i < groups.length() && clean.length() < MAX_GROUPS; i++) {
            String g = groups.optString(i, "").trim();
            if (g.length() > 48) g = g.substring(0, 48);
            if (g.length() >= 2 && seen.add(g)) clean.put(g);
        }
        JSONObject src = new JSONObject();
        for (String[] s : SOURCES) { try { src.put(s[1], sources != null && sources.optBoolean(s[1], false)); } catch (Exception ignored) { } }
        // the wish is stored as given; with no group chosen (or no access) the policy keeps nothing
        prefs(c).edit()
            .putBoolean("enabled", enabled)
            .putString("groups", clean.toString())
            .putString("sources", src.toString())
            .apply();
        return config(c);
    }

    static boolean accessGranted(Context c) {
        String raw = Settings.Secure.getString(c.getContentResolver(), "enabled_notification_listeners");
        if (raw == null) return false;
        for (String name : raw.split(":")) {
            ComponentName cn = ComponentName.unflattenFromString(name);
            if (cn != null && c.getPackageName().equals(cn.getPackageName()) && HaizIntakeListener.class.getName().equals(cn.getClassName())) return true;
        }
        return false;
    }

    static String bareTitle(String t) { return HaizIntakePolicy.bareTitle(t); }

    /** does this conversation look like a group (to list it during discovery)? */
    static boolean looksLikeGroup(boolean flagged, String text) {
        return flagged || (text != null && text.matches("^(\\[\\d+条\\])?\\s*(\\[[^\\]]{1,8}\\])?\\s*[^:：\\s]{1,24}[:：].+"));
    }

    static synchronized void discovered(Context c, String source, String title) {
        SharedPreferences p = prefs(c);
        if (System.currentTimeMillis() > p.getLong("discoverUntil", 0)) return;
        try {
            JSONArray arr = new JSONArray(p.getString("found", "[]"));
            String t = bareTitle(title);
            if (t.length() < 2) return;
            for (int i = 0; i < arr.length(); i++) { JSONObject o = arr.getJSONObject(i); if (t.equals(o.optString("title"))) { o.put("n", o.optInt("n") + 1); o.put("at", System.currentTimeMillis()); p.edit().putString("found", arr.toString()).apply(); return; } }
            if (arr.length() >= 40) return;
            arr.put(new JSONObject().put("title", t).put("source", source).put("n", 1).put("at", System.currentTimeMillis()));
            p.edit().putString("found", arr.toString()).apply();
        } catch (Exception ignored) { }
    }
    static synchronized void startDiscovery(Context c) { prefs(c).edit().putLong("discoverUntil", System.currentTimeMillis() + DISCOVERY_MS).putString("found", "[]").apply(); }
    static synchronized void stopDiscovery(Context c) { prefs(c).edit().putLong("discoverUntil", 0).putString("found", "[]").apply(); }
    static synchronized JSONArray found(Context c) {
        SharedPreferences p = prefs(c);
        if (System.currentTimeMillis() > p.getLong("discoverUntil", 0)) { p.edit().putString("found", "[]").apply(); return new JSONArray(); }
        try { return new JSONArray(p.getString("found", "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    /** the policy, decided before anything is stored (the body never identifies a group); returns a reason code */
    static synchronized String decide(Context c, String source, String title, String conversation, String subText, String text) {
        SharedPreferences p = prefs(c);
        try {
            JSONArray g = new JSONArray(p.getString("groups", "[]"));
            String[] groups = new String[g.length()];
            for (int i = 0; i < groups.length; i++) groups[i] = g.optString(i, "");
            boolean sourceOn = new JSONObject(p.getString("sources", "{}")).optBoolean(source, false);
            return HaizIntakePolicy.decide(p.getBoolean("enabled", false), accessGranted(c), sourceOn, groups, text, conversation, title, subText);
        } catch (Exception e) { return HaizIntakePolicy.OFF; }
    }

    /**
     * Local diagnostics: counts and times only, per source and per reason. Never a message text,
     * never the title of a chat that is not a chosen group.
     */
    static synchronized void count(Context c, String source, String reason) {
        SharedPreferences p = prefs(c);
        try {
            JSONObject d = new JSONObject(p.getString("diag", "{}"));
            long now = System.currentTimeMillis();
            JSONObject seen = d.optJSONObject("seen"); if (seen == null) seen = new JSONObject();
            seen.put(source, seen.optLong(source) + 1);
            d.put("seen", seen);
            JSONObject last = d.optJSONObject("lastAt"); if (last == null) last = new JSONObject();
            last.put(source, now);
            d.put("lastAt", last);
            JSONObject r = d.optJSONObject("reasons"); if (r == null) r = new JSONObject();
            r.put(reason, r.optLong(reason) + 1);
            d.put("reasons", r);
            d.put("lastReason", reason);
            d.put("lastReasonAt", now);
            if (!d.has("since")) d.put("since", now);
            p.edit().putString("diag", d.toString()).apply();
        } catch (Exception ignored) { }
    }

    static synchronized void connected(Context c, boolean on) {
        SharedPreferences.Editor e = prefs(c).edit().putBoolean("connected", on);
        if (on) e.putLong("connectedAt", System.currentTimeMillis()); else e.putLong("disconnectedAt", System.currentTimeMillis());
        e.apply();
    }

    static synchronized void resetDiag(Context c) { prefs(c).edit().remove("diag").apply(); }

    private static String hash(String v) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(v.getBytes(StandardCharsets.UTF_8));
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < 12; i++) b.append(String.format(Locale.ROOT, "%02x", d[i] & 0xff));
            return b.toString();
        } catch (Exception e) { return Long.toHexString(v.hashCode()); }
    }

    /** queue one entry; returns it, or null when it is a repeat (same source, group and text within 7 days) */
    static synchronized JSONObject append(Context c, String source, String group, String text, long at) {
        String body = text == null ? "" : text.trim();
        if (body.isEmpty()) return null;
        if (body.length() > MAX_TEXT) body = body.substring(0, MAX_TEXT);
        String id = hash(source + "\u0000" + group + "\u0000" + body);
        SharedPreferences p = prefs(c);
        try {
            JSONArray queue = new JSONArray(p.getString("queue", "[]"));
            JSONArray seen = new JSONArray(p.getString("seen", "[]"));
            for (int i = 0; i < seen.length(); i++) if (id.equals(seen.optJSONObject(i).optString("id"))) return null;
            JSONObject e = new JSONObject().put("id", id).put("source", source).put("label", labelOf(source))
                .put("group", group.length() > 120 ? group.substring(0, 120) : group).put("text", body).put("at", at);
            JSONArray next = new JSONArray().put(e);
            for (int i = 0; i < queue.length() && next.length() < MAX_QUEUE; i++) next.put(queue.get(i));
            JSONArray seenNext = new JSONArray().put(new JSONObject().put("id", id).put("at", at));
            long cut = System.currentTimeMillis() - SEEN_MS;
            for (int i = 0; i < seen.length() && seenNext.length() < MAX_SEEN; i++) { JSONObject o = seen.optJSONObject(i); if (o != null && o.optLong("at") > cut) seenNext.put(o); }
            p.edit().putString("queue", next.toString()).putString("seen", seenNext.toString()).apply();
            return e;
        } catch (Exception ex) { return null; }
    }

    static synchronized JSONArray entries(Context c) {
        try { return new JSONArray(prefs(c).getString("queue", "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    /** the page has the entries in its own database: forget them here */
    static synchronized void ack(Context c, List<String> ids) {
        Set<String> drop = new HashSet<>(ids);
        JSONArray q = entries(c), next = new JSONArray();
        for (int i = 0; i < q.length(); i++) { JSONObject o = q.optJSONObject(i); if (o != null && !drop.contains(o.optString("id"))) next.put(o); }
        prefs(c).edit().putString("queue", next.toString()).apply();
    }

    static synchronized void clear(Context c) { prefs(c).edit().remove("queue").remove("seen").remove("found").apply(); }

    static List<String> ids(JSONArray a) { List<String> o = new ArrayList<>(); for (int i = 0; a != null && i < a.length(); i++) o.add(a.optString(i)); return o; }
}
