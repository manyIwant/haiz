package space.haiz.app.preview;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import org.json.JSONObject;

/**
 * Receives notifications only after the user grants Android's notification access to HAIZ, and
 * keeps one only when HaizIntakeStore's opt-in policy says so (chosen app, chosen group, task-like
 * text). Migrated from HAIZ Pocket's HaizMessageListener (PR #38). No network.
 */
public class HaizIntakeListener extends NotificationListenerService {
    @Override public void onListenerConnected() { HaizIntakeStore.connected(this, true); HaizIntakePlugin.emitStatus(); }
    @Override public void onListenerDisconnected() { HaizIntakeStore.connected(this, false); HaizIntakePlugin.emitStatus(); }

    @Override public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        String source = HaizIntakeStore.sourceOf(sbn.getPackageName());
        if (source == null) return;
        Notification n = sbn.getNotification();
        if (n == null) return;
        if ((n.flags & Notification.FLAG_ONGOING_EVENT) != 0 || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        Bundle x = n.extras;
        if (x == null) return;
        String title = str(x.getCharSequence(Notification.EXTRA_TITLE));
        String conversation = str(x.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE));
        String sub = str(x.getCharSequence(Notification.EXTRA_SUB_TEXT));
        CharSequence big = x.getCharSequence(Notification.EXTRA_BIG_TEXT);
        String text = str(big != null ? big : x.getCharSequence(Notification.EXTRA_TEXT));
        boolean group = x.getBoolean(Notification.EXTRA_IS_GROUP_CONVERSATION, false);
        String shown = !conversation.isEmpty() ? conversation : !sub.isEmpty() ? sub : title;

        // discovery lists group titles only, and only while the user's 10-minute window is open
        if (HaizIntakeStore.looksLikeGroup(group, text)) HaizIntakeStore.discovered(this, source, shown);

        String reason = HaizIntakeStore.decide(this, source, title, conversation, sub, text);
        if (!HaizIntakePolicy.KEPT.equals(reason)) { HaizIntakeStore.count(this, source, reason); return; }
        long at = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();
        JSONObject e = HaizIntakeStore.append(this, source, HaizIntakeStore.bareTitle(shown), text, at);
        HaizIntakeStore.count(this, source, e != null ? HaizIntakePolicy.KEPT : HaizIntakePolicy.DUPLICATE);
        if (e != null) HaizIntakePlugin.emit(e);
    }

    private static String str(CharSequence s) { return s == null ? "" : s.toString().trim(); }
}
