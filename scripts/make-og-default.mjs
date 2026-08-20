/**
 * Generates the default social share card: public/og-default.png.
 *
 * Every page needs an og:image or shares and pins render blank, but there is no
 * photography yet. A branded card is the honest answer — it is not a fake photo, it is
 * the site's name, and it is what most publishers fall back to for pages without a lead
 * image anyway. Individual entries override it once real photos exist.
 *
 * Run: node scripts/make-og-default.mjs
 * Re-run after changing the wordmark or palette. The output is committed.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const W = 1200;
const H = 630; // The ratio Facebook, X, LinkedIn and Pinterest all read comfortably.

const PAPER = '#fbf6ef';
const INK = '#2a2320';
const MUTED = '#7a6d63';
const TERRACOTTA = '#b1603f';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>

  <!-- A quiet stitch motif, kept far from the text so it never competes with it. -->
  <g fill="none" stroke="${INK}" stroke-opacity="0.07" stroke-width="9" stroke-linecap="round">
    ${Array.from({ length: 3 }, (_, row) =>
			Array.from({ length: 10 }, (_, col) => {
				const x = 60 + col * 120;
				const y = 60 + row * 78;
				return `<path d="M ${x} ${y} q 30 -44 60 0 q -30 44 -60 0 z"/>`;
			}).join('')
		).join('')}
  </g>

  <text x="${W / 2}" y="330" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-style="italic"
        font-size="132" fill="${INK}" letter-spacing="-3">Hookd</text>

  <rect x="${W / 2 - 60}" y="378" width="120" height="3" fill="${TERRACOTTA}"/>

  <text x="${W / 2}" y="440" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif" font-size="27" fill="${MUTED}"
        letter-spacing="1">Free crochet patterns, written out in full</text>

  <text x="${W / 2}" y="484" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif" font-size="27" fill="${MUTED}"
        letter-spacing="1">and write-ups of yarn, fibre and stitch tests</text>
</svg>`;

await mkdir(new URL('../public/', import.meta.url), { recursive: true });
const out = fileURLToPath(new URL('../public/og-default.png', import.meta.url));

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);

const meta = await sharp(out).metadata();
console.log(`wrote public/og-default.png — ${meta.width}x${meta.height}`);
