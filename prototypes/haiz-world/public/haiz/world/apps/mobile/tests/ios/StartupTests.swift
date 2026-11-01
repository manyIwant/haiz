import XCTest

final class StartupTests: XCTestCase {
    private let bundle = "space.haiz.study"
    private let note = "HAIZ QA fictional note: compare the second solution."
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication(bundleIdentifier: bundle)
        XCUIDevice.shared.orientation = .portrait
    }
    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
    private func control(_ id: String, label: String) -> XCUIElement {
        // WKWebView exposes DOM id as identifier on supported WebKit releases.
        // A user-visible accessibility label is only a lookup fallback, never the assertion itself.
        let byID = app.webViews.descendants(matching: .any).matching(identifier: id).firstMatch
        if byID.waitForExistence(timeout: 3) { return byID }
        return app.webViews.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    }
    private func waitForShell() {
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 30), "Native WKWebView did not appear")
        let study = control("dock-study", label: "书桌")
        XCTAssertTrue(study.waitForExistence(timeout: 20), "Interactive Dock did not appear")
        XCTAssertTrue(study.isHittable, "Dock is covered by startup overlay")
        capture("interactive-shell")
    }
    private func noteField() -> XCUIElement {
        var field = app.webViews.textViews.matching(identifier: "space-note").firstMatch
        if !field.exists { field = app.webViews.textViews.firstMatch }
        for _ in 0..<8 {
            if field.exists && field.isHittable { return field }
            app.webViews.firstMatch.swipeUp()
        }
        XCTAssertTrue(field.exists && field.isHittable, "Study note must be a real editable field")
        return field
    }
    func testColdNavigationAndRecovery() {
        app.launch()
        waitForShell()
        let today = control("dock-today", label: "今天")
        today.tap()
        XCTAssertFalse(app.webViews.textViews.matching(identifier: "space-note").firstMatch.exists, "Today navigation must leave Study")
        control("dock-study", label: "书桌").tap()
        let field = noteField()
        field.tap()
        field.typeText(note)
        XCTAssertEqual(field.value as? String, note)
        capture("private-note-entered")
        // The production input handler persists the note; no test-only storage write is used.
        sleep(1)
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertEqual(noteField().value as? String, note, "Background resume lost note")
        capture("warm-resume")
        app.terminate()
        app.launch()
        waitForShell()
        XCTAssertEqual(noteField().value as? String, note, "Force reopen lost note")
        capture("force-reopen-retained-note")
    }
    func testReinstallKeepsNote() {
        app.launch()
        waitForShell()
        XCTAssertEqual(noteField().value as? String, note, "Reinstall replaced private note")
        capture("same-candidate-reinstall-retained-note")
    }
}
