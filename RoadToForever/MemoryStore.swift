import Foundation

@MainActor
final class MemoryStore: ObservableObject {
    @Published private(set) var entries: [Int: MemoryEntry] = [:]
    @Published var errorMessage: String?

    private let fileURL: URL

    init(storageDirectory: URL? = nil) {
        let directory = storageDirectory
            ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        fileURL = directory.appendingPathComponent("road-to-forever.json")
        load()
    }

    func entry(for page: Int) -> MemoryEntry? {
        entries[page]
    }

    func save(_ entry: MemoryEntry, on page: Int) {
        guard entry.photos.count <= 4 else {
            errorMessage = "Each page can hold up to four photos."
            return
        }

        let previous = entries[page]
        entries[page] = entry

        do {
            let data = try JSONEncoder.scrapbook.encode(entries)
            try data.write(to: fileURL, options: [.atomic, .completeFileProtection])
        } catch {
            if let previous {
                entries[page] = previous
            } else {
                entries.removeValue(forKey: page)
            }
            errorMessage = "This memory could not be saved. \(error.localizedDescription)"
        }
    }

    func removeEntry(on page: Int) {
        let previous = entries.removeValue(forKey: page)
        do {
            let data = try JSONEncoder.scrapbook.encode(entries)
            try data.write(to: fileURL, options: [.atomic, .completeFileProtection])
        } catch {
            entries[page] = previous
            errorMessage = "This page could not be cleared. \(error.localizedDescription)"
        }
    }

    private func load() {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        do {
            entries = try JSONDecoder.scrapbook.decode(
                [Int: MemoryEntry].self,
                from: Data(contentsOf: fileURL)
            )
        } catch {
            errorMessage = "Your saved scrapbook could not be opened. No changes have been made."
        }
    }
}

private extension JSONEncoder {
    static var scrapbook: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}

private extension JSONDecoder {
    static var scrapbook: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
