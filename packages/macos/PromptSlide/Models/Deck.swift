import Foundation

struct Deck: Identifiable, Hashable {
    let id: String
    let name: String
    let url: URL

    init(url: URL) {
        self.url = url
        self.id = url.lastPathComponent
        self.name = url.lastPathComponent
            .replacingOccurrences(of: "-", with: " ")
            .replacingOccurrences(of: "_", with: " ")
            .localizedCapitalized
    }
}
