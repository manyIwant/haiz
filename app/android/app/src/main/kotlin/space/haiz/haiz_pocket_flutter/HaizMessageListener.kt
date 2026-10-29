package space.haiz.haiz_pocket_flutter

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/** Only captures notifications AFTER the user enables monitoring and grants
 * Android's Notification Access permission. No network operations. */
class HaizMessageListener : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null || sbn.packageName !in MessageIntakeStore.allowedApps) return
        val notification = sbn.notification ?: return
        if (notification.flags and Notification.FLAG_ONGOING_EVENT != 0) return
        val extras = notification.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)
            ?.toString()?.trim() ?: return
        val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: extras.getCharSequence(Notification.EXTRA_TEXT))
            ?.toString()?.trim() ?: return
        if (!MessageIntakeStore.monitorAllowed(this, sbn.packageName, title, text)) return
        val label = when (sbn.packageName) {
            "com.tencent.mobileqq" -> "QQ 群通知"
            "com.tencent.tim" -> "TIM 群通知"
            "com.alibaba.android.rimet" -> "钉钉群通知"
            "com.chaoxing.mobile" -> "学习通通知"
            else -> return
        }
        MessageIntakeStore.append(
            this, label, title, text,
            if (sbn.postTime > 0) sbn.postTime else System.currentTimeMillis()
        )
    }
}
