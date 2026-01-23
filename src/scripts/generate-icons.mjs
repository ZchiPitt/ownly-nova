import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const iconsDir = join(__dirname, '../public/icons');

// Ensure icons directory exists
await mkdir(iconsDir, { recursive: true });

// SVG icon design - a box/inventory icon with AI sparkle
const createSvg = (size, isMaskable = false) => {
  const padding = isMaskable ? size * 0.1 : 0; // 10% safe zone for maskable
  const innerSize = size - (padding * 2);
  const scale = innerSize / 320;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3B82F6"/>
      <stop offset="100%" style="stop-color:#1D4ED8"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="${size}" height="${size}" ${isMaskable ? '' : `rx="${size * 0.125}"`} fill="url(#bgGradient)"/>
  <!-- Box icon -->
  <g transform="translate(${padding + innerSize * 0.15}, ${padding + innerSize * 0.15}) scale(${scale})">
    <!-- Main box body -->
    <path d="M30 75 L120 30 L210 75 L210 165 L120 210 L30 165 Z"
          fill="#FFFFFF" fill-opacity="0.95"/>
    <!-- Box lid top -->
    <path d="M30 75 L120 30 L210 75 L120 120 Z"
          fill="#FFFFFF"/>
    <!-- Box left side shadow -->
    <path d="M30 75 L120 120 L120 210 L30 165 Z"
          fill="#E5E7EB"/>
    <!-- Box right side -->
    <path d="M120 120 L210 75 L210 165 L120 210 Z"
          fill="#F3F4F6"/>
    <!-- Center line on lid -->
    <line x1="120" y1="30" x2="120" y2="120" stroke="#3B82F6" stroke-width="3"/>
    <!-- Sparkle/AI indicator -->
    <circle cx="175" cy="55" r="15" fill="#FCD34D"/>
    <path d="M175 43 L177 51 L185 53 L177 55 L175 63 L173 55 L165 53 L173 51 Z"
          fill="#FFFFFF"/>
  </g>
</svg>`;
};

// Generate icons
const icons = [
  { size: 192, name: 'icon-192x192.png', maskable: false },
  { size: 512, name: 'icon-512x512.png', maskable: false },
  { size: 192, name: 'icon-192x192-maskable.png', maskable: true },
  { size: 512, name: 'icon-512x512-maskable.png', maskable: true },
];

for (const { size, name, maskable } of icons) {
  const svg = createSvg(size, maskable);
  const outputPath = join(iconsDir, name);

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);

  console.log(`Generated: ${name}`);
}

// Also create a favicon
const faviconSvg = createSvg(32, false);
await sharp(Buffer.from(faviconSvg))
  .png()
  .toFile(join(iconsDir, 'favicon.png'));
console.log('Generated: favicon.png');

// Create an ICO-compatible favicon (32x32)
await sharp(Buffer.from(faviconSvg))
  .resize(32, 32)
  .toFile(join(__dirname, '../public/favicon.ico'));
console.log('Generated: favicon.ico');

// Also create apple-touch-icon
const appleTouchSvg = createSvg(180, false);
await sharp(Buffer.from(appleTouchSvg))
  .png()
  .toFile(join(iconsDir, 'apple-touch-icon.png'));
console.log('Generated: apple-touch-icon.png');

console.log('\nAll icons generated successfully!');
