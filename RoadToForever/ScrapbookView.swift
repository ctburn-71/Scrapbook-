import SwiftUI
import UIKit

struct ScrapbookView: View {
    @StateObject private var store = MemoryStore()
    @AppStorage("scrapbookPageCount") private var pageCount = 8
    @State private var showingTimeline = false

    var body: some View {
        ZStack(alignment: .topTrailing) {
            PageCurlView(pages: pages)
                .ignoresSafeArea()

            Button {
                showingTimeline = true
            } label: {
                Image(systemName: "calendar")
                    .font(.title3.weight(.semibold))
                    .frame(width: 46, height: 46)
            }
            .buttonStyle(.plain)
            .foregroundStyle(Color.cream)
            .background(Color.woodBrown, in: Circle())
            .shadow(color: .black.opacity(0.25), radius: 5, y: 3)
            .padding(.top, 16)
            .padding(.trailing, 16)
            .accessibilityLabel("Open wedding timeline")
        }
        .sheet(isPresented: $showingTimeline) {
            TimelineView(store: store)
        }
        .alert(
            "Scrapbook notice",
            isPresented: Binding(
                get: { store.errorMessage != nil },
                set: { if !$0 { store.errorMessage = nil } }
            )
        ) {
            Button("OK") { store.errorMessage = nil }
        } message: {
            Text(store.errorMessage ?? "")
        }
    }

    private var pages: [AnyView] {
        var result: [AnyView] = [
            AnyView(CoverPage()),
            AnyView(WelcomePage()),
            AnyView(ProposalPage())
        ]

        for page in 3...max(8, pageCount) {
            result.append(
                AnyView(
                    MemoryPage(
                        pageNumber: page,
                        store: store,
                        canAddPage: page == max(8, pageCount),
                        addPage: { pageCount = max(8, pageCount) + 1 }
                    )
                )
            )
        }
        return result
    }
}

struct PageCurlView: UIViewControllerRepresentable {
    let pages: [AnyView]

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIViewController(context: Context) -> UIPageViewController {
        let controller = UIPageViewController(
            transitionStyle: .pageCurl,
            navigationOrientation: .horizontal,
            options: [.spineLocation: NSNumber(value: UIPageViewController.SpineLocation.min.rawValue)]
        )
        controller.isDoubleSided = false
        controller.dataSource = context.coordinator
        controller.delegate = context.coordinator
        context.coordinator.update(pages, in: controller)
        return controller
    }

    func updateUIViewController(_ controller: UIPageViewController, context: Context) {
        context.coordinator.update(pages, in: controller)
    }

    final class Coordinator: NSObject, UIPageViewControllerDataSource, UIPageViewControllerDelegate {
        private var controllers: [UIHostingController<AnyView>] = []
        private var transitionInProgress = false
        private var pendingPages: [AnyView]?

        func update(_ pages: [AnyView], in pageController: UIPageViewController) {
            guard !transitionInProgress else {
                pendingPages = pages
                return
            }

            let pageCountChanged = pages.count != controllers.count
            let visible = pageController.viewControllers?.first
            let visibleIndex = visible.flatMap { current in
                controllers.firstIndex { $0 === current }
            } ?? 0

            for index in 0..<min(pages.count, controllers.count) {
                controllers[index].rootView = pages[index]
            }
            if pages.count > controllers.count {
                for index in controllers.count..<pages.count {
                    controllers.append(UIHostingController(rootView: pages[index]))
                }
            } else if pages.count < controllers.count {
                controllers.removeLast(controllers.count - pages.count)
            }

            guard !controllers.isEmpty else { return }
            let current = controllers[min(visibleIndex, controllers.count - 1)]
            if pageCountChanged {
                // Make UIKit ask for adjacent pages again when a new final sheet
                // is appended from the page that was previously the end.
                pageController.dataSource = nil
                pageController.dataSource = self
                pageController.setViewControllers([current], direction: .forward, animated: false)
            } else if pageController.viewControllers?.first !== current || visible == nil {
                pageController.setViewControllers([current], direction: .forward, animated: false)
            }
        }

