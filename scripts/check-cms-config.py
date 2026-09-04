#!/usr/bin/env python3
"""Check the Sveltia CMS form matches the Zod schemas.

The schema in src/content.config.ts is the enforcement — the build fails without a
required field. public/admin/config.yml is only the form. If they drift, the panel
either asks for something the build ignores, or silently omits something the build
demands, and the author finds out from a failed deploy rather than from the form.

Run: python scripts/check-cms-config.py
Exits non-zero on a mismatch, so it can gate a build later.
"""

from __future__ import annotations

import io
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / 'src' / 'content.config.ts'
CMS = ROOT / 'public' / 'admin' / 'config.yml'

# Fields the schema defines but the form intentionally does not ask for.
# `body` is the markdown itself; Astro derives the slug from the filename.
CMS_ONLY = {'body'}
# Fields the schema defines and the form deliberately does not offer.
SCHEMA_ONLY: set[str] = {
    # US terms are a standing site rule, not a per-pattern decision.
    'terms',
}

# Required on every collection, deliberately — see CLAUDE.md.
SEO_REQUIRED = {'metaDescription', 'heroImageAlt', 'socialImage'}

# Collections whose required-ness is enforced at publish rather than at save, so that a
# half-filled draft can be saved. The panel marks nothing required; the schema refuses to
# build a non-draft entry that is missing anything.
DRAFT_GATED = {'reviews'}


def collection_block(src: str, collection: str) -> str:
    """The source of one `const <name> = defineCollection(...)` statement."""
    starts = {
        m.group(1): m.start()
        for m in re.finditer(r'const (\w+) = defineCollection\(', src)
    }
    start = starts[collection]
    later = [p for p in starts.values() if p > start]
    return src[start : min(later)] if later else src[start:]


def schema_fields(src: str, collection: str) -> set[str]:
    """Field names at the top level of a collection's z.object({...})."""
    block = collection_block(src, collection)
    # Match `.object({`, not `z.object({`: the reviews schema puts `z` and `.object({` on
    # separate lines so it can chain .superRefine(), and the joined form never matched.
    body = block[block.index('.object({') + len('.object({') :]

    names: set[str] = set()
    depth = 0  # depth relative to the inside of the top-level z.object
    for ch_i, line in enumerate(body.splitlines()):
        stripped = line.strip()
        if depth == 0 and not stripped.startswith('//') and not stripped.startswith('*'):
            # `name: value` and the shorthand `name,`. Without the second form a field
            # declared as a shared schema (`previewId,`) reads as missing, and the script
            # reports the form and the schema out of step when they agree.
            m = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)\s*(?::|,\s*$)', stripped)
            if m:
                names.add(m.group(1))
        depth += line.count('{') + line.count('(') + line.count('[')
        depth -= line.count('}') + line.count(')') + line.count(']')
        if depth < 0:  # closed the top-level object
            break
    return names


FLOW_ROW = re.compile(r'^\s*- \{ *(\w+): (.+?), *(\w+): (.+?) *\}\s*$')


def flow_mapping_losses() -> list[str]:
    """Hand-written `- { label: X, text: Y }` rows whose value contains a comma.

    That is a YAML *flow mapping*: the comma ends the entry, and everything after it
    parses as a further key with a null value, which Zod then strips as unknown. The text
    disappears with no error anywhere — a yarn quantity read "666 g in all" on the page
    when the file said "666 g in all, measured — 11 g per block".

    Entries written by the CMS are safe; Sveltia quotes what it writes. This only catches
    files edited by hand, which is exactly where it happened.
    """
    found: list[str] = []
    for folder in (ROOT / 'src' / 'content').iterdir():
        if not folder.is_dir():
            continue
        for f in sorted(folder.glob('*.md*')):
            for n, line in enumerate(io.open(f, encoding='utf-8'), 1):
                m = FLOW_ROW.match(line)
                if m and ',' in m.group(4):
                    found.append(f'{folder.name}/{f.name}:{n} — "{m.group(4)[:48]}…"')
    return found


def main() -> int:
    src = SCHEMA.read_text(encoding='utf-8')
    cfg = yaml.safe_load(CMS.read_text(encoding='utf-8'))

    # The shared seoFields spread is not literal in either collection block.
    shared = SEO_REQUIRED

    failures: list[str] = []

    for coll in cfg['collections']:
        name = coll['name']
        form = {f['name'] for f in coll['fields']}
        schema = schema_fields(src, name) | shared

        missing_in_form = schema - form - SCHEMA_ONLY
        extra_in_form = form - schema - CMS_ONLY

        if missing_in_form:
            failures.append(
                f'{name}: in the schema but not in the CMS form: {sorted(missing_in_form)}'
            )
        if extra_in_form:
            failures.append(
                f'{name}: in the CMS form but not in the schema: {sorted(extra_in_form)}'
            )

        # The SEO fields must be marked required in the form, so the panel asks at write
        # time instead of the build failing later.
        #
        # Reviews are exempt: there the same fields are required *to publish* and not to
        # save, enforced by a superRefine on `draft`. Marking them required in the panel
        # would block saving a half-written draft, which is the whole point of the
        # exemption. See the reviews schema in src/content.config.ts.
        if name not in DRAFT_GATED:
            not_required = [
                f['name']
                for f in coll['fields']
                if f['name'] in SEO_REQUIRED and f.get('required') is not True
            ]
            if not_required:
                failures.append(f'{name}: SEO fields not marked required in the form: {not_required}')

        # Every entry file must match the extension the collection declares.
        #
        # Sveltia lists only files with the declared extension, but Astro's glob loader
        # takes both .md and .mdx — so a mismatched file builds, renders and is live, and
        # is simply absent from /admin. Three entries were invisible this way, including
        # two whole patterns, and nothing reported it: the author just saw fewer entries
        # than she had written.
        ext = coll.get('extension')
        folder = ROOT / coll['folder']
        if ext and folder.is_dir():
            wrong = sorted(
                f.name for f in folder.iterdir()
                if f.suffix in {'.md', '.mdx'} and f.suffix != f'.{ext}'
            )
            if wrong:
                failures.append(
                    f'{name}: files the CMS cannot see — collection declares .{ext}: {wrong}'
                )

        print(f'{name:9} form={len(form):3} schema={len(schema):3}  ok' if not failures else f'{name}: checked')

    lost = flow_mapping_losses()
    if lost:
        failures.append(
            'content rows losing text to a comma inside { }: '
            + '; '.join(lost)
            + ' — rewrite these as block mappings with quoted values'
        )

    if failures:
        print('\nMISMATCH:')
        for f in failures:
            print('  -', f)
        return 1

    print('\nCMS form and Zod schemas agree.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
