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
        "交|完成|提交|上交|复习|预习|背诵|默写|练习|整理|准备|带好|带上|作业|实验报告|截止|测验|通知|订正|抄写|签字|收齐|课堂任务"
    )

    fun shouldCollect(
        pkg: String,
        title: String,
        conversationTitle: String,
        subText: String,
        text: String,
        groupKeywords: List<String>,
    ): Boolean {
        if (pkg !in allowedApps || text.length < 5 || !actions.containsMatchIn(text)) return false
        if (groupKeywords.isEmpty()) return false
        // Never match message body. Matching the body could capture private chats
        // that happen to mention a school group.
        return listOf(conversationTitle, title, subText)
            .filter(String::isNotBlank)
            .any { candidate ->
                groupKeywords.any { keyword ->
                    keyword.length >= 2 && candidate.contains(keyword, ignoreCase = true)
                }
            }
    }
}
