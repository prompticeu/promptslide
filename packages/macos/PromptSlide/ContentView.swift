import SwiftUI
import WebKit

enum ViewMode: String, CaseIterable {
    case slide = "Slide"
    case grid = "Grid"
}

struct ContentView: View {
    @EnvironmentObject var serverManager: ServerProcessManager
    @EnvironmentObject var deckList: DeckListManager
    @StateObject private var deckState = DeckState()
    @StateObject private var annotationState = AnnotationState()
    @State private var webView: WKWebView?
    @State private var viewMode: ViewMode = .slide
    @State private var showNotes: Bool = false
    @State private var thumbnailGenerator = ThumbnailGenerator()
    @State private var isPresentationMode: Bool = false

    var body: some View {
        Group {
            if isPresentationMode {
                presentationView
            } else {
                NavigationSplitView {
                    SidebarView()
                } detail: {
                    detailView
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .navigationTitle(deckList.selectedDeck?.name ?? "PromptSlide")
                        .navigationSubtitle(toolbarSubtitle)
                }
                .toolbar {
                    ToolbarItemGroup(placement: .primaryAction) {
                        primaryToolbarItems
                    }
                    ToolbarItemGroup(placement: .secondaryAction) {
                        secondaryToolbarItems
                    }
                }
            }
        }
        .task {
            serverManager.start()
            deckList.startWatching()
        }
        .onChange(of: deckList.selectedDeck) { _, deck in
            navigateToDeck(deck)
        }
        .onChange(of: deckState.isReady) { _, ready in
            if ready, let deck = deckList.selectedDeck {
                annotationState.configure(baseURL: serverManager.devServerURL, deckSlug: deck.id)
                annotationState.startPolling()

                if let embedURL = embedURL(for: deck) {
                    thumbnailGenerator.generate(url: embedURL, deckState: deckState)
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .slideAdvance)) { _ in
            webView?.slideAdvance()
        }
        .onReceive(NotificationCenter.default.publisher(for: .slideGoBack)) { _ in
            webView?.slideGoBack()
        }
        .onReceive(NotificationCenter.default.publisher(for: .toggleGridView)) { _ in
            viewMode = viewMode == .grid ? .slide : .grid
        }
    }

    // MARK: - Presentation Mode

    private var presentationView: some View {
        ZStack(alignment: .bottom) {
            Color.black.ignoresSafeArea()

            if let deck = deckList.selectedDeck {
                SlideWebView(url: embedURL(for: deck), deckState: deckState, webView: $webView)
                    .ignoresSafeArea()
            }

            // Slide counter overlay (fades on mouse idle, always visible on hover)
            HStack(spacing: 16) {
                Button { webView?.slideGoBack() } label: {
                    Image(systemName: "chevron.left")
                        .foregroundStyle(.white.opacity(0.7))
                }
                .buttonStyle(.plain)

                Text("\(deckState.currentSlide + 1) / \(deckState.totalSlides)")
                    .font(.system(size: 14, weight: .medium, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.7))

                Button { webView?.slideAdvance() } label: {
                    Image(systemName: "chevron.right")
                        .foregroundStyle(.white.opacity(0.7))
                }
                .buttonStyle(.plain)

                Spacer()

                Button {
                    isPresentationMode = false
                    if let window = NSApp.mainWindow, (window.styleMask.contains(.fullScreen)) {
                        window.toggleFullScreen(nil)
                    }
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(.white.opacity(0.5))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(.black.opacity(0.5))
        }
        .onExitCommand {
            isPresentationMode = false
            if let window = NSApp.mainWindow, (window.styleMask.contains(.fullScreen)) {
                window.toggleFullScreen(nil)
            }
        }
    }

    // MARK: - Toolbar

    private var toolbarSubtitle: String {
        guard deckList.selectedDeck != nil, deckState.isReady else { return "" }
        var parts: [String] = []
        if let title = deckState.currentTitle {
            parts.append(title)
        }
        parts.append("Slide \(deckState.currentSlide + 1) of \(deckState.totalSlides)")
        return parts.joined(separator: " — ")
    }

    @ViewBuilder
    private var primaryToolbarItems: some View {
        if serverManager.state == .ready && deckList.selectedDeck != nil {
            Picker("View", selection: $viewMode) {
                Image(systemName: "rectangle.fill")
                    .help("Slide View")
                    .tag(ViewMode.slide)
                Image(systemName: "square.grid.3x3.fill")
                    .help("Grid View")
                    .tag(ViewMode.grid)
            }
            .pickerStyle(.segmented)
            .frame(width: 80)

            Button {
                annotationState.showPanel.toggle()
                if !annotationState.showPanel {
                    annotationState.selectedId = nil
                }
            } label: {
                ZStack(alignment: .topTrailing) {
                    Label("Annotations", systemImage: "bubble.left")
                    if annotationState.openCount > 0 {
                        Text("\(annotationState.openCount)")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(.orange)
                            .clipShape(Capsule())
                            .offset(x: 6, y: -6)
                    }
                }
            }
            .help("Toggle annotations panel")

            Button {
                showNotes.toggle()
            } label: {
                Label("Notes", systemImage: showNotes ? "text.bubble.fill" : "text.bubble")
            }
            .help("Toggle speaker notes")
        }
    }

    @ViewBuilder
    private var secondaryToolbarItems: some View {
        if serverManager.state == .ready && deckList.selectedDeck != nil {
            Button {
                exportPDF()
            } label: {
                Label("Export PDF", systemImage: "arrow.down.doc")
            }
            .help("Export as PDF")

            Button {
                isPresentationMode = true
                if let window = NSApp.mainWindow, !window.styleMask.contains(.fullScreen) {
                    window.toggleFullScreen(nil)
                }
            } label: {
                Label("Present", systemImage: "play.fill")
            }
            .help("Enter presentation mode (fullscreen)")

            Button {
                webView?.reload()
            } label: {
                Label("Reload", systemImage: "arrow.clockwise")
            }
            .keyboardShortcut("r", modifiers: .command)
            .help("Reload slide preview")

            if let mcpURL = serverManager.mcpServerURL {
                Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(mcpURL.absoluteString, forType: .string)
                } label: {
                    Label("Copy MCP URL", systemImage: "link")
                }
                .help("Copy MCP server URL")
            }
        }
    }

    // MARK: - Detail View

    @ViewBuilder
    private var detailView: some View {
        switch serverManager.state {
        case .starting:
            startingView
        case .ready:
            if deckList.selectedDeck != nil {
                deckDetailView
            } else {
                welcomeView
            }
        case .failed(let message):
            failedView(message: message)
        }
    }

    @ViewBuilder
    private var deckDetailView: some View {
        HSplitView {
            // Main content area
            VStack(spacing: 0) {
                switch viewMode {
                case .slide:
                    // Slide WebView with 16:9 aspect ratio
                    GeometryReader { geo in
                        let slideWidth = min(geo.size.width - 48, (geo.size.height - 48) * (16.0 / 9.0))
                        let slideHeight = slideWidth * (9.0 / 16.0)

                        ZStack(alignment: .bottom) {
                            SlideWebView(url: embedURL(for: deckList.selectedDeck!), deckState: deckState, webView: $webView)
                                .frame(width: slideWidth, height: slideHeight)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .shadow(color: .black.opacity(0.2), radius: 16, y: 6)

                            if deckState.isReady {
                                SlideNavigationBar(deckState: deckState, webView: webView)
                            }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }

                case .grid:
                    if deckState.isReady {
                        GridView(deckState: deckState) { slideIndex in
                            webView?.slideGoTo(slideIndex)
                            viewMode = .slide
                        }
                    }
                }

                // Speaker notes
                if showNotes, let notes = deckState.currentNotes {
                    Divider()
                    ScrollView {
                        Text(notes)
                            .font(.system(.body, design: .serif))
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(height: 120)
                    .background(.background)
                }
            }

            // Annotation panel
            if annotationState.showPanel {
                AnnotationPanelView(
                    annotationState: annotationState,
                    slideIndex: deckState.currentSlide
                )
            }
        }
    }

    // MARK: - State Views

    private var startingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .controlSize(.large)
            Text("Starting Server")
                .font(.title3)
                .fontWeight(.medium)
            Text("Setting up the development environment…")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var welcomeView: some View {
        VStack(spacing: 12) {
            Image(systemName: "rectangle.on.rectangle.angled")
                .font(.system(size: 56))
                .foregroundStyle(.tertiary)
            Text("Select a Deck")
                .font(.title2)
                .fontWeight(.medium)
            Text("Choose a presentation from the sidebar to get started.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private func failedView(message: String) -> some View {
        VStack(spacing: 20) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
                .foregroundStyle(.red)
            VStack(spacing: 6) {
                Text("Unable to Start Server")
                    .font(.title2)
                    .fontWeight(.medium)
                Text(message)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 400)
            }
            Button {
                serverManager.restart()
            } label: {
                Label("Try Again", systemImage: "arrow.counterclockwise")
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
    }

    // MARK: - Helpers

    private func embedURL(for deck: Deck?) -> URL? {
        guard let base = serverManager.devServerURL, let deck else { return nil }
        return base.appendingPathComponent(deck.id).appendingPathComponent("embed")
    }

    private func navigateToDeck(_ deck: Deck?) {
        // Reset state for new deck
        deckState.reset()
        annotationState.stopPolling()
        annotationState.annotations = []
        thumbnailGenerator.cancel()
        viewMode = .slide

        guard serverManager.state == .ready, let deck else { return }

        // If webView exists, navigate it; otherwise it'll load via the binding
        if let webView, let url = embedURL(for: deck) {
            webView.load(URLRequest(url: url))
        }
    }

    private func exportPDF() {
        guard let webView else {
            NSSound.beep()
            return
        }

        // Use the WebView's native PDF export — renders the current slide content
        let printInfo = NSPrintInfo.shared.copy() as! NSPrintInfo
        printInfo.paperSize = NSSize(width: 1280 * 72.0 / 96.0, height: 720 * 72.0 / 96.0)
        printInfo.topMargin = 0
        printInfo.bottomMargin = 0
        printInfo.leftMargin = 0
        printInfo.rightMargin = 0
        printInfo.isHorizontallyCentered = true
        printInfo.isVerticallyCentered = true

        let printOp = webView.printOperation(with: printInfo)
        printOp.showsPrintPanel = true
        printOp.showsProgressPanel = true
        printOp.run()
    }
}
