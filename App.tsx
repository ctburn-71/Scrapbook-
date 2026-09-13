import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  emptyMemory,
  MemoryEntry,
  milestoneIdeas,
  PhotoFrame,
  ScrapbookPhoto,
  ScrapbookState,
  initialState,
} from './src/models';
import {
  keepPhoto,
  loadScrapbook,
  removePhoto,
  saveScrapbook,
} from './src/storage';

const colors = {
  parchment: '#ead9b5',
  cream: '#f7edcf',
  leather: '#522718',
  brown: '#5c3521',
  darkWood: '#2d1a11',
  ink: '#302117',
  sage: '#667454',
  rose: '#aa625d',
  muted: '#806f5d',
  white: '#fffdf7',
};

export default function App() {
  const [scrapbook, setScrapbook] = useState<ScrapbookState>(initialState);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(0);
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  useEffect(() => {
    loadScrapbook()
      .then(setScrapbook)
      .catch(() => Alert.alert('Unable to open scrapbook', 'Please close and reopen the app.'))
      .finally(() => setLoaded(true));
  }, []);

  const updateScrapbook = async (next: ScrapbookState) => {
    setScrapbook(next);
    try {
      await saveScrapbook(next);
    } catch {
      Alert.alert('Unable to save', 'Your latest change could not be stored.');
    }
  };

  const pages = useMemo(
    () => [
      <CoverPage key="cover" />,
      <WelcomePage key="welcome" />,
      <ProposalPage key="proposal" />,
      ...Array.from({ length: scrapbook.pageCount - 2 }, (_, index) => {
        const pageNumber = index + 3;
        return (
          <MemoryPage
            key={pageNumber}
            pageNumber={pageNumber}
            entry={scrapbook.memories[String(pageNumber)]}
            isLast={pageNumber === scrapbook.pageCount}
            onEdit={() => setEditingPage(pageNumber)}
            onAddPage={() =>
              void updateScrapbook({
                ...scrapbook,
                pageCount: scrapbook.pageCount + 1,
              })
            }
          />
        );
      }),
    ],
    [scrapbook],
  );

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brown} />
        <Text style={styles.loadingText}>Opening your scrapbook…</Text>
      </View>
    );
  }

  return (
    <View style={styles.app}>
      <StatusBar style="light" />
      <BookPager pages={pages} page={page} onPageChange={setPage} />

      <SafeAreaView style={styles.floatingTools} pointerEvents="box-none">
        <Pressable
          accessibilityLabel="Open wedding timeline"
          onPress={() => setTimelineOpen(true)}
          style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
        >
          <Text style={styles.roundButtonText}>⌛</Text>
        </Pressable>
      </SafeAreaView>

      <MemoryEditor
        visible={editingPage !== null}
        pageNumber={editingPage ?? 3}
        initialEntry={
          editingPage === null
            ? undefined
            : scrapbook.memories[String(editingPage)]
        }
        rememberedName={scrapbook.rememberedName}
        rememberedRelationship={scrapbook.rememberedRelationship}
        onClose={() => setEditingPage(null)}
        onSave={(entry) => {
          if (editingPage === null) return;
          void updateScrapbook({
            ...scrapbook,
            memories: {
              ...scrapbook.memories,
              [String(editingPage)]: entry,
            },
            rememberedName: entry.author,
            rememberedRelationship: entry.relationship,
          });
          setEditingPage(null);
        }}
        onClear={() => {
          if (editingPage === null) return;
          const entry = scrapbook.memories[String(editingPage)];
          entry?.photos.forEach((photo) => void removePhoto(photo.uri));
          const memories = { ...scrapbook.memories };
          delete memories[String(editingPage)];
          void updateScrapbook({ ...scrapbook, memories });
          setEditingPage(null);
        }}
      />

      <Timeline
        visible={timelineOpen}
        memories={scrapbook.memories}
        onClose={() => setTimelineOpen(false)}
      />
    </View>
  );
}