        func pageViewController(
            _ pageViewController: UIPageViewController,
            viewControllerBefore viewController: UIViewController
        ) -> UIViewController? {
            guard let index = controllers.firstIndex(where: { $0 === viewController }),
                  index > 0 else { return nil }
            return controllers[index - 1]
        }

        func pageViewController(
            _ pageViewController: UIPageViewController,
            viewControllerAfter viewController: UIViewController
        ) -> UIViewController? {
            guard let index = controllers.firstIndex(where: { $0 === viewController }),
                  index + 1 < controllers.count else { return nil }
            return controllers[index + 1]
        }

        func pageViewController(
            _ pageViewController: UIPageViewController,
            willTransitionTo pendingViewControllers: [UIViewController]
        ) {
            transitionInProgress = true
        }

        func pageViewController(
            _ pageViewController: UIPageViewController,
            didFinishAnimating finished: Bool,
            previousViewControllers: [UIViewController],
            transitionCompleted completed: Bool
        ) {
            transitionInProgress = false
            if let pendingPages {
                self.pendingPages = nil
                update(pendingPages, in: pageViewController)
            }
        }
    }
}

struct CoverPage: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                WoodBackground()

                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.leather)
                    .overlay {
                        RoundedRectangle(cornerRadius: 8)
                            .strokeBorder(Color.cream.opacity(0.32), lineWidth: 2)
                            .padding(14)
                    }
                    .shadow(color: .black.opacity(0.45), radius: 18, x: 8, y: 9)
                    .padding(.horizontal, proxy.size.width * 0.08)
                    .padding(.vertical, proxy.size.height * 0.055)

                VStack(spacing: 26) {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 42))
                        .foregroundStyle(Color.dustyRose)

                    VStack(spacing: 10) {
                        Text("OUR ROAD")
                            .font(.system(size: 18, weight: .medium, design: .serif))
                            .tracking(6)
                        Text("to Forever")
                            .font(.system(size: 52, weight: .semibold, design: .serif))
                            .italic()
                            .minimumScaleFactor(0.65)
                    }
                    .foregroundStyle(Color.cream)
                    .multilineTextAlignment(.center)

                    Divider()
                        .overlay(Color.cream.opacity(0.55))
                        .frame(width: min(250, proxy.size.width * 0.55))

                    Text("RYAN  •  LIZ")
                        .font(.system(size: 16, weight: .semibold, design: .serif))
                        .tracking(4)
                        .foregroundStyle(Color.cream.opacity(0.9))

                    Text("Swipe the corner to begin")
                        .font(.caption)
                        .foregroundStyle(Color.cream.opacity(0.72))
                        .padding(.top, 32)
                }
                .padding(52)
            }
        }
        .ignoresSafeArea()
    }
}

struct WelcomePage: View {
    var body: some View {
        RusticPage(pageNumber: 1) {
            VStack(spacing: 28) {
                BotanicalDivider()

                Text("The story of us")
                    .font(.system(size: 40, weight: .semibold, design: .serif))
                    .foregroundStyle(Color.ink)

                Text("This book holds the little moments, big milestones, laughter, and love that carry us down the road to our wedding day.")
                    .font(.system(size: 21, design: .serif))
                    .multilineTextAlignment(.center)
                    .lineSpacing(8)
                    .foregroundStyle(Color.ink.opacity(0.88))
                    .frame(maxWidth: 560)

                Text("Leave room for the memories still to come.")
                    .font(.system(size: 18, design: .serif))
                    .italic()
                    .foregroundStyle(Color.woodBrown)

                BotanicalDivider()
                    .rotationEffect(.degrees(180))
            }
        }
    }
}

struct ProposalPage: View {
    var body: some View {
        RusticPage(pageNumber: 2) {
            VStack(spacing: 24) {
                Text("And so the adventure begins…")
                    .font(.system(size: 35, weight: .semibold, design: .serif))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.ink)

                PhotoPlaceholder(
                    icon: "sparkles",
                    title: "The proposal",
                    subtitle: "Add your proposal photo when you're ready"
                )
                .frame(maxWidth: 470, maxHeight: 390)
                .rotationEffect(.degrees(-1.5))

                Text("One question. One yes. A lifetime ahead.")
                    .font(.system(size: 19, design: .serif))
                    .italic()
                    .foregroundStyle(Color.woodBrown)
            }
        }
    }
}

