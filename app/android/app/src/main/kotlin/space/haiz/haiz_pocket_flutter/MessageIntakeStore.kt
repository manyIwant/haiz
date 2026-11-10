package space.haiz.haiz_pocket_flutter

import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.util.Locale
import java.text.SimpleDateFormat
import java.util.Date

/**
 * Explicit-opt-in, device-only inbox. Only selected school group notifications
 * become reviewable message entries; NO tasks are created here.
 */
internal object MessageIntakeStore {
    private const val PREF = "haiz_message_intake_v1"
    private const val QUEUE = "pending"
    private const val SEEN = "seen"
    private const val GROUPS = "group_keywords"
    private const val ENABLED = "monitor_enabled"
    private const val WECHAT_ENABLED = "wechat_enabled"
    private const val MAX_QUEUE = 60
    private const val MAX_SEEN = 160
    private const val MAX_TEXT = 4000

    val allowedApps = SchoolNoticePolicy.allowedApps

    private fun prefs(c: Context) = c.getSharedPreferences(PREF, Context.MODE_PRIVATE)

    @Synchronized
    fun configuration(c: Context): Map<String, Any> = mapOf(
        "enabled" to prefs(c).getBoolean(ENABLED, false),
        "groups" to (prefs(c).getString(GROUPS, "") ?: ""),
        "wechat" to prefs(c).getBoolean(WECHAT_ENABLED, false),
        "granted" to notificationAccessGranted(c)
    )

    @Synchronized
    fun setConfiguration(c: Context, enable: Boolean, groups: String, wechat: Boolean = false): Map<String, Any> {
        val normalized = groups.split('\n', ',', '，', ';', '；')
            .map { it.trim().take(48) }.filter { it.length >= 2 }.distinct()
            .take(10).joinToString("\n")
        // No group filter = never monitor any notification.
        val old = prefs(c)
        if (old.getString(GROUPS, "") != normalized ||
            old.getBoolean(ENABLED, false) != (enable && normalized.isNotBlank()) ||
            old.getBoolean(WECHAT_ENABLED, false) != wechat) {
            WechatMonitorDiagnostics.reset(c)
        }
        prefs(c).edit()
            .putString(GROUPS, normalized)
            .putBoolean(WECHAT_ENABLED, wechat)
            .putBoolean(ENABLED, enable && normalized.isNotBlank())
            .apply()
        return configuration(c)
    }

    fun notificationAccessGranted(c: Context): Boolean {
        val raw = Settings.Secure.getString(
            c.contentResolver, "enabled_notification_listeners"
        ) ?: return false
        val target = HaizMessageListener::class.java.name
        return raw.split(':').any { name ->
            val component = ComponentName.unflattenFromString(name)
            component?.packageName == c.packageName && component.className == target
        }
    }

    fun wechatMonitorActive(c: Context): Boolean {
        val pref = prefs(c)
        return pref.getBoolean(ENABLED, false) && pref.getBoolean(WECHAT_ENABLED, false) &&
            notificationAccessGranted(c)
    }

    fun monitoredGroups(c: Context): List<String> =
        (prefs(c).getString(GROUPS, "") ?: "").split('\n').filter { it.length >= 2 }

    fun wechatDecision(c: Context, title: String, text: String,
                       conversationTitle: String, subText: String): String {
        if (!wechatMonitorActive(c)) return "disabled"
        return SchoolNoticePolicy.decision(
            "com.tencent.mm", title, conversationTitle, subText, text, monitoredGroups(c))
    }

    fun monitorAllowed(
        c: Context,
        pkg: String,
        title: String,
        text: String,
        conversationTitle: String = "",
        subText: String = "",
    ): Boolean {
        if (pkg !in allowedApps) return false
        val pref = prefs(c)
        if (!pref.getBoolean(ENABLED, false) || !notificationAccessGranted(c)) return false
        // WeChat is a new source: never silently enable it for existing installs.
        if (pkg == "com.tencent.mm" && !pref.getBoolean(WECHAT_ENABLED, false)) return false
        val groups = (pref.getString(GROUPS, "") ?: "")
            .split('\n').filter { it.length >= 2 }
        // Only selected conversation metadata can match the group allowlist.
        // A chat body mentioning the group name must NEVER be sufficient.
        return SchoolNoticePolicy.shouldCollect(
            pkg, title, conversationTitle, subText, text, groups
        )
    }

    private fun hash(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(Locale.ROOT, it.toInt() and 0xff) }
    }

    @Synchronized
    fun append(c: Context, source: String, title: String, text: String, at: Long): Boolean {
        val cleaned = text.trim().take(MAX_TEXT)
        if (cleaned.isEmpty()) return false
        // A repeated assignment on another day is a new candidate, not a duplicate.
        val localDay = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(Date(at))
        val id = hash("$source\u0000$title\u0000$cleaned\u0000$localDay")
        val pref = prefs(c)
        val queue = JSONArray(pref.getString(QUEUE, "[]") ?: "[]")
        val seen = JSONArray(pref.getString(SEEN, "[]") ?: "[]")
        val weekAgo = System.currentTimeMillis() - 7L * 24 * 60 * 60 * 1000
        val recent = (0 until seen.length()).mapNotNull { seen.optJSONObject(it) }
            .filter { it.optLong("at", 0L) >= weekAgo }
        if (recent.any { it.optString("id") == id }) return false
        val entry = JSONObject()
            .put("id", id)
            .put("source", source.take(120))
            .put("title", title.take(200))
            .put("text", cleaned)
            .put("receivedAt", at)
        val next = JSONArray().put(entry)
        for (i in 0 until minOf(queue.length(), MAX_QUEUE - 1)) next.put(queue.get(i))
        val seenNext = JSONArray().put(
            JSONObject().put("id", id).put("at", at)
        )
        for (old in recent) {
            if (seenNext.length() >= MAX_SEEN) break
            seenNext.put(old)
        }
        pref.edit().putString(QUEUE, next.toString())
            .putString(SEEN, seenNext.toString()).apply()
        return true
    }

    @Synchronized
    fun entries(c: Context): List<Map<String, Any>> {
        val array = JSONArray(prefs(c).getString(QUEUE, "[]") ?: "[]")
        return (0 until array.length()).mapNotNull { i ->
            val item = array.optJSONObject(i) ?: return@mapNotNull null
            mapOf(
                "id" to item.optString("id"),
                "source" to item.optString("source"),
                "title" to item.optString("title"),
                "text" to item.optString("text"),
                "receivedAt" to item.optLong("receivedAt", 0L)
            )
        }
    }

    @Synchronized
    fun remove(c: Context, id: String) {
        val old = JSONArray(prefs(c).getString(QUEUE, "[]") ?: "[]")
        val next = JSONArray()
        for (i in 0 until old.length()) {
            val item = old.optJSONObject(i) ?: continue
            if (item.optString("id") != id) next.put(item)
        }
        prefs(c).edit().putString(QUEUE, next.toString()).apply()
    }

    @Synchronized
    fun clear(c: Context) {
        prefs(c).edit().remove(QUEUE).remove(SEEN).apply()
    }
}
