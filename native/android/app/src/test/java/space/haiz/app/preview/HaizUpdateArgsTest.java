package space.haiz.app.preview;

import static org.junit.Assert.*;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.junit.Test;

/** Regression for "更新信息不完整": bridge numbers arrive as Integer and must still be read. */
public class HaizUpdateArgsTest {
    private static JSONObject release() throws Exception {
        try (InputStream in = HaizUpdateArgsTest.class.getClassLoader().getResourceAsStream("haiz-update-2108.json")) {
            return new JSONObject(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    @Test public void readsEveryNumberShape() throws Exception {
        assertEquals(2109L, HaizUpdateArgs.readLong(Integer.valueOf(2109), "versionCode"));
        assertEquals(117443608L, HaizUpdateArgs.readLong(Long.valueOf(117443608L), "sizeBytes"));
        assertEquals(117443608L, HaizUpdateArgs.readLong(Double.valueOf(117443608d), "sizeBytes"));
        assertEquals(2109L, HaizUpdateArgs.readLong("2109", "versionCode"));
        assertEquals(5_000_000_000L, HaizUpdateArgs.readLong(Long.valueOf(5_000_000_000L), "x"));
    }

    @Test public void realManifestPassesThroughTheBridgeShape() throws Exception {
        // Capacitor builds call.getData() with org.json, exactly like this: small numbers become Integer.
        JSONObject m = release();
        JSONObject call = new JSONObject(m.toString());
        assertTrue("bridge delivers Integer, which getLong() rejected", call.opt("sizeBytes") instanceof Integer);
        HaizUpdateArgs.Download d = HaizUpdateArgs.download(call.opt("apkUrl"), call.opt("sha256"), call.opt("sizeBytes"), call.opt("versionCode"));
        assertEquals(m.getLong("sizeBytes"), d.size);
        assertEquals(m.getLong("versionCode"), d.code);
        assertEquals(64, d.sha256.length());
        assertTrue(d.url.startsWith("https://"));
    }

    @Test public void distinguishesMissingTypeAndValue() {
        assertCode(HaizUpdateArgs.MISSING_FIELD, () -> HaizUpdateArgs.versionCode(null));
        assertCode(HaizUpdateArgs.MISSING_FIELD, () -> HaizUpdateArgs.versionCode(JSONObject.NULL));
        assertCode(HaizUpdateArgs.BAD_TYPE, () -> HaizUpdateArgs.versionCode(Boolean.TRUE));
        assertCode(HaizUpdateArgs.BAD_TYPE, () -> HaizUpdateArgs.versionCode(2108.5));
        assertCode(HaizUpdateArgs.BAD_TYPE, () -> HaizUpdateArgs.versionCode("abc"));
        assertCode(HaizUpdateArgs.BAD_VALUE, () -> HaizUpdateArgs.versionCode(0));
        String sha = "6b3fbd3cdc831691788d091c7f695c776ed13f8b264b26e984fd7a02360c07cc";
        assertCode(HaizUpdateArgs.BAD_VALUE, () -> HaizUpdateArgs.download("http://x/a.apk", sha, 117443608, 2109));
        assertCode(HaizUpdateArgs.BAD_VALUE, () -> HaizUpdateArgs.download("https://x/a.apk", "abc", 117443608, 2109));
        assertCode(HaizUpdateArgs.BAD_VALUE, () -> HaizUpdateArgs.download("https://x/a.apk", sha, 1000, 2109));
        assertCode(HaizUpdateArgs.MISSING_FIELD, () -> HaizUpdateArgs.download("https://x/a.apk", sha, null, 2109));
        assertCode(HaizUpdateArgs.BAD_TYPE, () -> HaizUpdateArgs.download("https://x/a.apk", 42, 117443608, 2109));
    }

    interface Body { void run() throws Exception; }
    private static void assertCode(String code, Body b) {
        try { b.run(); fail("expected " + code); }
        catch (HaizUpdateArgs.Fail f) { assertEquals(code, f.code); }
        catch (Exception e) { fail("unexpected " + e); }
    }
}
