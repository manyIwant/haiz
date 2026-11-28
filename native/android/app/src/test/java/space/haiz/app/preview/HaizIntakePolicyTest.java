package space.haiz.app.preview;

import static org.junit.Assert.*;

import org.junit.Test;

/** Native 003 · every fact is checked separately; no group or no access means nothing is kept. */
public class HaizIntakePolicyTest {
    private static final String[] G = { "高二（3）班家校群" };
    private static final String TASK = "王老师: 请大家周五18:00前提交物理实验报告";

    @Test public void eachFactBlocksOnItsOwn() {
        assertEquals(HaizIntakePolicy.OFF, HaizIntakePolicy.decide(false, true, true, G, TASK, "高二（3）班家校群"));
        assertEquals(HaizIntakePolicy.NO_ACCESS, HaizIntakePolicy.decide(true, false, true, G, TASK, "高二（3）班家校群"));
        assertEquals(HaizIntakePolicy.SOURCE_OFF, HaizIntakePolicy.decide(true, true, false, G, TASK, "高二（3）班家校群"));
        assertEquals(HaizIntakePolicy.NO_GROUPS, HaizIntakePolicy.decide(true, true, true, new String[0], TASK, "高二（3）班家校群"));
        assertEquals(HaizIntakePolicy.OTHER_CHAT, HaizIntakePolicy.decide(true, true, true, G, TASK, "张三"));
        assertEquals(HaizIntakePolicy.NOT_TASK, HaizIntakePolicy.decide(true, true, true, G, "李同学: 哈哈", "高二（3）班家校群"));
        assertEquals(HaizIntakePolicy.KEPT, HaizIntakePolicy.decide(true, true, true, G, TASK, "高二（3）班家校群(12)"));
    }

    @Test public void groupMatchUsesTitlesOnly() {
        // the group's name in the body must not match a private chat
        assertEquals(HaizIntakePolicy.OTHER_CHAT, HaizIntakePolicy.decide(true, true, true, G, "高二（3）班家校群 里说要交作业", "张三", "", ""));
        assertEquals("高二（3）班家校群", HaizIntakePolicy.matchGroup(G, "", "高二（3）班家校群（3）", ""));
        assertNull(HaizIntakePolicy.matchGroup(new String[] { "x" }, "x"));   // 1-char names never match
    }

    @Test public void stateSeparatesWishFromReadiness() {
        assertEquals("off", HaizIntakePolicy.state(false, true, true, true, 1));
        assertEquals("needs_access", HaizIntakePolicy.state(true, false, false, true, 0));
        assertEquals("needs_source", HaizIntakePolicy.state(true, true, true, false, 1));
        assertEquals("needs_groups", HaizIntakePolicy.state(true, true, true, true, 0));
        assertEquals("not_connected", HaizIntakePolicy.state(true, true, false, true, 1));
        assertEquals("receiving", HaizIntakePolicy.state(true, true, true, true, 1));
    }
}
