import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { initialState, ScrapbookState } from './models';

const storageKey = 'road-to-forever-state-v1';
const photoDirectory = `${FileSystem.documentDirectory}scrapbook-photos/`;

export async function loadScrapbook(): Promise<ScrapbookState> {
  const stored = await AsyncStorage.getItem(storageKey);
  if (!stored) return initialState;

  const parsed = JSON.parse(stored) as Partial<ScrapbookState>;
  return {
    pageCount: Math.max(8, parsed.pageCount ?? 8),
    memories: parsed.memories ?? {},
    rememberedName: parsed.rememberedName ?? '',
    rememberedRelationship: parsed.rememberedRelationship ?? '',
  };
}

export async function saveScrapbook(state: ScrapbookState): Promise<void> {
  await AsyncStorage.setItem(storageKey, JSON.stringify(state));
}

export async function keepPhoto(sourceUri: string, id: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(photoDirectory, { intermediates: true });
  const extension = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const destination = `${photoDirectory}${id}.${extension}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}

export async function removePhoto(uri: string): Promise<void> {
  if (!uri.startsWith(photoDirectory)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}