function BookPager({
  pages,
  page,
  onPageChange,
}: {
  pages: React.ReactNode[];
  page: number;
  onPageChange: (page: number) => void;
}) {
  const turn = useRef(new Animated.Value(0)).current;
  const width = Dimensions.get('window').width;

  const finishTurn = (direction: -1 | 1) => {
    const nextPage = page + direction;
    if (nextPage < 0 || nextPage >= pages.length) {
      Animated.spring(turn, { toValue: 0, useNativeDriver: true }).start();
      return;
    }
    Animated.timing(turn, {
      toValue: direction,
      duration: 230,
      useNativeDriver: true,
    }).start(() => {
      onPageChange(nextPage);
      turn.setValue(0);
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_, gesture) => {
          turn.setValue(Math.max(-1, Math.min(1, -gesture.dx / width)));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx < -55 || gesture.vx < -0.5) finishTurn(1);
          else if (gesture.dx > 55 || gesture.vx > 0.5) finishTurn(-1);
          else Animated.spring(turn, { toValue: 0, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(turn, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [page, pages.length, width],
  );

  const rotate = turn.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-9deg', '0deg', '9deg'],
  });
  const translateX = turn.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [width, 0, -width],
  });

  return (
    <View style={styles.pager} {...panResponder.panHandlers}>
      <Animated.View
        style={[
          styles.pageTurn,
          { transform: [{ perspective: 1100 }, { translateX }, { rotateY: rotate }] },
        ]}
      >
        {pages[page]}
      </Animated.View>
      <View pointerEvents="none" style={styles.pageEdge} />
    </View>
  );
}

function CoverPage() {
  return (
    <View style={[styles.fullPage, styles.wood]}>
      {Array.from({ length: 15 }, (_, index) => (
        <View key={index} style={[styles.woodGrain, { top: `${index * 7}%` }]} />
      ))}
      <View style={styles.leatherCover}>
        <View style={styles.coverInset}>
          <Text style={styles.coverHeart}>♥</Text>
          <Text style={styles.coverSmall}>OUR ROAD</Text>
          <Text style={styles.coverTitle}>to Forever</Text>
          <View style={styles.coverRule} />
          <Text style={styles.coverNames}>RYAN  •  LIZ</Text>
          <Text style={styles.swipeHint}>Swipe the page to begin</Text>
        </View>
      </View>
    </View>
  );
}

function WelcomePage() {
  return (
    <RusticPage pageNumber={1}>
      <View style={styles.centerContent}>
        <BotanicalDivider />
        <Text style={styles.largeTitle}>The story of us</Text>
        <Text style={styles.welcomeCopy}>
          This book holds the little moments, big milestones, laughter, and love
          that carry us down the road to our wedding day.
        </Text>
        <Text style={styles.italicCopy}>
          Leave room for the memories still to come.
        </Text>
        <BotanicalDivider />
      </View>
    </RusticPage>
  );
}

function ProposalPage() {
  return (
    <RusticPage pageNumber={2}>
      <ScrollView contentContainerStyle={styles.centerContent}>
        <Text style={styles.largeTitle}>And so the adventure begins…</Text>
        <PhotoPlaceholder
          icon="✦"
          title="The proposal"
          subtitle="Add your proposal photo when you're ready"
        />
        <Text style={styles.italicCopy}>
          One question. One yes. A lifetime ahead.
        </Text>
      </ScrollView>
    </RusticPage>
  );
}

function MemoryPage({
  pageNumber,
  entry,
  isLast,
  onEdit,
  onAddPage,
}: {
  pageNumber: number;
  entry?: MemoryEntry;
  isLast: boolean;
  onEdit: () => void;
  onAddPage: () => void;
}) {
  return (
    <RusticPage pageNumber={pageNumber}>
      <ScrollView contentContainerStyle={styles.memoryScroll}>
        {entry ? <SavedMemory entry={entry} /> : <EmptyMemory />}
      </ScrollView>
      <View style={styles.pageActions}>
        <RusticButton
          label={entry ? 'Edit memory' : 'Add a memory'}
          filled
          onPress={onEdit}
        />
        {isLast ? <RusticButton label="+ Add page" onPress={onAddPage} /> : null}
      </View>
    </RusticPage>
  );
}

