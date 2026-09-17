import { describe, expect, it } from 'vitest';
import { checkEnglishStyle, checkLocalisedStyle, checkStructure, stripTags, wordCount } from './styleGuard';

const bullets = (n: number) =>
  Array.from({ length: n }, (_, i) => `<li>Bullet number ${i + 1} with a concrete detail about the fabric</li>`).join('');

const filler = Array.from({ length: 14 }, (_, i) => `sentence number ${i + 1} adds a plain factual detail about the fit.`).join(' ');

const CLEAN = `<p>For everyday support that stays invisible under fitted clothing, this padded bra shapes without showing through. ${filler}</p><ul class="pd">${bullets(6)}</ul><p>Part of the series made for second-skin comfort, from morning to night.</p>`;

describe('styleGuard', () => {
  it('passes a clean description', () => {
    expect(checkEnglishStyle(CLEAN)).toEqual([]);
  });

  it('flags a greeting opener', () => {
    const html = CLEAN.replace('For everyday support', 'Meet the everyday support');
    expect(checkEnglishStyle(html).map((w) => w.code)).toContain('greeting-opener');
  });

  it('flags banned words, case-insensitively', () => {
    const html = CLEAN.replace('shapes without showing through', 'Elevates your look and unlocks comfort');
    const codes = checkEnglishStyle(html);
    const banned = codes.find((w) => w.code === 'banned-word');
    expect(banned?.message).toMatch(/elevate/);
    expect(banned?.message).toMatch(/unlock/);
  });

  it('allows one em dash and flags two', () => {
    const one = CLEAN.replace('without showing through', 'without showing through — ever');
    expect(checkStructure(one).map((w) => w.code)).not.toContain('em-dash');
    const two = one.replace('second-skin comfort', 'second-skin comfort — always');
    expect(checkStructure(two).map((w) => w.code)).toContain('em-dash');
  });

  it('flags a wrong bullet count and unexpected tags', () => {
    const html = `<p>Opening paragraph that says why. ${filler}</p><ul class="pd">${bullets(3)}</ul><p>Closing <strong>bold</strong>.</p>`;
    const codes = checkStructure(html).map((w) => w.code);
    expect(codes).toContain('structure');
    expect(codes).toContain('tags');
  });

  it('flags length outside 150-300 words', () => {
    const short = `<p>Short opener.</p><ul class="pd">${bullets(5)}</ul><p>Closing.</p>`;
    expect(checkEnglishStyle(short).map((w) => w.code)).toContain('length');
  });

  it('compares a localisation against the EN master bullet count', () => {
    const loc = `<p>Apertura.</p><ul class="pd">${bullets(5)}</ul><p>Chiusura.</p>`;
    const warnings = checkLocalisedStyle(loc, CLEAN);
    expect(warnings.some((w) => /EN master has 6/.test(w.message))).toBe(true);
  });

  it('strips tags and counts words', () => {
    expect(stripTags('<p>a  b</p><ul><li>c</li></ul>')).toBe('a b c');
    expect(wordCount('one two  three')).toBe(3);
    expect(wordCount('')).toBe(0);
  });
});
