import SwiftUI

struct SidebarView: View {
    @EnvironmentObject var deckList: DeckListManager
    @EnvironmentObject var serverManager: ServerProcessManager

    var body: some View {
        List(deckList.decks, selection: $deckList.selectedDeck) { deck in
            DeckRow(deck: deck)
                .tag(deck)
        }
        .listStyle(.sidebar)
        .frame(minWidth: 220)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            serverStatusBar
        }
        .toolbar {
            ToolbarItem {
                Button {
                    deckList.refresh()
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .help("Refresh deck list")
            }
        }
        .navigationTitle("Decks")
        .overlay {
            if deckList.decks.isEmpty {
                ContentUnavailableView {
                    Label("No Decks", systemImage: "rectangle.on.rectangle.slash")
                } description: {
                    Text("Create a deck using the CLI")
                } actions: {
                    Button {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString("promptslide create my-deck", forType: .string)
                    } label: {
                        Label("Copy Command", systemImage: "doc.on.clipboard")
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
    }

    private var serverStatusBar: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            Text(statusText)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            if serverManager.state == .starting {
                ProgressView()
                    .controlSize(.small)
                    .scaleEffect(0.6)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.bar)
    }

    private var statusColor: Color {
        switch serverManager.state {
        case .starting: return .orange
        case .ready: return .green
        case .failed: return .red
        }
    }

    private var statusText: String {
        switch serverManager.state {
        case .starting: return "Starting…"
        case .ready: return "Server Running"
        case .failed: return "Server Offline"
        }
    }
}

struct DeckRow: View {
    let deck: Deck

    var body: some View {
        Label {
            Text(deck.name)
                .lineLimit(1)
        } icon: {
            Image(systemName: "rectangle.on.rectangle.angled")
                .foregroundStyle(.tint)
        }
    }
}
