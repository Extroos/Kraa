import { storage } from '../firebase';
import { ref, listAll, deleteObject } from 'firebase/storage';

/**
 * Recursively deletes a folder and all its contents from Firebase Storage.
 * Use with caution.
 */
export const deleteStorageFolder = async (path: string) => {
  try {
    const folderRef = ref(storage, path);
    const list = await listAll(folderRef);
    
    // Delete all files in this folder
    const filePromises = list.items.map(item => deleteObject(item));
    await Promise.all(filePromises);
    
    // Recursively delete subfolders
    const folderPromises = list.prefixes.map(prefix => deleteStorageFolder(prefix.fullPath));
    await Promise.all(folderPromises);
    
    return true;
  } catch (error) {
    console.error(`Failed to delete storage folder at path: ${path}`, error);
    return false;
  }
};

/**
 * Specifically cleans up property-related assets.
 */
export const cleanupPropertyAssets = async (propertyId: string) => {
  return await deleteStorageFolder(`properties/${propertyId}`);
};
