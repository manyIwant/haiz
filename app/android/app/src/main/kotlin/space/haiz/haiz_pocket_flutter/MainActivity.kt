package space.haiz.haiz_pocket_flutter

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
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
