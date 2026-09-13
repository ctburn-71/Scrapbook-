import ImageIO
import PhotosUI
import SwiftUI
import UIKit

struct MemoryEditor: View {
    let pageNumber: Int
    @ObservedObject var store: MemoryStore

    @Environment(\.dismiss) private var dismiss
    @AppStorage("scrapbookContributorName") private var rememberedName = ""
    @AppStorage("scrapbookContributorRelationship") private var rememberedRelationship = ""
    @State private var draft = MemoryEntry()
    @State private var selection: [PhotosPickerItem] = []
    @State private var importingPhotos = false
    @State private var importError: String?
    @State private var initialized = false

    private let milestoneIdeas = [
        "We got engaged",
        "We chose our venue",
        "We set the date",
        "We found the dress",
        "Our wedding day",
        "The honeymoon"
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("This page") {
                    Toggle("Mark as a milestone", isOn: $draft.isMilestone)

                    if draft.isMilestone {
                        Menu("Choose a milestone idea") {
                            ForEach(milestoneIdeas, id: \.self) { idea in
                                Button(idea) { draft.title = idea }
                            }
                        }
                    }

                    TextField(
                        draft.isMilestone ? "Milestone title" : "Memory title",
                        text: $draft.title
                    )
                    DatePicker("Date", selection: $draft.date, displayedComponents: .date)
                }

                Section("Photos · \(draft.photos.count) of 4") {
                    if draft.photos.count < 4 {
                        PhotosPicker(
                            selection: $selection,
                            maxSelectionCount: 4 - draft.photos.count,
                            selectionBehavior: .ordered,
                            matching: .images
                        ) {
                            Label(
                                draft.photos.isEmpty ? "Choose photos" : "Add more photos",
                                systemImage: "photo.on.rectangle.angled"
                            )
                        }
                        .disabled(importingPhotos)
                    }

                    if importingPhotos {
                        ProgressView("Preparing photos…")
                    }

                    Text("You can save a milestone without photos and return to add them later.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                ForEach(Array(draft.photos.enumerated()), id: \.element.id) { index, photo in
                    PhotoEditor(
                        photo: binding(for: photo.id),
                        number: index + 1,
                        remove: { draft.photos.removeAll { $0.id == photo.id } }
                    )
                }

                Section("The story") {
                    TextField("What happened?", text: $draft.story, axis: .vertical)
                        .lineLimit(3...8)
                    TextField("Added by", text: $draft.author)
                        .textContentType(.name)
                    TextField(
                        "Family, friend, wedding party…",
                        text: $draft.relationship
                    )
                }

                if store.entry(for: pageNumber) != nil {
                    Section {
                        Button("Clear this page", role: .destructive) {
                            store.removeEntry(on: pageNumber)
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle("Page \(pageNumber)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!canSave || importingPhotos)
                }
            }
            .onAppear {
                guard !initialized else { return }
                initialized = true
                draft = store.entry(for: pageNumber) ?? MemoryEntry()
                if draft.author.isEmpty { draft.author = rememberedName }
                if draft.relationship.isEmpty { draft.relationship = rememberedRelationship }
            }
            .onChange(of: selection) {
                guard !selection.isEmpty else { return }
                Task { await importSelectedPhotos() }
            }
            .alert(
                "Photos could not be added",
                isPresented: Binding(
                    get: { importError != nil },
                    set: { if !$0 { importError = nil } }
                )
            ) {
                Button("OK") { importError = nil }
            } message: {
                Text(importError ?? "")
            }
        }
    }

    private var canSave: Bool {
        let hasAuthor = !draft.author.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasContent = draft.isMilestone
            ? !draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            : !draft.photos.isEmpty || !draft.story.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return hasAuthor && hasContent
    }

    private func binding(for id: UUID) -> Binding<ScrapbookPhoto> {
        Binding(
            get: { draft.photos.first(where: { $0.id == id }) ?? ScrapbookPhoto(data: Data()) },
            set: { updated in
                guard let index = draft.photos.firstIndex(where: { $0.id == id }) else { return }
                draft.photos[index] = updated
            }
        )
    }

    @MainActor
    private func importSelectedPhotos() async {
        let selectedItems = selection
        importingPhotos = true
        defer {
            selection = []
            importingPhotos = false
        }

        var imported: [ScrapbookPhoto] = []
        var failures = 0

        for item in selectedItems.prefix(4 - draft.photos.count) {
            do {
                guard let original = try await item.loadTransferable(type: Data.self),
                      let source = CGImageSourceCreateWithData(original as CFData, nil),
                      let cgImage = CGImageSourceCreateThumbnailAtIndex(
                        source,
                        0,
                        [
                            kCGImageSourceCreateThumbnailFromImageAlways: true,
                            kCGImageSourceCreateThumbnailWithTransform: true,
                            kCGImageSourceThumbnailMaxPixelSize: 1800
                        ] as CFDictionary
                      ),
                      let jpeg = UIImage(cgImage: cgImage).jpegData(compressionQuality: 0.86)
                else {
                    failures += 1
                    continue
                }
                imported.append(ScrapbookPhoto(data: jpeg, date: draft.date))
            } catch {
                failures += 1
            }
        }

        draft.photos.append(contentsOf: imported.prefix(4 - draft.photos.count))
        if failures > 0 {
            importError = "\(failures) selected photo\(failures == 1 ? "" : "s") could not be prepared. Try choosing again."
        }
    }

    private func save() {
        draft.title = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
        draft.author = draft.author.trimmingCharacters(in: .whitespacesAndNewlines)
        draft.relationship = draft.relationship.trimmingCharacters(in: .whitespacesAndNewlines)
        rememberedName = draft.author
        rememberedRelationship = draft.relationship
        store.save(draft, on: pageNumber)
        if store.errorMessage == nil {
            dismiss()
        }
    }
}

struct PhotoEditor: View {
    @Binding var photo: ScrapbookPhoto
    let number: Int
    let remove: () -> Void

    var body: some View {
        Section("Photo \(number)") {
            FramedPhoto(photo: photo)
                .frame(maxWidth: .infinity)
                .frame(height: 220)

            Picker("Frame", selection: $photo.frame) {
                ForEach(PhotoFrame.allCases) { frame in
                    Text(frame.title).tag(frame)
                }
            }

            TextField("A caption for this photo", text: $photo.caption, axis: .vertical)
                .lineLimit(2...4)
            DatePicker("Photo date", selection: $photo.date, displayedComponents: .date)
            Button("Remove photo", role: .destructive, action: remove)
        }
    }
}

struct TimelineView: View {
    @ObservedObject var store: MemoryStore
    @Environment(\.dismiss) private var dismiss

    private var items: [TimelineItem] {
        TimelineEngine.items(from: store.entries)
    }

    var body: some View {
        NavigationStack {
            Group {
                if items.isEmpty {
                    ContentUnavailableView(
                        "Your timeline is waiting",
                        systemImage: "calendar.badge.plus",
                        description: Text("Memories and milestones will appear here in date order.")
                    )
                } else {
                    List(items) { item in
                        TimelineRow(item: item)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Our Timeline")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

struct TimelineRow: View {
    let item: TimelineItem

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: item.entry.isMilestone ? "sparkles" : "photo.on.rectangle.angled")
                .font(.headline)
                .foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .background(
                    item.entry.isMilestone
                        ? Color(red: 0.68, green: 0.38, blue: 0.36)
                        : Color(red: 0.35, green: 0.20, blue: 0.12),
                    in: Circle()
                )

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(item.entry.date, format: .dateTime.month(.abbreviated).day().year())
                    Spacer()
                    Text("Page \(item.pageNumber)")
                }
                .font(.caption)
                .foregroundStyle(.secondary)

                Text(item.entry.title.isEmpty ? "A memory along the way" : item.entry.title)
                    .font(.system(.headline, design: .serif))

                if !item.entry.story.isEmpty {
                    Text(item.entry.story)
                        .font(.system(.subheadline, design: .serif))
                        .lineLimit(3)
                }

                Label(
                    "\(item.entry.photos.count) photo\(item.entry.photos.count == 1 ? "" : "s")",
                    systemImage: "photo"
                )
                .font(.caption)
                .foregroundStyle(.brown)
            }
        }
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
    }
}
