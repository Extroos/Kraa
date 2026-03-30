import { jsPDF } from 'jspdf';

/**
 * Dynamically loads an Arabic font (Almarai) from Google Fonts
 * and registers it with the jsPDF instance.
 * This ensures proper Arabic rendering without bloating the main bundle.
 */
export const loadArabicFont = async (doc: jsPDF) => {
  const FONT_URL = 'https://fonts.gstatic.com/s/almarai/v13/tsstA6px-m169idbbH-mX0Y.woff2';
  const CACHE_KEY = 'kra_arabic_font_base64';

  try {
    // 1. Check Cache first to save Quota/Bandwidth
    let fontBase64 = localStorage.getItem(CACHE_KEY);

    if (!fontBase64) {
      // 2. Fetch the font file as an ArrayBuffer
      const response = await fetch(FONT_URL);
      if (!response.ok) throw new Error('Font fetch failed');
      const buffer = await response.arrayBuffer();
      
      // 3. Convert ArrayBuffer to Base64
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      fontBase64 = btoa(binary);
      
      // 4. Store in LocalStorage for subsequent exports
      localStorage.setItem(CACHE_KEY, fontBase64);
    }

    // 5. Add the font to jsPDF
    // We use a virtual filename for the font
    doc.addFileToVFS('Almarai.ttf', fontBase64);
    doc.addFont('Almarai.ttf', 'Almarai', 'normal');
    return true;
  } catch (error) {
    console.error('Failed to load Arabic font:', error);
    return false;
  }
};
