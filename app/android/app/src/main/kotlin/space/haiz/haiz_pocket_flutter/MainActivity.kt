package space.haiz.haiz_pocket_flutter

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import java.lang.ref.WeakReference
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    companion object {
        private var foreground: WeakReference<MainActivity>? = null
        fun notifyIncoming() {
            Handler(Looper.getMainLooper()).post {
                foreground?.get()?.intakeChannel?.invokeMethod("nativeNotice", null)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        foreground = WeakReference(this)
        intakeChannel?.invokeMethod("nativeNotice", null)
    }

    override fun onPause() {
        if (foreground?.get() === this) foreground = null
        super.onPause()
    }
    private val channelName = "space.haiz.pocket/message_intake"
    private var intakeChannel: MethodChannel? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        acceptShare(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (acceptShare(intent)) intakeChannel?.invokeMethod("sharedNotice", null)
    }

    private fun acceptShare(intent: Intent?): Boolean {
        if (intent?.action != Intent.ACTION_SEND || intent.type != "text/plain") return false
        val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.trim() ?: return false
        if (text.isEmpty()) return false
        val title = intent.getStringExtra(Intent.EXTRA_SUBJECT) ?: ""
        MessageIntakeStore.append(
            this, "系统分享 · 用户主动", title, text, System.currentTimeMillis()
        )
        // Avoid receiving this same share again on Activity recreation.
        intent.action = Intent.ACTION_MAIN
        intent.removeExtra(Intent.EXTRA_TEXT)
        return true
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "space.haiz.pocket/app_updates"
        ).setMethodCallHandler { call, result ->
            try {
                when (call.method) {
                    "getInstalledVersion" -> result.success(
                        HaizUpdateInstaller.installedVersion(this)
                    )
                    "installApk" -> {
                        val path = call.argument<String>("path") ?: ""
                        val code = (call.argument<Number>("versionCode"))?.toLong() ?: 0L
                        result.success(HaizUpdateInstaller.install(this, path, code))
                    }
                    else -> result.notImplemented()
                }
            } catch (error: Exception) {
                result.error("UPDATE_INSTALL_FAILED", error.message ?: "Install failed", null)
            }
        }
        intakeChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
        intakeChannel?.setMethodCallHandler { call, result ->
                try {
                    when (call.method) {
                        "getEntries" -> result.success(MessageIntakeStore.entries(this))
                        "getConfiguration" -> result.success(MessageIntakeStore.configuration(this))
                        "setConfiguration" -> {
                            val enabled = call.argument<Boolean>("enabled") ?: false
                            val groups = call.argument<String>("groups") ?: ""
                            val wechat = call.argument<Boolean>("wechat") ?: false
                            result.success(MessageIntakeStore.setConfiguration(this, enabled, groups, wechat))
                        }
                        "requestNotificationSettings" -> {
                            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                            result.success(true)
                        }
                        "removeEntry" -> {
                            val id = call.argument<String>("id") ?: ""
                            MessageIntakeStore.remove(this, id)
                            result.success(true)
                        }
                        "clearEntries" -> {
                            MessageIntakeStore.clear(this)
                            result.success(true)
                        }
                        else -> result.notImplemented()
                    }
                } catch (error: Exception) {
                    result.error("MESSAGE_INTAKE_FAILED", "消息接入出错；请重试。", null)
                }
            }
    }
}