function RusticPage({
  pageNumber,
  children,
}: {
  pageNumber: number;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView style={[styles.fullPage, styles.paper]}>
      <View style={styles.paperShadowLeft} />
      {Array.from({ length: 16 }, (_, index) => (
        <View
          key={index}
          style={[
            styles.paperFiber,
            { top: `${3 + index * 6}%`, left: `${(index * 23) % 82}%` },
          ]}
        />
      ))}
      <View style={styles.pageContents}>
        <View style={styles.pageBody}>{children}</View>
        <Text style={styles.pageNumber}>— {pageNumber} —</Text>
      </View>
    </SafeAreaView>
  );
}

function SavedMemory({ entry }: { entry: MemoryEntry }) {
  return (
    <View style={styles.savedMemory}>
      {entry.isMilestone ? (
        <Text style={styles.milestoneLabel}>✦ A MOMENT TO REMEMBER ✦</Text>
      ) : null}
      <Text style={styles.memoryTitle}>
        {entry.title || 'A memory along the way'}
      </Text>
      {entry.photos.length ? (
        <PhotoCollage photos={entry.photos} />
      ) : (
        <PhotoPlaceholder
          icon="♥"
          title="Milestone saved"
          subtitle="A photo can be added later"
        />
      )}
      <Text style={styles.memoryDate}>{formatDate(entry.date)}</Text>
      {entry.story ? <Text style={styles.story}>{entry.story}</Text> : null}
      <Text style={styles.byline}>
        Added by {entry.author}
        {entry.relationship ? ` · ${entry.relationship}` : ''}
      </Text>
    </View>
  );
}

function EmptyMemory() {
  return (
    <View style={styles.emptyMemory}>
      <PhotoPlaceholder
        icon="▧"
        title="A blank page in your story"
        subtitle="Save a milestone now, or return to add photos when the moment arrives."
      />
    </View>
  );
}

