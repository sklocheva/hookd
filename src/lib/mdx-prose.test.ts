/**
 * What a brace typed into an article becomes, as tests.
 *
 * An author typing in /admin is typing text. Every case here is something she could
 * plausibly type, or something a hand-written entry already contains and must keep.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeProse } from './mdx-prose.mjs';

const entry = (body: string) => `---\ntitle: A post\n---\n${body}`;
const bodyOf = (out: string) => out.slice(entry('').length);

test('a brace in prose becomes a literal brace', () => {
	assert.equal(bodyOf(escapeProse(entry('Ch {neckCh} to start.'))), 'Ch \\{neckCh\\} to start.');
});

test('a less-than sign before a figure is text, not a tag', () => {
	assert.equal(bodyOf(escapeProse(entry('Under <20 cm, and I <3 it.'))), 'Under \\<20 cm, and I \\<3 it.');
});

test('a less-than sign with a space after it is escaped too, harmlessly', () => {
	assert.equal(bodyOf(escapeProse(entry('a < b'))), 'a \\< b');
});

test('frontmatter is never touched — {key} there belongs to the size picker', () => {
	const source = '---\ntext: "Ch {neckCh}"\n---\nBody {x}\n';
	assert.equal(escapeProse(source), '---\ntext: "Ch {neckCh}"\n---\nBody \\{x\\}\n');
});

test('a file with no frontmatter is all body', () => {
	assert.equal(escapeProse('Just {this}'), 'Just \\{this\\}');
});

test('an import line is left alone', () => {
	const line = "import Row from '../../components/Row.astro';";
	assert.equal(bodyOf(escapeProse(entry(line))), line);
});

test('a line that opens a component keeps its attribute braces', () => {
	const line = `<Row label="Row 1" side="RS" counts={{ XS: 62, M: 79, '3X': 115 }}>`;
	assert.equal(bodyOf(escapeProse(entry(line))), line);
});

test('a self-closing component is left alone', () => {
	const line = '<QuizCallout slug="frog-it-or-leave-it" />';
	assert.equal(bodyOf(escapeProse(entry(line))), line);
});

test('prose between component lines is still escaped', () => {
	const body = '<Row label="Row 1">\n  Ch 2 {see note}, turn.\n</Row>';
	assert.equal(
		bodyOf(escapeProse(entry(body))),
		'<Row label="Row 1">\n  Ch 2 \\{see note\\}, turn.\n</Row>'
	);
});

test('lowercase HTML is left as HTML', () => {
	const line = 'One line<br />and the next, with <em>stress</em>.';
	assert.equal(bodyOf(escapeProse(entry(line))), line);
});

test('inline code keeps its braces, the text around it does not', () => {
	assert.equal(
		bodyOf(escapeProse(entry('Write `{neckCh}` not {neckCh}.'))),
		'Write `{neckCh}` not \\{neckCh\\}.'
	);
});

test('a fenced block is left alone, and prose after it is not', () => {
	const body = '```\n{ a: 1 } < 2\n```\nafter {this}';
	assert.equal(bodyOf(escapeProse(entry(body))), '```\n{ a: 1 } < 2\n```\nafter \\{this\\}');
});

test('a tilde fence is not closed by backticks inside it', () => {
	const body = '~~~\n```\n{still code}\n~~~\n{prose}';
	assert.equal(bodyOf(escapeProse(entry(body))), '~~~\n```\n{still code}\n~~~\n\\{prose\\}');
});

test('what is already escaped is not escaped twice', () => {
	assert.equal(bodyOf(escapeProse(entry('Already \\{done\\} and \\<3.'))), 'Already \\{done\\} and \\<3.');
});

test('Windows line endings survive', () => {
	const source = '---\r\ntitle: A\r\n---\r\nOne {a}\r\nTwo {b}\r\n';
	assert.equal(escapeProse(source), '---\r\ntitle: A\r\n---\r\nOne \\{a\\}\r\nTwo \\{b\\}\r\n');
});

test('every entry in the repo that needs no escaping comes back unchanged', () => {
	const plain = entry('## A heading\n\nPlain prose, with a [link](/journal/) and **bold**.\n\n- a list\n');
	assert.equal(escapeProse(plain), plain);
});
