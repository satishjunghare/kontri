import { Directory, File, Paths } from 'expo-file-system';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { newId } from './id.ts';

/** Photos are shrunk to at most this width (px): about 300-500 KB each instead of several MB. */
export const MAX_PHOTO_WIDTH = 1600;
const JPEG_QUALITY = 0.8;
const isWeb = Platform.OS === 'web';

function photosDir(): Directory {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/**
 * Turns the stored `file` value into something an <Image> can show.
 * On phones `file` is a name inside the app's photos folder (the folder's full path can change
 * between app updates, so only the name is stored). On the web preview it is a ready-made URI.
 */
export function photoUri(file: string): string {
  return isWeb ? file : new File(photosDir(), file).uri;
}

export interface SavedPhoto {
  file: string;
  width: number;
  height: number;
}

/** Shrinks a picked image and copies it into the app's own storage. */
export async function savePhoto(pickedUri: string, pickedWidth: number): Promise<SavedPhoto> {
  const actions = pickedWidth > MAX_PHOTO_WIDTH ? [{ resize: { width: MAX_PHOTO_WIDTH } }] : [];
  const result = await manipulateAsync(pickedUri, actions, { compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  if (isWeb) return { file: result.uri, width: result.width, height: result.height };

  const file = `${newId()}.jpg`;
  await new File(result.uri).copy(new File(photosDir(), file));
  // The shrunk copy in the cache is no longer needed.
  try {
    new File(result.uri).delete();
  } catch {
    // Cache files are cleaned up by the system anyway.
  }
  return { file, width: result.width, height: result.height };
}

/** Deletes a photo's file from the phone. Never throws: a missing file is fine. */
export function deletePhotoFile(file: string): void {
  if (isWeb) return;
  try {
    const f = new File(photosDir(), file);
    if (f.exists) f.delete();
  } catch {
    // Nothing useful to do if deleting fails.
  }
}
