import SwiftUI

@main
struct PromptSlideApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var serverManager = ServerProcessManager()
    @StateObject private var deckList = DeckListManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(serverManager)
                .environmentObject(deckList)
                .onAppear {
                    appDelegate.serverManager = serverManager
                    appDelegate.deckList = deckList
                }
        }
        .defaultSize(width: 1280, height: 800)
        .windowToolbarStyle(.unified)
        .commands {
            CommandGroup(replacing: .newItem) {}

            CommandMenu("Server") {
                Button("Restart Server") {
                    serverManager.restart()
                }
                .keyboardShortcut("r", modifiers: [.command, .shift])

                if let mcpURL = serverManager.mcpServerURL {
                    Button("Copy MCP URL") {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(mcpURL.absoluteString, forType: .string)
                    }
                }

                Divider()

                switch serverManager.state {
                case .starting:
                    Text("Status: Starting…")
                case .ready:
                    Text("Status: Running")
                case .failed(let msg):
                    Text("Status: Failed – \(msg)")
                }
            }

            CommandMenu("Presentation") {
                Button("Refresh Decks") {
                    deckList.refresh()
                }
                .keyboardShortcut("r", modifiers: [.command, .option])

                Divider()

                Button("Next Slide") {
                    NotificationCenter.default.post(name: .slideAdvance, object: nil)
                }
                .keyboardShortcut(.rightArrow, modifiers: [])

                Button("Previous Slide") {
                    NotificationCenter.default.post(name: .slideGoBack, object: nil)
                }
                .keyboardShortcut(.leftArrow, modifiers: [])

                Divider()

                Button("Toggle Grid View") {
                    NotificationCenter.default.post(name: .toggleGridView, object: nil)
                }
                .keyboardShortcut("g", modifiers: [])
            }
        }
    }
}

// MARK: - App Delegate

class AppDelegate: NSObject, NSApplicationDelegate {
    var serverManager: ServerProcessManager?
    var deckList: DeckListManager?

    func applicationWillTerminate(_ notification: Notification) {
        serverManager?.stop()
        deckList?.stopWatching()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let slideAdvance = Notification.Name("promptslide.advance")
    static let slideGoBack = Notification.Name("promptslide.goBack")
    static let toggleGridView = Notification.Name("promptslide.toggleGrid")
}
