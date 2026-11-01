package space.haiz.haiz_pocket_flutter

import android.content.Context

/** Local, content-free diagnostics. Never stores rejected notification text or titles. */
internal object WechatMonitorDiagnostics {
    private const val PREF = "haiz_wechat_diagnostics_v1"
    private val reasons = setOf("group_mismatch", "text_unavailable", "action_mismatch", "accepted", "duplicate")

    @Synchronized fun record(c: Context, reason: String, saved: Boolean) {
        if (reason !in reasons || !MessageIntakeStore.wechatMonitorActive(c)) return
        val pref = c.getSharedPreferences(PREF, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val edit = pref.edit()
            .putLong("lastObservedAt", now)
            .putString("lastResult", reason)
            .putInt("observedCount", (pref.getInt("observedCount", 0) + 1).coerceAtMost(1000000))
        if (saved) edit.putLong("lastSavedAt", now)
            .putInt("savedCount", (pref.getInt("savedCount", 0) + 1).coerceAtMost(1000000))
        edit.apply()
    }

    @Synchronized fun snapshot(c: Context): Map<String, Any> {
        val pref = c.getSharedPreferences(PREF, Context.MODE_PRIVATE)
        return mapOf(
            "listenerConnected" to HaizMessageListener.connected,
            "observedCount" to pref.getInt("observedCount", 0),
            "savedCount" to pref.getInt("savedCount", 0),
            "lastObservedAt" to pref.getLong("lastObservedAt", 0L),
            "lastSavedAt" to pref.getLong("lastSavedAt", 0L),
            "lastResult" to (pref.getString("lastResult", "") ?: "")
        )
    }

    @Synchronized fun reset(c: Context) {
        c.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
