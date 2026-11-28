package space.haiz.app.preview;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 收件 · the decision for one notification, in plain Java (no Android types, so JVM tests cover it).
 *
 * The user's wish (enabled), Android's notification access (granted), the per-app switch and the
 * chosen groups are separate facts; a notification is kept only when all of them allow it. Each
 * outcome has a reason code that the diagnostics count. No text is ever part of a reason.
 */
public final class HaizIntakePolicy {
    private HaizIntakePolicy() {}

    public static final String KEPT = "kept";
    public static final String OFF = "off";                    // the user has not turned intake on
    public static final String NO_ACCESS = "no_access";        // Android notification access not granted
    public static final String SOURCE_OFF = "source_off";      // this app's switch is off
    public static final String NO_GROUPS = "no_groups";        // no group chosen yet
    public static final String OTHER_CHAT = "other_chat";      // not one of the chosen groups (never stored)
    public static final String NOT_TASK = "not_task";          // a chosen group, but not about a task
    public static final String DUPLICATE = "duplicate";        // the same text from the same group within 7 days

    /** a task-shaped message (PR #38's action list, widened with Notice Hub's academic / deadline words) */
    static final Pattern TASK = Pattern.compile(
        "交|完成|提交|上交|复习|预习|背诵|默写|练习|整理|准备|带好|带上|作业|实验|报告|截止|截至|测验|考试|月考|期中|期末|小测|听写|"
        + "通知|订正|抄写|签字|收齐|课堂任务|报名|填写|填报|缴费|签到|集合|开会|班会|家长会|讲座|比赛|活动|接龙|登记|核对|务必|请大家|@所有人");

    /** strip WeChat's unread count 「群名(3)」 so a chosen name keeps matching */
    public static String bareTitle(String t) { return t == null ? "" : t.replaceAll("\\s*[（(]\\d+[)）]\\s*$", "").trim(); }

    public static boolean isTask(String text) { return text != null && text.trim().length() >= 4 && TASK.matcher(text).find(); }

    /** which chosen group this conversation is, or null (decided from titles only, never the body) */
    public static String matchGroup(String[] groups, String... meta) {
        if (groups == null) return null;
        for (String g : groups) {
            if (g == null || g.trim().length() < 2) continue;
            String gl = g.trim().toLowerCase(Locale.ROOT);
            for (String m : meta) {
                String b = bareTitle(m);
                if (!b.isEmpty() && (b.equals(g.trim()) || b.toLowerCase(Locale.ROOT).contains(gl))) return g.trim();
            }
        }
        return null;
    }

    /** the reason for one notification from a known source app (group check comes before the text is read) */
    public static String decide(boolean enabled, boolean granted, boolean sourceOn, String[] groups, String text, String... meta) {
        if (!enabled) return OFF;
        if (!granted) return NO_ACCESS;
        if (!sourceOn) return SOURCE_OFF;
        if (groups == null || groups.length == 0) return NO_GROUPS;
        if (matchGroup(groups, meta) == null) return OTHER_CHAT;
        if (!isTask(text)) return NOT_TASK;
        return KEPT;
    }

    /** the overall state shown in the app, from the separate facts */
    public static String state(boolean enabled, boolean granted, boolean connected, boolean anySource, int groups) {
        if (!enabled) return "off";
        if (!granted) return "needs_access";
        if (!anySource) return "needs_source";
        if (groups == 0) return "needs_groups";
        if (!connected) return "not_connected";
        return "receiving";
    }
}
