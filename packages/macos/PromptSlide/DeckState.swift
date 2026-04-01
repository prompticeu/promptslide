import Foundation

@MainActor
class DeckState: ObservableObject {
    @Published var currentSlide: Int = 0
    @Published var animationStep: Int = 0
    @Published var totalSteps: Int = 0
    @Published var totalSlides: Int = 0
    @Published var isTransitioning: Bool = false
    @Published var slides: [SlideInfo] = []
    @Published var isReady: Bool = false
    @Published var thumbnails: [Int: Data] = [:]

    var currentTitle: String? {
        guard currentSlide >= 0 && currentSlide < slides.count else { return nil }
        let title = slides[currentSlide].title
        return title.isEmpty ? nil : title
    }

    var currentNotes: String? {
        guard currentSlide >= 0 && currentSlide < slides.count else { return nil }
        let notes = slides[currentSlide].notes
        return notes.isEmpty ? nil : notes
    }

    var sections: [String] {
        var seen = Set<String>()
        return slides.compactMap { s in
            guard !s.section.isEmpty, !seen.contains(s.section) else { return nil }
            seen.insert(s.section)
            return s.section
        }
    }

    func reset() {
        currentSlide = 0
        animationStep = 0
        totalSteps = 0
        totalSlides = 0
        isTransitioning = false
        slides = []
        isReady = false
        thumbnails = [:]
    }
}
