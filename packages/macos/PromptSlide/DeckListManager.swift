import Foundation

@MainActor
class DeckListManager: ObservableObject {
    @Published var decks: [Deck] = []
    @Published var selectedDeck: Deck?

    private var source: DispatchSourceFileSystemObject?
    private var fileDescriptor: Int32 = -1

    private static let deckRoot: URL = {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".promptslide")
            .appendingPathComponent("decks")
    }()

    func startWatching() {
        refresh()

        let path = Self.deckRoot.path
        fileDescriptor = open(path, O_EVTONLY)
        guard fileDescriptor >= 0 else { return }

        let source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: fileDescriptor,
            eventMask: .write,
            queue: .global()
        )
        source.setEventHandler { [weak self] in
            Task { @MainActor [weak self] in
                self?.refresh()
            }
        }
        source.setCancelHandler { [fd = fileDescriptor] in
            close(fd)
        }
        source.resume()
        self.source = source
    }

    func refresh() {
        let fm = FileManager.default
        let root = Self.deckRoot

        guard let contents = try? fm.contentsOfDirectory(
            at: root,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            decks = []
            return
        }

        decks = contents
            .filter { (try? $0.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
            .map { Deck(url: $0) }
    }

    func stopWatching() {
        source?.cancel()
        source = nil
    }

    deinit {
        source?.cancel()
        if fileDescriptor >= 0 { close(fileDescriptor) }
    }
}
