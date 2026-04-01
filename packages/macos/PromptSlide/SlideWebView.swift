import SwiftUI
import WebKit

// MARK: - Coordinator (JS Bridge)

class SlideWebViewCoordinator: NSObject, WKScriptMessageHandler {
    let deckState: DeckState
    /// Tracks the last URL we requested so updateNSView doesn't re-trigger loads
    var lastRequestedURL: URL?

    init(deckState: DeckState) {
        self.deckState = deckState
    }

    nonisolated func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }

        Task { @MainActor in
            switch type {
            case "deckReady":
                handleDeckReady(body)
            case "slideState":
                handleSlideState(body)
            case "transitionComplete":
                deckState.isTransitioning = false
            case "hmrUpdate":
                // HMR happened — deck may have changed, reset ready state
                deckState.isReady = false
            default:
                break
            }
        }
    }

    @MainActor
    private func handleDeckReady(_ body: [String: Any]) {
        guard let slidesData = body["slides"] as? [[String: Any]] else { return }
        deckState.totalSlides = body["totalSlides"] as? Int ?? slidesData.count
        deckState.slides = slidesData.compactMap { dict in
            guard let index = dict["index"] as? Int,
                  let id = dict["id"] as? String else { return nil }
            return SlideInfo(
                index: index,
                id: id,
                title: dict["title"] as? String ?? "",
                steps: dict["steps"] as? Int ?? 0,
                section: dict["section"] as? String ?? "",
                notes: dict["notes"] as? String ?? ""
            )
        }
        deckState.isReady = true
    }

    @MainActor
    private func handleSlideState(_ body: [String: Any]) {
        if let cs = body["currentSlide"] as? Int { deckState.currentSlide = cs }
        if let as_ = body["animationStep"] as? Int { deckState.animationStep = as_ }
        if let ts = body["totalSteps"] as? Int { deckState.totalSteps = ts }
        if let total = body["totalSlides"] as? Int { deckState.totalSlides = total }
    }
}

// MARK: - NSViewRepresentable

struct SlideWebView: NSViewRepresentable {
    let url: URL?
    let deckState: DeckState
    @Binding var webView: WKWebView?

    func makeCoordinator() -> SlideWebViewCoordinator {
        SlideWebViewCoordinator(deckState: deckState)
    }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        config.mediaTypesRequiringUserActionForPlayback = []

        // Register JS bridge message handler
        let controller = config.userContentController
        controller.add(context.coordinator, name: "promptslide")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.allowsBackForwardNavigationGestures = false

        // Make the WebView background transparent so the native bg shows through
        webView.setValue(false, forKey: "drawsBackground")

        DispatchQueue.main.async {
            self.webView = webView
        }

        if let url {
            context.coordinator.lastRequestedURL = url
            webView.load(URLRequest(url: url))
        }
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        guard let url else { return }
        // Only reload if the *requested* URL changed (not the webView's current URL,
        // which may differ due to Vite redirects/rewrites)
        if context.coordinator.lastRequestedURL != url {
            context.coordinator.lastRequestedURL = url
            webView.load(URLRequest(url: url))
        }
    }
}

// MARK: - WebView Commands

extension WKWebView {
    func slideGoTo(_ index: Int) {
        evaluateJavaScript("window.__promptslide?.goToSlide(\(index))") { _, _ in }
    }

    func slideAdvance() {
        evaluateJavaScript("window.__promptslide?.advance()") { _, _ in }
    }

    func slideGoBack() {
        evaluateJavaScript("window.__promptslide?.goBack()") { _, _ in }
    }
}
