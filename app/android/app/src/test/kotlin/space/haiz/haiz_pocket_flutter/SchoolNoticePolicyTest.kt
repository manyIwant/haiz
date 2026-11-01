package space.haiz.haiz_pocket_flutter

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SchoolNoticePolicyTest {
    private val groups = listOf("高一13班学习群")

    @Test fun classifiedReasonsExplainFilteredNotifications() {
        fun result(title: String, body: String) = SchoolNoticePolicy.decision(
            "com.tencent.mm", title, "", "", body, groups)
        assertTrue(result("高一13班学习群", "数学作业：明天交练习册。") == "accepted")
        assertTrue(result("朋友", "数学作业：明天交练习册。") == "group_mismatch")
        assertTrue(result("高一13班学习群", "Hi") == "text_unavailable")
        assertTrue(result("高一13班学习群", "明天早点出发哦") == "action_mismatch")
    }

    @Test fun wechatGroupTaskIsEligible() {
        assertTrue(SchoolNoticePolicy.shouldCollect(
            "com.tencent.mm", "高一13班学习群", "", "",
            "数学作业：明天提交练习册。", groups
        ))
    }

    @Test fun wechatConversationMetadataIsRecognized() {
        assertTrue(SchoolNoticePolicy.shouldCollect(
            "com.tencent.mm", "微信", "高一13班学习群", "",
            "语文作业：完成读书摘录。", groups
        ))
    }

    @Test fun wechatSubtextGroupIsRecognized() {
        assertTrue(SchoolNoticePolicy.shouldCollect(
            "com.tencent.mm", "微信", "", "高一13班学习群",
            "今晚复习英语单词。", groups
        ))
    }

    @Test fun nonSelectedChatIsNotCaptured() {
        assertFalse(SchoolNoticePolicy.shouldCollect(
            "com.tencent.mm", "朋友", "", "",
            "别忘了提交数学作业，来自高一13班学习群。", groups
        ))
    }

    @Test fun readingAssignmentIsNotSilentlyDiscarded() {
        assertTrue(SchoolNoticePolicy.shouldCollect(
            "com.tencent.mm", "高一13班学习群", "", "",
            "请阅读语文课本第12页。", groups
        ))
    }

    @Test fun irrelevantGroupMessageIsNotCaptured() {
        assertFalse(SchoolNoticePolicy.shouldCollect(
            "com.tencent.mm", "高一13班学习群", "", "",
            "今天的照片挺好看呀。", groups
        ))
    }

    @Test fun unknownAppAndDisabledGroupListFail() {
        assertFalse(SchoolNoticePolicy.shouldCollect(
            "com.other.app", "高一13班学习群", "", "",
            "完成英语作业。", groups
        ))
        assertFalse(SchoolNoticePolicy.shouldCollect(
            "com.tencent.mm", "高一13班学习群", "", "",
            "完成英语作业。", emptyList()
        ))
    }
}
