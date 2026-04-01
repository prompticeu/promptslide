import SwiftUI

struct AnnotationPanelView: View {
    @ObservedObject var annotationState: AnnotationState
    let slideIndex: Int

    private var slideAnnotations: [Annotation] {
        annotationState.annotations.filter { $0.slideIndex == slideIndex }
    }

    private var openItems: [Annotation] {
        slideAnnotations.filter { $0.status == "open" }
    }

    private var resolvedItems: [Annotation] {
        slideAnnotations.filter { $0.status == "resolved" }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "bubble.left.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(.orange)
                    Text("Annotations")
                        .font(.headline)
                    if annotationState.openCount > 0 {
                        Text("\(annotationState.openCount)")
                            .font(.caption2)
                            .fontWeight(.semibold)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.orange.opacity(0.15))
                            .foregroundStyle(.orange)
                            .clipShape(Capsule())
                    }
                }
                Spacer()
                Button {
                    annotationState.showPanel = false
                    annotationState.selectedId = nil
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            // Content
            if slideAnnotations.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "bubble.left.and.text.bubble.right")
                        .font(.system(size: 28))
                        .foregroundStyle(.tertiary)
                    Text("No annotations on this slide")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text("Annotations are placed in the browser view")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding()
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 4) {
                        if !openItems.isEmpty {
                            sectionHeader("Open")
                            ForEach(Array(openItems.enumerated()), id: \.element.id) { index, annotation in
                                AnnotationRow(
                                    annotation: annotation,
                                    number: index + 1,
                                    isSelected: annotation.id == annotationState.selectedId,
                                    onSelect: { annotationState.selectedId = annotation.id },
                                    onDelete: { annotationState.delete(id: annotation.id) }
                                )
                            }
                        }

                        if !resolvedItems.isEmpty {
                            sectionHeader("Resolved")
                            ForEach(Array(resolvedItems.enumerated()), id: \.element.id) { index, annotation in
                                AnnotationRow(
                                    annotation: annotation,
                                    number: openItems.count + index + 1,
                                    isSelected: annotation.id == annotationState.selectedId,
                                    onSelect: { annotationState.selectedId = annotation.id },
                                    onDelete: { annotationState.delete(id: annotation.id) }
                                )
                            }
                        }
                    }
                    .padding(8)
                }
            }

            Divider()

            // Workflow hint
            WorkflowHintView()
                .padding(12)
        }
        .frame(width: 280)
        .background(.background)
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.system(size: 10, weight: .semibold))
            .tracking(1.5)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 8)
            .padding(.top, 8)
            .padding(.bottom, 2)
    }
}

struct AnnotationRow: View {
    let annotation: Annotation
    let number: Int
    let isSelected: Bool
    let onSelect: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Text("\(number)")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(annotation.status == "open" ? .white : .secondary)
                .frame(width: 20, height: 20)
                .background(annotation.status == "open" ? Color.orange : Color.secondary.opacity(0.3))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text(annotation.body)
                    .font(.system(size: 13))
                    .lineLimit(3)

                if let content = annotation.target.contentNearPin, !content.isEmpty {
                    Text(content)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }

                if let resolution = annotation.resolution, !resolution.isEmpty {
                    Text(resolution)
                        .font(.caption2)
                        .foregroundStyle(.green.opacity(0.8))
                        .italic()
                }
            }

            Spacer()

            Button {
                onDelete()
            } label: {
                Image(systemName: "trash")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .opacity(isSelected ? 1 : 0)
        }
        .padding(8)
        .background(isSelected ? Color.orange.opacity(0.08) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .contentShape(Rectangle())
        .onTapGesture { onSelect() }
    }
}

struct WorkflowHintView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("WORKFLOW")
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.5)
                .foregroundStyle(.secondary)

            step(1, "Annotate slides in the browser")
            step(2, "Switch to your coding agent")
            step(3, "\"Fix open annotations\"")
        }
    }

    private func step(_ n: Int, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text("\(n)")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.orange)
                .frame(width: 16, height: 16)
                .background(.orange.opacity(0.1))
                .clipShape(Circle())
            Text(text)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
