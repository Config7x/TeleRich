import test from 'node:test';
import assert from 'node:assert/strict';
import {
  strip,
  variants,
  harvest,
  mergeMaps,
  premiumize,
  SEED_PACKS
} from '../worker/emoji_engine.js';

test('strip removes U+FE0F (VS16)', () => {
  assert.equal(strip('⚡️'), '⚡');
  assert.equal(strip('⚡'), '⚡');
  assert.equal(strip('🍉'), '🍉');
  assert.equal(strip('⚡️🍉️'), '⚡🍉');
  assert.equal(strip(null), '');
  assert.equal(strip(undefined), '');
});

test('variants returns bare, VS16 and original variations without duplicates', () => {
  assert.deepEqual(variants('⚡'), ['⚡', '⚡️']);
  assert.deepEqual(variants('⚡️'), ['⚡', '⚡️']);
  assert.deepEqual(variants('🍉'), ['🍉', '🍉️']);
});

test('harvest extracts custom_emoji entities handling UTF-16 offsets and surrogate pairs', () => {
  // "Hi 🍉 world ⚡️"
  // "Hi " length 3
  // "🍉" surrogate pair: UTF-16 offset 3, length 2
  // " world " length 7 (indices 5..11)
  // "⚡️" length 2 (indices 12..13)
  const text = 'Hi 🍉 world ⚡️';
  const entities = [
    { type: 'custom_emoji', custom_emoji_id: '5001', offset: 3, length: 2 },
    { type: 'custom_emoji', custom_emoji_id: '5002', offset: 12, length: 2 }
  ];

  const harvested = harvest(text, entities);
  assert.equal(harvested.length, 2);
  assert.deepEqual(harvested[0], { char: '🍉', id: '5001' });
  assert.deepEqual(harvested[1], { char: '⚡️', id: '5002' });

  // Edge cases
  assert.deepEqual(harvest(text, []), []);
  assert.deepEqual(harvest('', entities), []);
  assert.deepEqual(harvest(null, null), []);
});

test('mergeMaps builds map from stored packs with first pack winning', () => {
  const packs = [
    {
      name: 'pack1',
      title: 'Pack One',
      emojis: [
        { id: '101', char: '🍉' },
        { id: '102', char: '⚡' }
      ]
    },
    {
      name: 'pack2',
      title: 'Pack Two',
      emojis: [
        { id: '201', char: '⚡' }, // Conflict: pack 1 should win
        { id: '202', char: '🔥' }
      ]
    }
  ];

  const map = mergeMaps(packs);
  assert.ok(map instanceof Map);
  assert.equal(map.get('🍉'), '101');
  assert.equal(map.get('⚡'), '102');
  assert.equal(map.get('⚡️'), '102'); // VS16 variant included
  assert.equal(map.get('🔥'), '202');

  // Empty or invalid input
  assert.equal(mergeMaps([]).size, 0);
  assert.equal(mergeMaps(null).size, 0);
});

test('premiumize replaces plain emoji in HTML text nodes', () => {
  const map = new Map([
    ['🍉', '1001'],
    ['⚡', '1002']
  ]);

  const html = '<b>Hello 🍉!</b> Fast ⚡️ post.';
  const expected = '<b>Hello <tg-emoji emoji-id="1001">🍉</tg-emoji>!</b> Fast <tg-emoji emoji-id="1002">⚡️</tg-emoji> post.';
  assert.equal(premiumize(html, map), expected);
});

test('premiumize tolerant of VS16 variants (input vs map)', () => {
  // Map has bare emoji '⚡', input has '⚡️' (VS16)
  const mapBare = new Map([['⚡', '999']]);
  assert.equal(
    premiumize('Power ⚡️!', mapBare),
    'Power <tg-emoji emoji-id="999">⚡️</tg-emoji>!'
  );

  // Map has VS16 emoji '⚡️', input has bare '⚡'
  const mapVs16 = new Map([['⚡️', '888']]);
  assert.equal(
    premiumize('Power ⚡!', mapVs16),
    'Power <tg-emoji emoji-id="888">⚡</tg-emoji>!'
  );
});

test('premiumize does NOT replace emoji inside <code> and <pre>', () => {
  const map = new Map([['🍉', '1001']]);
  const html = '🍉 <code>code 🍉</code> and <pre>pre 🍉</pre> 🍉';
  const expected = '<tg-emoji emoji-id="1001">🍉</tg-emoji> <code>code 🍉</code> and <pre>pre 🍉</pre> <tg-emoji emoji-id="1001">🍉</tg-emoji>';
  assert.equal(premiumize(html, map), expected);
});

test('premiumize does NOT replace emoji inside HTML tags and attributes', () => {
  const map = new Map([['🍉', '1001']]);
  const html = '<a href="https://t.me/🍉" title="🍉">Link 🍉</a>';
  const expected = '<a href="https://t.me/🍉" title="🍉">Link <tg-emoji emoji-id="1001">🍉</tg-emoji></a>';
  assert.equal(premiumize(html, map), expected);
});

test('premiumize does NOT replace emoji already inside <tg-emoji>', () => {
  const map = new Map([['🍉', '1001']]);
  const html = '<tg-emoji emoji-id="555">🍉</tg-emoji> and 🍉';
  const expected = '<tg-emoji emoji-id="555">🍉</tg-emoji> and <tg-emoji emoji-id="1001">🍉</tg-emoji>';
  assert.equal(premiumize(html, map), expected);
});

test('premiumize leaves unknown emoji untouched', () => {
  const map = new Map([['🍉', '1001']]);
  const html = '🍉 and 🍕';
  const expected = '<tg-emoji emoji-id="1001">🍉</tg-emoji> and 🍕';
  assert.equal(premiumize(html, map), expected);
});

test('premiumize handles empty map or plain Object map', () => {
  const html = 'Hello 🍉!';
  assert.equal(premiumize(html, new Map()), html);
  assert.equal(premiumize(html, {}), html);
  assert.equal(premiumize(html, null), html);

  // Plain object map
  const objMap = { '🍉': '777' };
  assert.equal(premiumize(html, objMap), 'Hello <tg-emoji emoji-id="777">🍉</tg-emoji>!');
});

test('SEED_PACKS is exported with at least 8 public emoji pack short names', () => {
  assert.ok(Array.isArray(SEED_PACKS));
  assert.ok(SEED_PACKS.length >= 8);
  for (const name of SEED_PACKS) {
    assert.equal(typeof name, 'string');
    assert.ok(name.length > 0);
  }
});
