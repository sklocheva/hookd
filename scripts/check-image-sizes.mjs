#!/usr/bin/env node
/**
 * Nothing above 2000px on the long edge gets committed.
 *
 * That was a rule on paper. Git keeps every version of every binary forever, so a 6000px
 * phone photo committed once is in the repository for good, even after it is replaced.
 * Uploads through /admin were already safe — Sveltia resizes in the browser before it
 * commits anything (`media_libraries` in public/admin/config.yml) — but a file dropped
 * into src/assets/ by hand, or pasted into public/, went through nothing at all.
 *
 * Reads only each file's header, so it is fast and needs no dependencies: PNG, JPEG,
 * WebP and GIF, which is everything the site uses. SVG is vector and has no pixel size.
 * A raster file it cannot measure is reported but does not fail the run — a format this
 * does not understand is not evidence that the file is too big.
 *
 * Run: node scripts/check-image-sizes.mjs
 * Exits non-zero if any image is over the limit, so it gates CI.
 */
import { readdirSync, openSync, readSync, closeSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX = 2000;
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIRS = ['src', 'public'];
const RASTER = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);

/** The first 64 KB is always enough to reach the size, even past JPEG's EXIF block. */
function head(path) {
	const buf = Buffer.alloc(64 * 1024);
	const fd = openSync(path, 'r');
	const n = readSync(fd, buf, 0, buf.length, 0);
	closeSync(fd);
	return buf.subarray(0, n);
}

/** [width, height], or null when the format is not one this can read. */
function size(b) {
	// PNG: the IHDR chunk is always first.
	if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) {
		return [b.readUInt32BE(16), b.readUInt32BE(20)];
	}

	// GIF: logical screen size, little-endian.
	if (b.length >= 10 && b.toString('ascii', 0, 3) === 'GIF') {
		return [b.readUInt16LE(6), b.readUInt16LE(8)];
	}

	// WebP: three encodings, each storing the size differently.
	if (b.length >= 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
		const chunk = b.toString('ascii', 12, 16);
		if (chunk === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
		if (chunk === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
		if (chunk === 'VP8L') {
			const bits = b.readUInt32LE(21);
			return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
		}
		return null;
	}

	// JPEG: walk the markers to the first start-of-frame. C4, C8 and CC share the SOF
	// range but are not frames (Huffman tables, a reserved code, arithmetic coding).
	if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
		let i = 2;
		while (i + 9 < b.length) {
			if (b[i] !== 0xff) return null;
			const marker = b[i + 1];
			if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
				return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
			}
			i += 2 + b.readUInt16BE(i + 2);
		}
		return null;
	}

	return null;
}

function* walk(dir) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* walk(p);
		else if (RASTER.has(extname(e.name).toLowerCase())) yield p;
	}
}

const tooBig = [];
const unread = [];
let checked = 0;

for (const dir of DIRS) {
	let files;
	try {
		files = [...walk(join(ROOT, dir))];
	} catch {
		continue; // directory absent
	}
	for (const path of files) {
		const rel = relative(ROOT, path).replaceAll('\\', '/');
		const dims = size(head(path));
		if (!dims) {
			unread.push(rel);
			continue;
		}
		checked++;
		const [w, h] = dims;
		if (Math.max(w, h) > MAX) tooBig.push(`${rel} — ${w} × ${h}`);
	}
}

console.log(`${checked} image(s) measured, long edge limit ${MAX}px`);

if (unread.length) {
	console.log(`\nCould not read the size of ${unread.length} file(s) — not failing on these:`);
	for (const f of unread) console.log(`  ? ${f}`);
}

if (tooBig.length) {
	console.log(`\nOVER ${MAX}px on the long edge:`);
	for (const f of tooBig) console.log(`  - ${f}`);
	console.log(
		'\nResize before committing — git keeps every version of a binary forever, so an\n' +
			'oversized original stays in the repository even after it is replaced.'
	);
	process.exit(1);
}

console.log('All within the limit.');
