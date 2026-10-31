import Foundation
import Flutter
import UIKit

/// Only reads items explicitly sent to the HAIZ Share Extension by the user.
/// This plugin does not and cannot read other apps' messages or notifications.
final class HaizShareIntakePlugin: NSObject, FlutterPlugin {
  private static let appGroup = "group.space.haiz.pocket"
  private static let queueKey = "haiz_share_inbox_v1"

  static func register(with registrar: FlutterPluginRegistrar) {
    let channel = FlutterMethodChannel(
      name: "space.haiz.pocket/message_intake",
      binaryMessenger: registrar.messenger()
    )
    let instance = HaizShareIntakePlugin()
    registrar.addMethodCallDelegate(instance, channel: channel)
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    guard FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: Self.appGroup
    ) != nil, let defaults = UserDefaults(suiteName: Self.appGroup) else {
      result(FlutterError(
        code: "IOS_APP_GROUP_UNAVAILABLE",
        message: "iOS App Group needs provisioning for the app and share extension.",
        details: nil
      ))
      return
    }

    switch call.method {
    case "getEntries":
      let entries = defaults.array(forKey: Self.queueKey) as? [[String: Any]] ?? []
      result(entries)
    case "getConfiguration":
      result([
        "enabled": false,
        "granted": false,
        "wechat": false,
        "groups": ""
      ] as [String: Any])
    case "removeEntry":
      guard let arguments = call.arguments as? [String: Any],
            let id = arguments["id"] as? String, !id.isEmpty else {
        result(FlutterError(code: "INVALID_ID", message: "Missing inbox entry ID.", details: nil))
        return
      }
      let entries = defaults.array(forKey: Self.queueKey) as? [[String: Any]] ?? []
      defaults.set(entries.filter { ($0["id"] as? String) != id }, forKey: Self.queueKey)
      result(true)
    case "clearEntries":
      defaults.removeObject(forKey: Self.queueKey)
      defaults.removeObject(forKey: "haiz_share_seen_v1")
      result(true)
    default:
      result(FlutterMethodNotImplemented)
    }
  }
}
