import SwiftUI
import WebKit

struct GridView: View {
    @ObservedObject var deckState: DeckState
    let onSelectSlide: (Int) -> Void

    private let columns = [
        GridItem(.adaptive(minimum: 220, maximum: 320), spacing: 12)
    ]

    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(deckState.slides) { slide in
                    let prevSection = slide.index > 0 ? deckState.slides[slide.index - 1].section : ""
                    let showHeader = !slide.section.isEmpty && slide.section != prevSection

                    if showHeader {
                        Section {
                            gridThumbnail(slide: slide)
                        } header: {
                            Text(slide.section.uppercased())
                                .font(.system(size: 11, weight: .bold))
                                .tracking(2)
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.top, slide.index == 0 ? 0 : 16)
                        }
                    } else {
                        gridThumbnail(slide: slide)
                    }
                }
            }
            .padding(20)
        }
        .background(Color(nsColor: .controlBackgroundColor))
    }

    private func gridThumbnail(slide: SlideInfo) -> some View {
        Button {
            onSelectSlide(slide.index)
        } label: {
            VStack(spacing: 0) {
                ZStack {
                    Color.black
                    if let imageData = deckState.thumbnails[slide.index],
                       let nsImage = NSImage(data: imageData) {
                        Image(nsImage: nsImage)
                            .resizable()
                            .aspectRatio(16/9, contentMode: .fit)
                    } else {
                        VStack(spacing: 8) {
                            Image(systemName: "rectangle.on.rectangle.angled")
                                .font(.title2)
                                .foregroundStyle(.tertiary)
                            Text("Slide \(slide.index + 1)")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                    }
                }
                .aspectRatio(16/9, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 6))

                HStack {
                    Text(slide.title.isEmpty ? "Slide \(slide.index + 1)" : "\(slide.index + 1). \(slide.title)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Spacer()
                }
                .padding(.top, 6)
                .padding(.horizontal, 2)
            }
        }
        .buttonStyle(.plain)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(deckState.currentSlide == slide.index ? Color.accentColor : Color.clear, lineWidth: 2)
        )
    }
}
