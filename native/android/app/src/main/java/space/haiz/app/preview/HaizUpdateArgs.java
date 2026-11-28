package space.haiz.app.preview;

import java.util.Locale;

/**
 * Plain-Java checks for the updater bridge (no Android types, so JVM unit tests cover them).
 *
 * Numbers from JavaScript cross the Capacitor bridge as Integer, Long or Double depending on size;
 * PluginCall.getLong() only accepts Long and silently returns its default for an Integer, which made
 * every valid update look "incomplete" in 1.6.0 – 1.7.0. Everything numeric is read through
 * {@link #readLong} instead.
 */
public final class HaizUpdateArgs {
    private HaizUpdateArgs() {}

    public static final long MIN_APK = 1024L * 1024L;
    public static final long MAX_APK = 400L * 1024L * 1024L;

    /** null, or JSONObject.NULL (checked by name so JVM tests need no android.jar org.json) */
    static boolean isNull(Object v) { return v == null || v.getClass().getName().startsWith("org.json.JSONObject"); }

    /** Error codes passed to call.reject(message, code); the web layer maps them to user text. */
    public static final String NETWORK = "NETWORK";
    public static final String MISSING_FIELD = "MANIFEST_MISSING_FIELD";
    public static final String BAD_TYPE = "MANIFEST_TYPE";
    public static final String BAD_VALUE = "MANIFEST_VALUE";
    public static final String SIZE_MISMATCH = "SIZE_MISMATCH";
    public static final String SHA_MISMATCH = "SHA_MISMATCH";
    public static final String PACKAGE_MISMATCH = "PACKAGE_MISMATCH";
    public static final String VERSION_NOT_NEWER = "VERSION_NOT_NEWER";
    public static final String SIGNATURE_MISMATCH = "SIGNATURE_MISMATCH";
    public static final String NO_VERIFIED_APK = "NO_VERIFIED_APK";
    public static final String BUSY = "BUSY";
    public static final String IO = "IO";

    /** An error that carries one of the codes above. */
    public static final class Fail extends Exception {
        public final String code;
        public Fail(String code, String message) { super(message); this.code = code; }
    }

    /**
     * Any JSON number (Integer, Long, Double without a fraction) or a decimal string becomes a long.
     * Missing values and wrong types throw with a code that names the field.
     */
    public static long readLong(Object v, String field) throws Fail {
        if (isNull(v)) throw new Fail(MISSING_FIELD, "更新信息缺少字段 " + field);
        if (v instanceof Integer || v instanceof Long || v instanceof Short || v instanceof Byte) return ((Number) v).longValue();
        if (v instanceof Number) {
            double d = ((Number) v).doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d) || d != Math.rint(d) || Math.abs(d) > 9.007199254740991E15)
                throw new Fail(BAD_TYPE, "更新信息字段 " + field + " 不是整数");
            return (long) d;
        }
        if (v instanceof String) {
            String s = ((String) v).trim();
            if (s.isEmpty()) throw new Fail(MISSING_FIELD, "更新信息缺少字段 " + field);
            try { return Long.parseLong(s); }
            catch (NumberFormatException e) { throw new Fail(BAD_TYPE, "更新信息字段 " + field + " 不是整数"); }
        }
        throw new Fail(BAD_TYPE, "更新信息字段 " + field + " 类型错误（" + v.getClass().getSimpleName() + "）");
    }

    public static String readString(Object v, String field) throws Fail {
        if (isNull(v)) throw new Fail(MISSING_FIELD, "更新信息缺少字段 " + field);
        if (!(v instanceof String)) throw new Fail(BAD_TYPE, "更新信息字段 " + field + " 应为文本");
        String s = ((String) v).trim();
        if (s.isEmpty()) throw new Fail(MISSING_FIELD, "更新信息缺少字段 " + field);
        return s;
    }

    public static long versionCode(Object v) throws Fail {
        long c = readLong(v, "versionCode");
        if (c <= 0) throw new Fail(BAD_VALUE, "更新信息 versionCode 无效：" + c);
        return c;
    }

    /** The download request after validation. */
    public static final class Download {
        public final String url, sha256; public final long size, code;
        Download(String url, String sha256, long size, long code) { this.url = url; this.sha256 = sha256; this.size = size; this.code = code; }
    }

    public static Download download(Object url, Object sha, Object size, Object code) throws Fail {
        String u = readString(url, "url");
        if (!u.startsWith("https://")) throw new Fail(BAD_VALUE, "安装包地址必须使用 HTTPS");
        String h = readString(sha, "sha256").toLowerCase(Locale.ROOT);
        if (!h.matches("[0-9a-f]{64}")) throw new Fail(BAD_VALUE, "更新信息 sha256 不是 64 位十六进制");
        long s = readLong(size, "sizeBytes");
        if (s <= MIN_APK || s > MAX_APK) throw new Fail(BAD_VALUE, "更新信息 sizeBytes 超出范围：" + s);
        return new Download(u, h, s, versionCode(code));
    }
}
