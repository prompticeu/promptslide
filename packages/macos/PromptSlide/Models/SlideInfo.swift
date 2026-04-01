import Foundation

struct SlideInfo: Identifiable, Codable {
    let index: Int
    let id: String
    let title: String
    let steps: Int
    let section: String
    let notes: String
}
