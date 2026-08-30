/**
 * Comprehensive Arabic & Multilingual Search Normalization Utilities
 */

/**
 * Normalizes Arabic and English text for accurate, diacritic-insensitive search.
 */
export const normalizeArabic = (text: string | null | undefined): string => {
  if (text === null || text === undefined) return '';
  return String(text)
    .trim()
    .toLowerCase()
    // Remove Arabic diacritics (tashkeel)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize Alefs (أ, إ, آ, ٱ -> ا)
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize Taa Marbuta (ة -> ه)
    .replace(/ة/g, 'ه')
    // Normalize Yaa / Alef Maksura (ى -> ي)
    .replace(/ى/g, 'ي')
    // Normalize Persian/Urdu Yeh and Kaf if any
    .replace(/ي/g, 'ي')
    .replace(/ك/g, 'ك')
    // Remove extra whitespace
    .replace(/\s+/g, ' ');
};

/**
 * Universal search matcher: safe against null/undefined and supports multi-word search in Arabic & English.
 */
export const matchesSearch = (
  fields: (string | number | boolean | null | undefined)[],
  query: string | null | undefined
): boolean => {
  if (!query || !query.trim()) return true;
  const normalizedQuery = normalizeArabic(query);
  if (!normalizedQuery) return true;

  // Split query into tokens (e.g. "احمد علاقات" matches user "أحمد علي" in committee "العلاقات العامة")
  const tokens = normalizedQuery.split(' ').filter(Boolean);

  const combinedNormalizedText = fields
    .map(f => (f !== null && f !== undefined ? normalizeArabic(String(f)) : ''))
    .join(' ');

  // Every token from the query must match somewhere in the fields
  return tokens.every(token => combinedNormalizedText.includes(token));
};