function PhotoCollage({ photos }: { photos: ScrapbookPhoto[] }) {
  return (
    <View style={styles.collage}>
      {photos.map((photo, index) => (
        <View
          key={photo.id}
          style={[
            styles.collageItem,
            photos.length === 1 && styles.singlePhoto,
            { transform: [{ rotate: index % 2 ? '1.5deg' : '-1.5deg' }] },
          ]}
        >
          <PhotoFrameView photo={photo} />
          {photo.caption ? <Text style={styles.photoCaption}>{photo.caption}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function PhotoFrameView({ photo }: { photo: ScrapbookPhoto }) {
  const frameStyle =
    photo.frame === 'oval'
      ? styles.ovalPhoto
      : photo.frame === 'rounded'
        ? styles.roundedPhoto
        : photo.frame === 'heart'
          ? styles.heartPhoto
          : undefined;
  return (
    <View style={[styles.photoPaper, photo.frame !== 'rectangle' && styles.clearFrame]}>
      <View style={styles.tape} />
      <Image source={{ uri: photo.uri }} style={[styles.photo, frameStyle]} />
      {photo.frame === 'heart' ? <Text style={styles.heartBadge}>♥</Text> : null}
    </View>
  );
}

function PhotoPlaceholder({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.placeholder}>
      <View style={styles.tape} />
      <Text style={styles.placeholderIcon}>{icon}</Text>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderSubtitle}>{subtitle}</Text>
    </View>
  );
}

function BotanicalDivider() {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerLeaf}>❧ ♥ ❧</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

function RusticButton({
  label,
  filled = false,
  onPress,
}: {
  label: string;
  filled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rusticButton,
        filled && styles.rusticButtonFilled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.rusticButtonText, filled && styles.rusticButtonTextFilled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function MemoryEditor({
  visible,
  pageNumber,
  initialEntry,
  rememberedName,
  rememberedRelationship,
  onClose,
  onSave,
  onClear,
}: {
  visible: boolean;
  pageNumber: number;
  initialEntry?: MemoryEntry;
  rememberedName: string;
  rememberedRelationship: string;
  onClose: () => void;
  onSave: (entry: MemoryEntry) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<MemoryEntry>(emptyMemory());
  const [addingPhotos, setAddingPhotos] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraft(
      initialEntry
        ? JSON.parse(JSON.stringify(initialEntry))
        : emptyMemory(rememberedName, rememberedRelationship),
    );
  }, [visible, pageNumber]);

  const update = <K extends keyof MemoryEntry>(key: K, value: MemoryEntry[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const choosePhotos = async () => {
    const available = 4 - draft.photos.length;
    if (available < 1) return;
    setAddingPhotos(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: available > 1,
        selectionLimit: available,
        quality: 0.82,
      });
      if (result.canceled) return;

      const additions: ScrapbookPhoto[] = [];
      for (const asset of result.assets.slice(0, available)) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const uri = await keepPhoto(asset.uri, id);
        additions.push({
          id,
          uri,
          frame: 'rectangle',
          caption: '',
          date: draft.date,
        });
      }
      setDraft((current) => ({
        ...current,
        photos: [...current.photos, ...additions].slice(0, 4),
      }));
    } catch {
      Alert.alert('Photos could not be added', 'Please choose the photos again.');
    } finally {
      setAddingPhotos(false);
    }
  };

  const valid =
    draft.author.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(draft.date.slice(0, 10)) &&
    !Number.isNaN(new Date(`${draft.date.slice(0, 10)}T12:00:00`).getTime()) &&
    (draft.isMilestone
      ? draft.title.trim().length > 0
      : draft.photos.length > 0 || draft.story.trim().length > 0);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose}><Text style={styles.headerAction}>Cancel</Text></Pressable>
            <Text style={styles.modalTitle}>Page {pageNumber}</Text>
            <Pressable
              disabled={!valid || addingPhotos}
              onPress={() =>
                onSave({
                  ...draft,
                  title: draft.title.trim(),
                  story: draft.story.trim(),
                  author: draft.author.trim(),
                  relationship: draft.relationship.trim(),
                })
              }
            >
              <Text style={[styles.headerAction, (!valid || addingPhotos) && styles.disabled]}>
                Save
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.form}>
            <FormSection title="THIS PAGE">
              <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>Mark as a milestone</Text>
                <Switch
                  value={draft.isMilestone}
                  onValueChange={(value) => update('isMilestone', value)}
                  trackColor={{ true: colors.rose }}
                />
              </View>
              {draft.isMilestone ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {milestoneIdeas.map((idea) => (
                    <Pressable
                      key={idea}
                      onPress={() => update('title', idea)}
                      style={styles.ideaChip}
                    >
                      <Text style={styles.ideaChipText}>{idea}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              <FormInput
                label={draft.isMilestone ? 'Milestone title' : 'Memory title'}
                value={draft.title}
                onChangeText={(value) => update('title', value)}
              />
              <FormInput
                label="Date (YYYY-MM-DD)"
                value={draft.date.slice(0, 10)}
                onChangeText={(value) => update('date', value)}
              />
            </FormSection>

            <FormSection title={`PHOTOS · ${draft.photos.length} OF 4`}>
              {draft.photos.length < 4 ? (
                <RusticButton
                  label={draft.photos.length ? '+ Add more photos' : '+ Choose photos'}
                  onPress={() => void choosePhotos()}
                />
              ) : null}
              {addingPhotos ? <ActivityIndicator color={colors.brown} /> : null}
              <Text style={styles.helpText}>
                Save a milestone without photos and return to add them later.
              </Text>
            </FormSection>

            {draft.photos.map((photo, index) => (
              <PhotoEditor
                key={photo.id}
                photo={photo}
                number={index + 1}
                onChange={(nextPhoto) =>
                  update(
                    'photos',
                    draft.photos.map((item) =>
                      item.id === nextPhoto.id ? nextPhoto : item,
                    ),
                  )
                }
                onRemove={() => {
                  void removePhoto(photo.uri);
                  update(
                    'photos',
                    draft.photos.filter((item) => item.id !== photo.id),
                  );
                }}
              />
            ))}

            <FormSection title="THE STORY">
              <FormInput
                label="What happened?"
                value={draft.story}
                multiline
                onChangeText={(value) => update('story', value)}
              />
              <FormInput
                label="Added by"
                value={draft.author}
                onChangeText={(value) => update('author', value)}
              />
              <FormInput
                label="Family, friend, wedding party…"
                value={draft.relationship}
                onChangeText={(value) => update('relationship', value)}
              />
            </FormSection>

            {initialEntry ? (
              <Pressable
                onPress={() =>
                  Alert.alert('Clear this page?', 'This removes its story and photos.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear page', style: 'destructive', onPress: onClear },
                  ])
                }
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonText}>Clear this page</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function PhotoEditor({
  photo,
  number,
  onChange,
  onRemove,
}: {
  photo: ScrapbookPhoto;
  number: number;
  onChange: (photo: ScrapbookPhoto) => void;
  onRemove: () => void;
}) {
  const frames: PhotoFrame[] = ['rectangle', 'rounded', 'oval', 'heart'];
  return (
    <FormSection title={`PHOTO ${number}`}>
      <PhotoFrameView photo={photo} />
      <View style={styles.frameChoices}>
        {frames.map((frame) => (
          <Pressable
            key={frame}
            onPress={() => onChange({ ...photo, frame })}
            style={[styles.frameChip, photo.frame === frame && styles.frameChipSelected]}
          >
            <Text style={photo.frame === frame && styles.frameChipTextSelected}>
              {frame[0]?.toUpperCase()}{frame.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
      <FormInput
        label="Photo caption"
        value={photo.caption}
        onChangeText={(caption) => onChange({ ...photo, caption })}
      />
      <Pressable onPress={onRemove}>
        <Text style={styles.removeText}>Remove photo</Text>
      </Pressable>
    </FormSection>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.formSection}>
      <Text style={styles.formSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function FormInput({
  label,
  value,
  multiline = false,
  onChangeText,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.formInput}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        style={[styles.textInput, multiline && styles.multilineInput]}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

function Timeline({
  visible,
  memories,
  onClose,
}: {
  visible: boolean;
  memories: Record<string, MemoryEntry>;
  onClose: () => void;
}) {
  const entries = Object.entries(memories).sort((a, b) => {
    const dateDifference = new Date(a[1].date).getTime() - new Date(b[1].date).getTime();
    return dateDifference || Number(a[0]) - Number(b[0]);
  });
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalHeader}>
          <View style={styles.headerSpacer} />
          <Text style={styles.modalTitle}>Our Timeline</Text>
          <Pressable onPress={onClose}><Text style={styles.headerAction}>Done</Text></Pressable>
        </View>
        {entries.length ? (
          <ScrollView contentContainerStyle={styles.timeline}>
            {entries.map(([pageNumber, entry]) => (
              <View key={pageNumber} style={styles.timelineRow}>
                <View style={[styles.timelineIcon, entry.isMilestone && styles.milestoneIcon]}>
                  <Text style={styles.timelineIconText}>{entry.isMilestone ? '✦' : '▧'}</Text>
                </View>
                <View style={styles.timelineCopy}>
                  <View style={styles.timelineMeta}>
                    <Text style={styles.timelineMetaText}>{formatDate(entry.date)}</Text>
                    <Text style={styles.timelineMetaText}>Page {pageNumber}</Text>
                  </View>
                  <Text style={styles.timelineTitle}>
                    {entry.title || 'A memory along the way'}
                  </Text>
                  {entry.story ? (
                    <Text numberOfLines={3} style={styles.timelineStory}>{entry.story}</Text>
                  ) : null}
                  <Text style={styles.timelinePhotos}>
                    {entry.photos.length} photo{entry.photos.length === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyTimeline}>
            <Text style={styles.placeholderIcon}>⌛</Text>
            <Text style={styles.placeholderTitle}>Your timeline is waiting</Text>
            <Text style={styles.placeholderSubtitle}>
              Memories and milestones will appear here in date order.
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function formatDate(value: string) {
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value,
  );
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.darkWood },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.parchment },
  loadingText: { marginTop: 14, color: colors.brown, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  pager: { flex: 1, overflow: 'hidden' },
  pageTurn: { flex: 1, backgroundColor: colors.parchment },
  pageEdge: { position: 'absolute', right: 0, width: 5, top: 0, bottom: 0, backgroundColor: '#6d4a2b55' },
  fullPage: { flex: 1 },
  wood: { backgroundColor: colors.darkWood, padding: '7%', justifyContent: 'center' },
  woodGrain: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#ffffff0d' },
  leatherCover: { flex: 1, maxHeight: 760, width: '100%', maxWidth: 650, alignSelf: 'center', padding: 14, borderRadius: 10, backgroundColor: colors.leather, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, elevation: 14 },
  coverInset: { flex: 1, borderWidth: 2, borderColor: '#f7edcf55', borderRadius: 5, padding: 30, justifyContent: 'center', alignItems: 'center' },
  coverHeart: { color: colors.rose, fontSize: 48, marginBottom: 22 },
  coverSmall: { color: colors.cream, fontSize: 18, letterSpacing: 7, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  coverTitle: { color: colors.cream, fontSize: 52, fontStyle: 'italic', marginTop: 5, textAlign: 'center', fontFamily: Platform.select({ ios: 'Georgia-Bold', android: 'serif' }) },
  coverRule: { height: 1, width: 230, maxWidth: '75%', backgroundColor: '#f7edcf88', marginVertical: 28 },
  coverNames: { color: colors.cream, fontWeight: '700', letterSpacing: 4 },
  swipeHint: { color: '#f7edcfaa', marginTop: 56, fontSize: 12 },
  paper: { backgroundColor: colors.parchment },
  paperShadowLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 20, backgroundColor: '#5c35211a' },
  paperFiber: { position: 'absolute', width: 65, height: 1, backgroundColor: '#6d4a2b13' },
  pageContents: { flex: 1, paddingHorizontal: '7%', paddingTop: 28, paddingBottom: 12 },
  pageBody: { flex: 1 },
  pageNumber: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 10 },
  centerContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 27, paddingVertical: 32 },
  largeTitle: { color: colors.ink, fontSize: 36, fontWeight: '700', textAlign: 'center', fontFamily: Platform.select({ ios: 'Georgia-Bold', android: 'serif' }) },
  welcomeCopy: { color: colors.ink, opacity: 0.88, fontSize: 20, lineHeight: 31, textAlign: 'center', maxWidth: 570, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  italicCopy: { color: colors.brown, fontSize: 17, fontStyle: 'italic', textAlign: 'center', fontFamily: Platform.select({ ios: 'Georgia-Italic', android: 'serif' }) },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dividerLine: { width: 65, maxWidth: '20%', height: 1, backgroundColor: colors.sage },
  dividerLeaf: { color: colors.sage, fontSize: 16 },
  memoryScroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 14 },
  pageActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingTop: 8 },
  savedMemory: { alignItems: 'center', gap: 15, width: '100%', maxWidth: 680, alignSelf: 'center' },
  milestoneLabel: { color: colors.brown, fontWeight: '700', fontSize: 11, letterSpacing: 1.2 },
  memoryTitle: { color: colors.ink, fontSize: 30, fontWeight: '700', textAlign: 'center', fontFamily: Platform.select({ ios: 'Georgia-Bold', android: 'serif' }) },
  memoryDate: { color: colors.brown, fontWeight: '600' },
  story: { color: colors.ink, fontSize: 17, lineHeight: 25, textAlign: 'center', maxWidth: 580, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  byline: { color: colors.muted, fontSize: 12 },
  emptyMemory: { width: '100%', maxWidth: 540, alignSelf: 'center' },
  placeholder: { minHeight: 230, width: '100%', maxWidth: 500, alignSelf: 'center', backgroundColor: '#fffdf780', alignItems: 'center', justifyContent: 'center', padding: 25, shadowColor: colors.brown, shadowOpacity: 0.16, shadowRadius: 7, elevation: 4 },
  tape: { position: 'absolute', zIndex: 3, top: -9, alignSelf: 'center', width: 72, height: 22, backgroundColor: '#c7b27bbd', borderWidth: 1, borderColor: '#ffffff55', transform: [{ rotate: '-4deg' }] },
  placeholderIcon: { color: '#5c352199', fontSize: 48, marginBottom: 12 },
  placeholderTitle: { color: colors.brown, fontWeight: '700', fontSize: 20, textAlign: 'center', fontFamily: Platform.select({ ios: 'Georgia-Bold', android: 'serif' }) },
  placeholderSubtitle: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 8, maxWidth: 320 },
  collage: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  collageItem: { width: '46%', minWidth: 130, maxWidth: 285, alignItems: 'center' },
  singlePhoto: { width: '82%', maxWidth: 430 },
  photoPaper: { width: '100%', aspectRatio: 1, backgroundColor: colors.white, padding: 9, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },
  clearFrame: { padding: 0, backgroundColor: 'transparent' },
  photo: { width: '100%', height: '100%', resizeMode: 'cover' },
  roundedPhoto: { borderRadius: 18 },
  ovalPhoto: { borderRadius: 1000 },
  heartPhoto: { borderTopLeftRadius: 80, borderTopRightRadius: 80, borderBottomLeftRadius: 34, borderBottomRightRadius: 34 },
  heartBadge: { position: 'absolute', bottom: -7, right: -7, fontSize: 29, color: colors.rose, textShadowColor: colors.white, textShadowRadius: 2 },
  photoCaption: { color: colors.ink, marginTop: 8, textAlign: 'center', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  rusticButton: { borderWidth: 1, borderColor: '#5c352188', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: '#fffdf755', alignSelf: 'flex-start' },
  rusticButtonFilled: { backgroundColor: colors.brown },
  rusticButtonText: { color: colors.brown, fontWeight: '700', fontSize: 13 },
  rusticButtonTextFilled: { color: colors.cream },
  floatingTools: { position: 'absolute', right: 14, top: 0 },
  roundButton: { width: 47, height: 47, borderRadius: 24, backgroundColor: colors.brown, alignItems: 'center', justifyContent: 'center', marginTop: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, elevation: 6 },
  roundButtonText: { fontSize: 20 },
  pressed: { opacity: 0.68 },
  modal: { flex: 1, backgroundColor: '#f6f0e3' },
  modalHeader: { minHeight: 53, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#5c352144' },
  modalTitle: { color: colors.ink, fontWeight: '700', fontSize: 17, fontFamily: Platform.select({ ios: 'Georgia-Bold', android: 'serif' }) },
  headerAction: { color: colors.brown, fontWeight: '700', paddingVertical: 12, minWidth: 55 },
  headerSpacer: { width: 55 },
  disabled: { opacity: 0.35 },
  form: { padding: 16, gap: 17, paddingBottom: 50, maxWidth: 720, width: '100%', alignSelf: 'center' },
  formSection: { backgroundColor: colors.white, borderRadius: 13, padding: 16, gap: 13, shadowColor: '#5c3521', shadowOpacity: 0.06, shadowRadius: 5, elevation: 2 },
  formSectionTitle: { color: colors.brown, fontWeight: '700', fontSize: 12, letterSpacing: 1.1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ideaChip: { backgroundColor: '#ead9b580', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, marginRight: 8 },
  ideaChipText: { color: colors.brown, fontSize: 12 },
  formInput: { gap: 5 },
  inputLabel: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  textInput: { backgroundColor: '#ead9b544', borderBottomWidth: 1, borderBottomColor: '#5c352155', borderRadius: 5, paddingHorizontal: 11, paddingVertical: 10, color: colors.ink, fontSize: 16 },
  multilineInput: { minHeight: 92, textAlignVertical: 'top' },
  helpText: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  frameChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  frameChip: { borderWidth: 1, borderColor: '#5c352166', borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7 },
  frameChipSelected: { backgroundColor: colors.brown },
  frameChipTextSelected: { color: colors.cream },
  removeText: { color: '#a03932', fontWeight: '600' },
  clearButton: { padding: 15, alignItems: 'center' },
  clearButtonText: { color: '#a03932', fontWeight: '700' },
  timeline: { padding: 17, gap: 5, maxWidth: 720, width: '100%', alignSelf: 'center' },
  timelineRow: { flexDirection: 'row', gap: 13, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#5c352133' },
  timelineIcon: { width: 41, height: 41, borderRadius: 21, backgroundColor: colors.brown, justifyContent: 'center', alignItems: 'center' },
  milestoneIcon: { backgroundColor: colors.rose },
  timelineIconText: { color: colors.white, fontSize: 18 },
  timelineCopy: { flex: 1, gap: 5 },
  timelineMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  timelineMetaText: { color: colors.muted, fontSize: 11 },
  timelineTitle: { color: colors.ink, fontSize: 17, fontWeight: '700', fontFamily: Platform.select({ ios: 'Georgia-Bold', android: 'serif' }) },
  timelineStory: { color: colors.ink, lineHeight: 19, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
  timelinePhotos: { color: colors.brown, fontSize: 12, fontWeight: '600' },
  emptyTimeline: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 35 },
});
