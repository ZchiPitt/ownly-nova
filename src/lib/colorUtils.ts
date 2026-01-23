export const COLOR_MAP: Record<string, string> = {
  red: '#EF4444',
  blue: '#3B82F6',
  green: '#22C55E',
  yellow: '#EAB308',
  orange: '#F97316',
  purple: '#A855F7',
  pink: '#EC4899',
  brown: '#A16207',
  black: '#111827',
  white: '#F9FAFB',
  gray: '#6B7280',
  grey: '#6B7280',
  teal: '#14B8A6',
  cyan: '#06B6D4',
  lime: '#84CC16',
  indigo: '#6366F1',
  violet: '#8B5CF6',
  magenta: '#D946EF',
  maroon: '#7F1D1D',
  navy: '#1E3A8A',
  'navy blue': '#1E3A8A',
  beige: '#F5F5DC',
  tan: '#D2B48C',
  gold: '#F59E0B',
  silver: '#9CA3AF',
  turquoise: '#14B8A6',
  olive: '#6B8E23',
};

const COLOR_KEYS = Object.keys(COLOR_MAP).sort((a, b) => b.length - a.length);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Returns hex color if tag is a color word, null otherwise
export function getColorHex(tag: string): string | null {
  const normalized = tag.toLowerCase();

  for (const key of COLOR_KEYS) {
    const pattern = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'i');
    if (pattern.test(normalized)) {
      return COLOR_MAP[key];
    }
  }

  return null;
}

// Check if tag contains color word
export function isColorTag(tag: string): boolean {
  return getColorHex(tag) !== null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6 && normalized.length !== 3) {
    return null;
  }

  const fullHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  const value = Number.parseInt(fullHex, 16);
  if (Number.isNaN(value)) return null;

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function getColorTint(hex: string, alpha: number = 0.12): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const safeAlpha = Math.max(0, Math.min(alpha, 1));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha})`;
}

export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const luminance =
    (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.78;
}