struct MemoryPage: View {
    let pageNumber: Int
    @ObservedObject var store: MemoryStore
    let canAddPage: Bool
    let addPage: () -> Void
    @State private var editing = false

    var body: some View {
        RusticPage(pageNumber: pageNumber) {
            ScrollView {
                if let entry = store.entry(for: pageNumber) {
                    SavedMemory(entry: entry)
                        .frame(maxWidth: 620)
                } else {
                    EmptyMemory(pageNumber: pageNumber)
                        .frame(maxWidth: 540)
                        .padding(.top, 24)
                }
            }
            .scrollIndicators(.hidden)
        } footer: {
            HStack {
                Button {
                    editing = true
                } label: {
                    Label(
                        store.entry(for: pageNumber) == nil ? "Add a memory" : "Edit memory",
                        systemImage: "square.and.pencil"
                    )
                }
                .buttonStyle(RusticButtonStyle(filled: true))

                Spacer()

                if canAddPage {
                    Button(action: addPage) {
                        Label("Add page", systemImage: "plus")
                    }
                    .buttonStyle(RusticButtonStyle())
                }
            }
        }
        .sheet(isPresented: $editing) {
            MemoryEditor(pageNumber: pageNumber, store: store)
        }
    }
}

struct SavedMemory: View {
    let entry: MemoryEntry

    var body: some View {
        VStack(spacing: 17) {
            if entry.isMilestone {
                Label("A moment to remember", systemImage: "sparkles")
                    .font(.caption.smallCaps().weight(.semibold))
                    .foregroundStyle(Color.woodBrown)
            }

            Text(entry.title.isEmpty ? "A memory along the way" : entry.title)
                .font(.system(size: 31, weight: .semibold, design: .serif))
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.ink)

            if entry.photos.isEmpty {
                PhotoPlaceholder(
                    icon: "heart",
                    title: "Milestone saved",
                    subtitle: "A photo can be added later"
                )
                .frame(height: 230)
            } else {
                ScrapbookCollage(photos: entry.photos)
            }

            Text(entry.date, format: .dateTime.month(.wide).day().year())
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Color.woodBrown)

            if !entry.story.isEmpty {
                Text(entry.story)
                    .font(.system(size: 18, design: .serif))
                    .lineSpacing(5)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.ink.opacity(0.9))
            }

            Text(byline(for: entry))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 12)
    }

    private func byline(for entry: MemoryEntry) -> String {
        entry.relationship.isEmpty
            ? "Added by \(entry.author)"
            : "Added by \(entry.author) · \(entry.relationship)"
    }
}

struct EmptyMemory: View {
    let pageNumber: Int

    var body: some View {
        VStack(spacing: 22) {
            ZStack {
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.white.opacity(0.48))
                    .aspectRatio(4 / 3, contentMode: .fit)
                    .shadow(color: .brown.opacity(0.14), radius: 5, y: 3)
                Image(systemName: "photo.on.rectangle.angled")
                    .font(.system(size: 55, weight: .thin))
                    .foregroundStyle(Color.woodBrown.opacity(0.55))
            }
            .overlay(alignment: .top) {
                PaperTape()
                    .rotationEffect(.degrees(-4))
                    .offset(y: -9)
            }
            .rotationEffect(.degrees(pageNumber.isMultiple(of: 2) ? 1.2 : -1.2))

            Text("A blank page in your story")
                .font(.system(size: 28, weight: .semibold, design: .serif))
                .foregroundStyle(Color.ink)

            Text("Save a milestone now, or come back and add up to four photos when the moment arrives.")
                .font(.system(size: 17, design: .serif))
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.ink.opacity(0.72))
        }
    }
}

struct ScrapbookCollage: View {
    let photos: [ScrapbookPhoto]

