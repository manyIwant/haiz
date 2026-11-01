package space.haiz.haiz_pocket_flutter

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import java.io.File

/**
 * Only installs the app-owned, SHA256-verified APK saved by Flutter.
 * Android Package Installer performs final signature checks and requires user approval.
 */
object HaizUpdateInstaller {
    fun installedVersion(activity: FlutterActivity): Map<String, Any> {
        val info = activity.packageManager.getPackageInfo(activity.packageName, 0)
        val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else
            @Suppress("DEPRECATION") info.versionCode.toLong()
        return mapOf(
            "packageId" to activity.packageName,
            "versionCode" to code,
            "versionName" to (info.versionName ?: "")
        )
    }

    fun install(activity: FlutterActivity, path: String, expectedCode: Long): String {
        val base = File(activity.cacheDir, "haiz_updates").canonicalFile
        val apk = File(path).canonicalFile
        require(apk.parentFile == base && apk.name == "haiz-update.apk" && apk.isFile) {
            "Invalid update file"
        }
        require(apk.length() > 1024 * 1024) { "Update APK is incomplete" }
        val archive = activity.packageManager.getPackageArchiveInfo(apk.absolutePath, 0)
            ?: throw IllegalArgumentException("Update APK cannot be read")
        require(archive.packageName == activity.packageName) { "Package ID mismatch" }
        val archiveCode = if (Build.VERSION.SDK_INT >= 28) archive.longVersionCode else
            @Suppress("DEPRECATION") archive.versionCode.toLong()
        val currentCode = (installedVersion(activity)["versionCode"] as Long)
        require(archiveCode == expectedCode && archiveCode > currentCode) {
            "Update version is invalid or not newer"
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !activity.packageManager.canRequestPackageInstalls()) {
            activity.startActivity(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${activity.packageName}"))
            )
            return "permission_required"
        }

        val uri = FileProvider.getUriForFile(
            activity, "${activity.packageName}.updates", apk
        )
        activity.startActivity(
            Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        )
        return "installer_opened"
    }
}
