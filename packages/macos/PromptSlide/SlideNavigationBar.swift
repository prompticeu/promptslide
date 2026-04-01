import SwiftUI
import WebKit

struct SlideNavigationBar: View {
    @ObservedObject var deckState: DeckState
    let webView: WKWebView?

    var body: some View {
        HStack(spacing: 4) {
            Button {
                webView?.slideGoBack()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 11, weight: .medium))
                    .frame(width: 24, height: 24)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.borderless)
            .disabled(deckState.currentSlide <= 0)
            .keyboardShortcut(.leftArrow, modifiers: [])

            Text("\(deckState.currentSlide + 1) / \(deckState.totalSlides)")
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(.secondary)
                .frame(minWidth: 48)

            Button {
                webView?.slideAdvance()
            } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .medium))
                    .frame(width: 24, height: 24)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.borderless)
            .disabled(deckState.currentSlide >= deckState.totalSlides - 1)
            .keyboardShortcut(.rightArrow, modifiers: [])
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.regularMaterial, in: Capsule())
        .padding(.bottom, 12)
    }
}
