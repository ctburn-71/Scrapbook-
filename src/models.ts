export type PhotoFrame = 'rectangle' | 'rounded' | 'oval' | 'heart';

export type ScrapbookPhoto = {
  id: string;
  uri: string;
  frame: PhotoFrame;
  caption: string;
  date: string;
};

export type MemoryEntry = {
  title: string;
  story: string;
  author: string;
  relationship: string;
  date: string;
  isMilestone: boolean;
  photos: ScrapbookPhoto[];
};

export type ScrapbookState = {
  pageCount: number;
  memories: Record<string, MemoryEntry>;
  rememberedName: string;
  rememberedRelationship: string;
};

export const emptyMemory = (
  author = '',
  relationship = '',
): MemoryEntry => ({
  title: '',
  story: '',
  author,
  relationship,
  date: new Date().toISOString(),
  isMilestone: false,
  photos: [],
});

export const initialState: ScrapbookState = {
  pageCount: 8,
  memories: {},
  rememberedName: '',
  rememberedRelationship: '',
};

export const milestoneIdeas = [
  'We got engaged',
  'We chose our venue',
  'We set the date',
  'We found the dress',
  'Our wedding day',
  'The honeymoon',
];