    private var columns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 18), count: photos.count == 1 ? 1 : 2)
    }

    var body: some View {
        LazyVGrid(columns: columns, spacing: 22) {
            ForEach(Array(photos.enumerated()), id: \.element.id) { index, photo in
                VStack(spacing: 8) {
                    FramedPhoto(photo: photo)
                        .aspectRatio(1, contentMode: .fit)
                        .overlay(alignment: .top) {
                            PaperTape()
                                .rotationEffect(.degrees(index.isMultiple(of: 2) ? -8 : 8))
                                .offset(y: -8)
                        }
                        .rotationEffect(.degrees([-2.0, 1.5, 2.2, -1.3][index % 4]))

                    if !photo.caption.isEmpty {
                        Text(photo.caption)
                            .font(.system(.subheadline, design: .serif))
                            .multilineTextAlignment(.center)
                    }
                }
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 10)
    }
}

struct FramedPhoto: View {
    let photo: ScrapbookPhoto

    @ViewBuilder
    var body: some View {
        if let image = UIImage(data: photo.data) {
            switch photo.frame {
            case .rectangle:
                scrapbookImage(image)
                    .padding(9)
                    .background(Color.white.opacity(0.92))
                    .clipShape(Rectangle())
            case .rounded:
                scrapbookImage(image)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
            case .oval:
                scrapbookImage(image)
                    .clipShape(Ellipse())
            case .heart:
                scrapbookImage(image)
                    .clipShape(HeartShape())
            }
        }
    }

    @ViewBuilder
    private func scrapbookImage(_ image: UIImage) -> some View {
        Image(uiImage: image)
            .resizable()
            .scaledToFill()
            .clipped()
            .shadow(color: .black.opacity(0.2), radius: 5, y: 3)
    }
}

struct HeartShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.addCurve(
            to: CGPoint(x: rect.minX, y: rect.height * 0.3),
            control1: CGPoint(x: rect.width * 0.35, y: rect.height * 0.82),
            control2: CGPoint(x: rect.minX, y: rect.height * 0.58)
        )
        path.addCurve(
            to: CGPoint(x: rect.midX, y: rect.height * 0.18),
            control1: CGPoint(x: rect.minX, y: -rect.height * 0.04),
            control2: CGPoint(x: rect.width * 0.36, y: -rect.height * 0.04)
        )
        path.addCurve(
            to: CGPoint(x: rect.maxX, y: rect.height * 0.3),
            control1: CGPoint(x: rect.width * 0.64, y: -rect.height * 0.04),
            control2: CGPoint(x: rect.maxX, y: -rect.height * 0.04)
        )
        path.addCurve(
            to: CGPoint(x: rect.midX, y: rect.maxY),
            control1: CGPoint(x: rect.maxX, y: rect.height * 0.58),
            control2: CGPoint(x: rect.width * 0.65, y: rect.height * 0.82)
        )
        return path
    }
}

struct RusticPage<Content: View, Footer: View>: View {
    let pageNumber: Int
    @ViewBuilder let content: Content
    @ViewBuilder let footer: Footer

    init(
        pageNumber: Int,
        @ViewBuilder content: () -> Content,
        @ViewBuilder footer: () -> Footer
    ) {
        self.pageNumber = pageNumber
        self.content = content()
        self.footer = footer()
    }

    var body: some View {
        GeometryReader { proxy in
            VStack(spacing: 14) {
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                footer

                Text("— \(pageNumber) —")
                    .font(.caption2)
                    .foregroundStyle(Color.woodBrown.opacity(0.7))
            }
            .padding(.horizontal, max(28, proxy.size.width * 0.075))
            .padding(.top, max(54, proxy.safeAreaInsets.top + 22))
            .padding(.bottom, max(22, proxy.safeAreaInsets.bottom + 12))
            .frame(width: proxy.size.width, height: proxy.size.height)
            .background(PaperBackground())
        }
        .ignoresSafeArea()
    }
}

extension RusticPage where Footer == EmptyView {
    init(pageNumber: Int, @ViewBuilder content: () -> Content) {
        self.init(pageNumber: pageNumber, content: content, footer: { EmptyView() })
    }
}

