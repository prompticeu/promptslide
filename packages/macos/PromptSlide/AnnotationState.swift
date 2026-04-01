import Foundation

@MainActor
class AnnotationState: ObservableObject {
    @Published var annotations: [Annotation] = []
    @Published var showPanel: Bool = false
    @Published var selectedId: String? = nil

    private var baseURL: URL?
    private var deckSlug: String?
    private var pollTimer: Timer?

    var openAnnotations: [Annotation] {
        annotations.filter { $0.status == "open" }
    }

    var resolvedAnnotations: [Annotation] {
        annotations.filter { $0.status == "resolved" }
    }

    var openCount: Int { openAnnotations.count }

    func configure(baseURL: URL?, deckSlug: String?) {
        self.baseURL = baseURL
        self.deckSlug = deckSlug
    }

    func startPolling() {
        stopPolling()
        load()
        pollTimer = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.load()
            }
        }
    }

    func stopPolling() {
        pollTimer?.invalidate()
        pollTimer = nil
    }

    func load() {
        guard let baseURL else { return }
        let url = baseURL.appendingPathComponent("__promptslide_annotations")

        Task {
            do {
                var request = URLRequest(url: url)
                // The server extracts the deck slug from the Referer header
                if let slug = deckSlug {
                    request.setValue(baseURL.appendingPathComponent(slug).absoluteString, forHTTPHeaderField: "Referer")
                }
                let (data, _) = try await URLSession.shared.data(for: request)
                let file = try JSONDecoder().decode(AnnotationsFile.self, from: data)
                self.annotations = file.annotations
            } catch {
                // Silently fail — annotations are optional
            }
        }
    }

    func delete(id: String) {
        annotations.removeAll { $0.id == id }
        save()
        if selectedId == id { selectedId = nil }
    }

    private func save() {
        guard let baseURL else { return }
        let url = baseURL.appendingPathComponent("__promptslide_annotations")
        let file = AnnotationsFile(version: 1, annotations: annotations)

        Task {
            do {
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                // The server extracts the deck slug from the Referer header
                if let slug = deckSlug {
                    request.setValue(baseURL.appendingPathComponent(slug).absoluteString, forHTTPHeaderField: "Referer")
                }
                request.httpBody = try JSONEncoder().encode(file)
                _ = try await URLSession.shared.data(for: request)
            } catch {
                // Silently fail
            }
        }
    }
}
