import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const STORAGE_PREFIX = 'cheque_image_';
const IMAGE_DIR = Directory.Data;

/**
 * Stores a base64 cheque image locally on the device's filesystem.
 * This prevents UI freezes (ANR) caused by large SharedPreferences entries.
 */
export const storeLocalChequeImage = async (paymentId: string, base64Data: string): Promise<void> => {
    try {
        await Filesystem.writeFile({
            path: `${STORAGE_PREFIX}${paymentId}.txt`,
            data: base64Data,
            directory: IMAGE_DIR,
            encoding: Encoding.UTF8,
            recursive: true
        });
        
        // Clean up old Preferences entry if it exists to save space
        await Preferences.remove({ key: `${STORAGE_PREFIX}${paymentId}` });
    } catch (error) {
        console.error('Error storing local cheque image to filesystem:', error);
    }
};

/**
 * Retrieves a locally stored base64 cheque image.
 * Includes a migration layer to move data from Preferences to Filesystem.
 */
export const getLocalChequeImage = async (paymentId: string): Promise<string | null> => {
    const fileName = `${STORAGE_PREFIX}${paymentId}.txt`;
    
    try {
        // 1. Try Filesystem first (New strategy)
        const result = await Filesystem.readFile({
            path: fileName,
            directory: IMAGE_DIR,
            encoding: Encoding.UTF8
        });
        return result.data as string;
    } catch (fsError: any) {
        // If file not found, check old Preferences (Migration strategy)
        try {
            const { value } = await Preferences.get({
                key: `${STORAGE_PREFIX}${paymentId}`
            });
            
            if (value) {
                console.log(`Migrating cheque image for ${paymentId} to filesystem...`);
                await storeLocalChequeImage(paymentId, value);
                return value;
            }
        } catch (prefError) {
            console.error('Migration error for local cheque image:', prefError);
        }
        
        return null;
    }
};

/**
 * Removes a locally stored cheque image from both locations.
 */
export const removeLocalChequeImage = async (paymentId: string): Promise<void> => {
    try {
        // Remove from Filesystem
        await Filesystem.deleteFile({
            path: `${STORAGE_PREFIX}${paymentId}.txt`,
            directory: IMAGE_DIR
        }).catch(() => {}); // Ignore if already gone
        
        // Remove from Preferences
        await Preferences.remove({
            key: `${STORAGE_PREFIX}${paymentId}`
        });
    } catch (error) {
        console.error('Error removing local cheque image:', error);
    }
};

/**
 * Checks if the current environment is a native mobile platform.
 */
export const isNativeMobile = (): boolean => {
    const isCapacitorNative = (window as any).Capacitor?.isNativePlatform() === true || 
                             ((window as any).Capacitor?.getPlatform() && (window as any).Capacitor?.getPlatform() !== 'web');
    
    const isMobileBrowser = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    return isCapacitorNative || isMobileBrowser;
};
