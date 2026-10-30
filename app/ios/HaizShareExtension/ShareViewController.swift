import CryptoKit
import Foundation
import Social
import UniformTypeIdentifiers
import UIKit

/// The iOS share sheet must be invoked explicitly by the user.
/// It has no access to WeChat's private conversations or notifications.
final class ShareViewController: SLComposeServiceViewController {
  private let appGroup = "group.space.haiz.pocket"
  private let queueKey = "haiz_share_inbox_v1"
  private let seenKey = "haiz_share_seen_v1"

  override func isContentValid() -> Bool {
    if !(contentText ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      return true
    }
    return (extensionContext?.inputItems as? [NSExtensionItem] ?? [])
      .flatMap { $0.attachments ?? [] }
      .contains { $0.hasItemConformingToTypeIdentifier(UTType.plainText.identifier)
        || $0.hasItemConformingToTypeIdentifier(UTType.url.identifier) }
  }

  override func didSelectPost() {
    var content = (contentText ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? [])
      .flatMap { $0.attachments ?? [] }
      .filter { $0.hasItemConformingToTypeIdentifier(UTType.plainText.identifier)
        || $0.hasItemConformingToTypeIdentifier(UTType.url.identifier) }
      .prefix(6)
    if providers.isEmpty {
      saveOrShowError(content)
      return
    }

    let group = DispatchGroup()
    let lock = NSLock()
    var parts: [String] = []
    for provider in providers {
      let typeID = provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier)
        ? UTType.plainText.identifier : UTType.url.identifier
      group.enter()
      provider.loadItem(forTypeIdentifier: typeID, options: nil) { item, _ in
        let value = (item as? String) ?? (item as? URL)?.absoluteString
          ?? (item as? NSAttributedString)?.string ?? ""
        lock.lock()
        if !value.isEmpty { parts.append(value) }
        lock.unlock()
        group.leave()
      }
    }
    group.notify(queue: .main) { [weak self] in
      guard let self = self else { return }
      if !parts.isEmpty {
        content += (content.isEmpty ? "" : "\n") + parts.joined(separator: "\n")
      }
      self.saveOrShowError(content)
    }
  }

  private func saveOrShowError(_ raw: String) {
    let text = String(raw.trimmingCharacters(in: .whitespacesAndNewlines).prefix(4000))
    guard !text.isEmpty else {
      showError("没有可保存的文字或链接，请先选择消息内容。")
      return
    }
    guard FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: appGroup
    ) != nil, let defaults = UserDefaults(suiteName: appGroup) else {
      showError("尚未配置 HAIZ 的 App Group 签名权限。")
      return
    }
    let now = Int(Date().timeIntervalSince1970 * 1000)
    let digest = SHA256.hash(data: Data(text.utf8))
      .map { String(format: "%02x", $0) }.joined()
    let id = "ios-share:\(digest)"
    var seen = defaults.array(forKey: seenKey) as? [[String: Any]] ?? []
    if seen.contains(where: { ($0["id"] as? String) == id }) {
      extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
      return
    }

    var inbox = defaults.array(forKey: queueKey) as? [[String: Any]] ?? []
    inbox.insert([
      "id": id,
      "source": "iOS 分享 · 用户主动",
      "title": "分享的文字",
      "text": text,
      "receivedAt": now
    ], at: 0)
    if inbox.count > 60 { inbox = Array(inbox.prefix(60)) }
    let weekAgo = now - (7 * 24 * 60 * 60 * 1000)
    seen.insert(["id": id, "at": now], at: 0)
    seen = Array(seen.filter { ($0["at"] as? Int ?? 0) >= weekAgo }.prefix(160))
    defaults.set(inbox, forKey: queueKey)
    defaults.set(seen, forKey: seenKey)
    extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
  }

  private func showError(_ message: String) {
    let alert = UIAlertController(title: "HAIZ 收件失败", message: message, preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "返回", style: .default))
    present(alert, animated: true)
  }
}
