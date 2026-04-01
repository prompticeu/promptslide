import Foundation
import WebKit

/// Generates slide thumbnails by navigating an offscreen WKWebView
/// to each slide and capturing snapshots.
@MainActor
class ThumbnailGenerator {
    private var webView: WKWebView?
    private var isRunning = false
    private var pendingSlides: [Int] = []
    private var deckState: DeckState?
    private var continuation: CheckedContinuation<Void, Never>?

    func generate(url: URL, deckState: DeckState) {
        guard !isRunning else { return }
        self.deckState = deckState
        isRunning = true

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")

        // Listen for deckReady before starting capture
        let controller = config.userContentController
        let handler = ThumbnailMessageHandler { [weak self] in
            Task { @MainActor [weak self] in
                self?.startCapture()
            }
        }
        controller.add(handler, name: "promptslide")

        let wv = WKWebView(frame: NSRect(x: 0, y: 0, width: 1280, height: 720), configuration: config)
        wv.setValue(false, forKey: "drawsBackground")
        self.webView = wv

        wv.load(URLRequest(url: url))
    }

    func cancel() {
        isRunning = false
        pendingSlides = []
        webView = nil
        deckState = nil
    }

    private func startCapture() {
        guard let deckState, isRunning else { return }
        pendingSlides = Array(0..<deckState.totalSlides)
        captureNext()
    }

    private func captureNext() {
        guard isRunning, let webView, let deckState, !pendingSlides.isEmpty else {
            cleanup()
            return
        }

        let slideIndex = pendingSlides.removeFirst()

        // Navigate to slide and show all animations
        webView.evaluateJavaScript("""
            window.__promptslide?.goToSlide(\(slideIndex));
            window.__promptslide?.advance && setTimeout(() => {}, 50);
        """) { [weak self] _, _ in
            // Wait for transition + render, then snapshot
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                Task { @MainActor [weak self] in
                    await self?.takeSnapshot(slideIndex: slideIndex)
                }
            }
        }
    }

    private func takeSnapshot(slideIndex: Int) async {
        guard isRunning, let webView, let deckState else { return }

        let config = WKSnapshotConfiguration()
        config.rect = CGRect(x: 0, y: 0, width: 1280, height: 720)

        do {
            let image = try await webView.takeSnapshot(configuration: config)
            if let tiff = image.tiffRepresentation,
               let bitmap = NSBitmapImageRep(data: tiff),
               let png = bitmap.representation(using: .png, properties: [:]) {
                deckState.thumbnails[slideIndex] = png
            }
        } catch {
            // Skip this slide
        }

        captureNext()
    }

    private func cleanup() {
        isRunning = false
        webView = nil
    }
}

/// Minimal message handler that fires a callback on deckReady
private class ThumbnailMessageHandler: NSObject, WKScriptMessageHandler {
    let onReady: () -> Void

    init(onReady: @escaping () -> Void) {
        self.onReady = onReady
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String,
              type == "deckReady" else { return }
        onReady()
    }
}
