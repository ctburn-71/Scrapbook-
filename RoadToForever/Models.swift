import Foundation

enum PhotoFrame: String, CaseIterable, Codable, Identifiable {
    case rectangle
    case rounded
    case oval
    case heart

    var id: Self { self }

    var title: String {
        rawValue.capitalized
    }
}

struct ScrapbookPhoto: Codable, Identifiable, Equatable {
    var id = UUID()
    var data: Data
    var frame: PhotoFrame = .rectangle
    var caption = ""
    var date = Date()
}

struct MemoryEntry: Codable, Equatable {
    var title = ""
    var story = ""
    var author = ""
    var relationship = ""
    var date = Date()
    var isMilestone = false
    var photos: [ScrapbookPhoto] = []
}

struct TimelineItem: Identifiable {
    let pageNumber: Int
    let entry: MemoryEntry

    var id: Int { pageNumber }
}

enum TimelineEngine {
    static func items(from entries: [Int: MemoryEntry]) -> [TimelineItem] {
        entries
            .map { pageNumber, entry in
                TimelineItem(pageNumber: pageNumber, entry: entry)
            }
            .sorted {
                if $0.entry.date == $1.entry.date {
                    return $0.pageNumber < $1.pageNumber
                }
                return $0.entry.date < $1.entry.date
            }
    }
}
