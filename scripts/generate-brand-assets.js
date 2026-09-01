import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
const svgPath = path.join(publicDir, 'play369-logo.svg');

async function buildAssets() {
  console.log('Rendering high-resolution PLAY369 brand assets from SVG...');
  const svgBuffer = fs.readFileSync(svgPath);

  // 1. Master 512x512 Logo PNG
  await sharp(svgBuffer)
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'play369-logo.png'));
  console.log('✔ Generated play369-logo.png (512x512)');

  // 2. PWA Icon 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('✔ Generated icon-512.png (512x512)');

  // 3. PWA Icon 192x192
  await sharp(svgBuffer)
    .resize(192, 192)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('✔ Generated icon-192.png (192x192)');

  // 4. Apple Touch Icon 180x180
  await sharp(svgBuffer)
    .resize(180, 180)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✔ Generated apple-touch-icon.png (180x180)');

  // 5. Favicon PNG 64x64
  await sharp(svgBuffer)
    .resize(64, 64)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('✔ Generated favicon.png (64x64)');

  // 6. 1200x630 Open Graph / Search Preview Banner
  const logo500 = await sharp(svgBuffer).resize(480, 480).png().toBuffer();
  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 2, g: 24, b: 14, alpha: 1 }
    }
  })
    .composite([
      {
        input: logo500,
        top: 75,
        left: 360
      }
    ])
    .png({ quality: 95 })
    .toFile(path.join(publicDir, 'play369-og-banner.png'));
  console.log('✔ Generated play369-og-banner.png (1200x630)');

  console.log('All PLAY369 brand image assets generated successfully!');
}

buildAssets().catch((err) => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
