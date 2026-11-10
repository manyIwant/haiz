package space.haiz.haiz_pocket_flutter

/**
 * Pure decision logic for the explicitly opted-in Android notification channel.
 * Notification metadata cannot prove that a conversation is a group: users must
 * choose distinctive titles, and every candidate still requires review.
 */
internal object SchoolNoticePolicy {
    val allowedApps = setOf(
        "com.tencent.mobileqq",       // QQ
        "com.tencent.tim",            // TIM
        "com.tencent.mm",             // WeChat
        "com.alibaba.android.rimet",  // DingTalk
        "com.chaoxing.mobile"         // Xuexitong
    )

    private val actions = Regex(
        "交|完成|提交|上交|复习|预习|背诵|默写|练习|整理|准备|带好|带上|作业|实验报告|截止|测验|通知|订正|抄写|签字|收齐|课堂任务|阅读|朗读|熟读|听写|作文|课后习题|练习册"
    )

    /** Return a coarse decision code without logging any private message data. */
    fun decision(
        pkg: String, title: String, conversationTitle: String, subText: String,
        text: String, groupKeywords: List<String>,
    ): String {
        if (pkg !in allowedApps) return "unsupported"
        // A message body mentioning a group is not sufficient evidence of group origin.
        if (groupKeywords.isEmpty() || listOf(conversationTitle, title, subText)
                .filter(String::isNotBlank).none { candidate ->
                    groupKeywords.any { key -> key.length >= 2 && candidate.contains(key, ignoreCase = true) }
                }) return "group_mismatch"
        if (text.length < 5) return "text_unavailable"
        if (!actions.containsMatchIn(text)) return "action_mismatch"
        return "accepted"
    }

    fun shouldCollect(
        pkg: String,
        title: String,
        conversationTitle: String,
        subText: String,
        text: String,
        groupKeywords: List<String>,
    ): Boolean {
        return decision(pkg, title, conversationTitle, subText, text, groupKeywords) == "accepted"
    }
}
