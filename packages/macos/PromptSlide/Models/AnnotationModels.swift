import Foundation

struct AnnotationTarget: Codable {
    let dataAnnotate: String?
    let contentNearPin: String?
    let position: AnnotationPosition
}

struct AnnotationPosition: Codable {
    let xPercent: Double
    let yPercent: Double
}

struct Annotation: Identifiable, Codable {
    let id: String
    let slideIndex: Int
    let slideTitle: String
    let target: AnnotationTarget
    let body: String
    let createdAt: String
    let status: String // "open" or "resolved"
    let resolution: String?
}

struct AnnotationsFile: Codable {
    let version: Int
    let annotations: [Annotation]
}
