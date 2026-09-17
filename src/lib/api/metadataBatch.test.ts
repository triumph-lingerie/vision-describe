import { describe, expect, it } from 'vitest';
import { enCustomId, locCustomId, parseMetadataCustomId } from './metadataBatch';

describe('metadata batch custom ids', () => {
  it('round-trips EN and localisation ids, including hyphenated locales', () => {
    expect(parseMetadataCustomId(enCustomId(7))).toEqual({ queueIndex: 7, kind: 'en' });
    expect(parseMetadataCustomId(locCustomId(215, 'pt-PT'))).toEqual({
      queueIndex: 215,
      kind: 'loc',
      lang: 'pt-PT',
    });
    expect(parseMetadataCustomId(locCustomId(0, 'de'))).toEqual({ queueIndex: 0, kind: 'loc', lang: 'de' });
  });

  it('rejects ids from other flows', () => {
    expect(parseMetadataCustomId('row-3-lang-de')).toBeNull();
    expect(parseMetadataCustomId('p-en')).toBeNull();
  });
});