struct PaperBackground: View {
    var body: some View {
        ZStack {
            Color.parchment
            Canvas { context, size in
                for index in 0..<34 {
                    let seed = Double(index)
                    let y = (seed * 47).truncatingRemainder(dividingBy: size.height)
                    let x = (seed * 83).truncatingRemainder(dividingBy: size.width)
                    var line = Path()
                    line.move(to: CGPoint(x: x, y: y))
                    line.addLine(to: CGPoint(x: min(size.width, x + 45 + seed), y: y + 2))
                    context.stroke(line, with: .color(.brown.opacity(0.055)), lineWidth: 0.8)
                }
            }
            LinearGradient(
                colors: [.brown.opacity(0.13), .clear, .clear, .brown.opacity(0.1)],
                startPoint: .leading,
                endPoint: .trailing
            )
        }
    }
}

struct WoodBackground: View {
    var body: some View {
        ZStack {
            Color(red: 0.20, green: 0.12, blue: 0.075)
            Canvas { context, size in
                for index in 0..<20 {
                    let y = size.height * CGFloat(index) / 20
                    var grain = Path()
                    grain.move(to: CGPoint(x: 0, y: y))
                    grain.addCurve(
                        to: CGPoint(x: size.width, y: y + CGFloat(index % 3) * 5),
                        control1: CGPoint(x: size.width * 0.3, y: y + 8),
                        control2: CGPoint(x: size.width * 0.65, y: y - 7)
                    )
                    context.stroke(grain, with: .color(.white.opacity(0.035)), lineWidth: 1)
                }
            }
            RadialGradient(colors: [.clear, .black.opacity(0.38)], center: .center, startRadius: 80, endRadius: 600)
        }
    }
}

struct PaperTape: View {
    var body: some View {
        Rectangle()
            .fill(Color(red: 0.78, green: 0.70, blue: 0.50).opacity(0.72))
            .frame(width: 72, height: 22)
            .overlay(Rectangle().stroke(.white.opacity(0.25), lineWidth: 1))
            .shadow(color: .brown.opacity(0.12), radius: 1, y: 1)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

struct PhotoPlaceholder: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        ZStack {
            Rectangle()
                .fill(Color.white.opacity(0.55))
                .shadow(color: .brown.opacity(0.18), radius: 8, y: 4)
            VStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 46, weight: .thin))
                Text(title)
                    .font(.system(.title3, design: .serif).weight(.semibold))
                Text(subtitle)
                    .font(.caption)
                    .multilineTextAlignment(.center)
            }
            .foregroundStyle(Color.woodBrown.opacity(0.72))
            .padding(24)
        }
        .overlay(alignment: .top) {
            PaperTape().rotationEffect(.degrees(4)).offset(y: -8)
        }
    }
}

struct BotanicalDivider: View {
    var body: some View {
        HStack(spacing: 7) {
            Rectangle().frame(width: 70, height: 1)
            Image(systemName: "leaf.fill")
                .rotationEffect(.degrees(-30))
            Image(systemName: "heart.fill")
                .font(.caption)
            Image(systemName: "leaf.fill")
                .rotationEffect(.degrees(210))
            Rectangle().frame(width: 70, height: 1)
        }
        .foregroundStyle(Color.sage)
    }
}

struct RusticButtonStyle: ButtonStyle {
    var filled = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 15)
            .padding(.vertical, 11)
            .foregroundStyle(filled ? Color.cream : Color.woodBrown)
            .background(filled ? Color.woodBrown : Color.cream.opacity(0.45))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Color.woodBrown.opacity(0.55), lineWidth: 1))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

private extension Color {
    static let parchment = Color(red: 0.91, green: 0.85, blue: 0.71)
    static let cream = Color(red: 0.97, green: 0.93, blue: 0.82)
    static let leather = Color(red: 0.30, green: 0.14, blue: 0.09)
    static let woodBrown = Color(red: 0.35, green: 0.20, blue: 0.12)
    static let ink = Color(red: 0.18, green: 0.13, blue: 0.10)
    static let sage = Color(red: 0.33, green: 0.42, blue: 0.28)
    static let dustyRose = Color(red: 0.68, green: 0.38, blue: 0.36)
}
