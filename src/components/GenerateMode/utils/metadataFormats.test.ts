import { describe, expect, it } from 'vitest';
import {
  detectFormat,
  extractProducts,
  inferBrandFromName,
  languageCodeForColumn,
  longDescLangsFromHeaders,
  targetColumnFor,
  type ParsedSheet,
} from './metadataFormats';

const LONG = 'x'.repeat(130);
const SHORT_NOTE = 'Long descriptions is online, however not in Inriver';

describe('detectFormat', () => {
  it('recognises the AW26 compact sheet Masterdata sends for new SKUs', () => {
    expect(
      detectFormat(['Material Number', 'Brand', 'Material Description', 'Series USP', 'Style USP', 'Style Description'])
    ).toBe('aw26-compact');
  });

  it('is case-insensitive on headers', () => {
    expect(
      detectFormat(['material number', 'BRAND', 'Material description', 'series usp', 'STYLE USP', 'style description'])
    ).toBe('aw26-compact');
  });

  it('recognises the PIM long-description export', () => {
    expect(
      detectFormat(['Material Number', 'Material Description', 'Ecom Long Desc_en_GB', 'Ecom Long Desc_de_DE'])
    ).toBe('pim-longdesc');
  });

  it('recognises the Inriver rework export', () => {
    expect(
      detectFormat(['MaterialSAPMaterialNo', 'MaterialMaterialDescription_en', 'MaterialLongDescriptionEcom_en'])
    ).toBe('longdesc-rework');
  });

  it('recognises the sloggi and Triumph B2C standards', () => {
    expect(
      detectFormat([
        'MaterialSAPMaterialNo',
        'MaterialMaterialDescription_en',
        'MaterialBrand',
        'MaterialB2CSeriesDescription_en',
        'MaterialB2CStyleDescription_en',
        'MaterialB2CUSPs_en',
      ])
    ).toBe('sloggi-b2c');
    expect(
      detectFormat([
        'MaterialSAPMaterialNo',
        'MaterialMaterialDescription',
        'MaterialSeriesName',
        'MaterialBrand',
        'MaterialSubBrand',
        'MaterialB2CSeriesDescription_en',
        'MaterialB2CStyleDescription_en',
        'MaterialB2CUSPs_en',
      ])
    ).toBe('triumph-b2c');
  });

  it('returns unknown when a required header is missing', () => {
    expect(detectFormat(['Material Number', 'Brand', 'Series USP'])).toBe('unknown');
    expect(detectFormat([])).toBe('unknown');
  });
});

describe('extractProducts', () => {
  it('reads AW26 rows and drops rows with no usable marketing input', () => {
    const sheet: ParsedSheet = {
      name: 'AW26',
      headers: ['Material Number', 'Brand', 'Material Description', 'Series USP', 'Style USP', 'Style Description'],
      data: [
        { 'Material Number': '10226435', Brand: 'Triumph', 'Material Description': 'Comfort Allure WHP', 'Series USP': 'Elegance', 'Style USP': 'Comfort wire', 'Style Description': '' },
        { 'Material Number': '10226444', Brand: 'Triumph', 'Material Description': 'No inputs', 'Series USP': '', 'Style USP': '', 'Style Description': '' },
        { 'Material Number': '', Brand: 'Triumph', 'Material Description': 'No number', 'Series USP': 'x', 'Style USP': '', 'Style Description': '' },
      ],
    };
    const products = extractProducts('aw26-compact', [sheet]);
    expect(products.map((p) => p.materialNumber)).toEqual(['10226435']);
    expect(products[0].styleUsp).toBe('Comfort wire');
    expect(products[0].styleDescription).toBeUndefined();
  });

  it('picks the EN copy as rewrite source in a PIM export, falling back to another locale', () => {
    const sheet: ParsedSheet = {
      name: 'PIM',
      headers: ['Material Number', 'Material Description', 'Ecom Long Desc_en_GB', 'Ecom Long Desc_de_DE'],
      data: [
        { 'Material Number': '1', 'Material Description': 'sloggi ZERO Feel Brazilian', 'Ecom Long Desc_en_GB': LONG, 'Ecom Long Desc_de_DE': LONG },
        { 'Material Number': '2', 'Material Description': 'Triumph Amourette Bra', 'Ecom Long Desc_en_GB': SHORT_NOTE, 'Ecom Long Desc_de_DE': LONG },
        { 'Material Number': '3', 'Material Description': 'SLG Base Trunk', 'Ecom Long Desc_en_GB': '', 'Ecom Long Desc_de_DE': '' },
      ],
    };
    const products = extractProducts('pim-longdesc', [sheet]);
    expect(products).toHaveLength(3);
    expect(products[0].existingSourceLang).toBe('en');
    expect(products[0].brand).toBe('sloggi');
    expect(products[1].existingSourceLang).toBe('de');
    expect(products[1].brand).toBe('Triumph');
    expect(products[2].existingDescription).toBeUndefined();
    expect(products[2].brand).toBe('sloggi');
  });

  it('keeps every row of a rework export, using the product name when no copy exists', () => {
    const sheet: ParsedSheet = {
      name: 'Rework',
      headers: ['MaterialSAPMaterialNo', 'MaterialMaterialDescription_en', 'MaterialLongDescriptionEcom_en', 'MaterialLongDescriptionEcom_fr'],
      data: [
        { MaterialSAPMaterialNo: '9', MaterialMaterialDescription_en: 'sloggi GO Hipster', MaterialLongDescriptionEcom_en: '', MaterialLongDescriptionEcom_fr: LONG },
      ],
    };
    const [p] = extractProducts('longdesc-rework', [sheet]);
    expect(p.existingSourceLang).toBe('fr');
    expect(longDescLangsFromHeaders(sheet.headers)).toEqual(['en', 'fr']);
  });
});

describe('column helpers', () => {
  it('maps both column conventions to a language code', () => {
    expect(languageCodeForColumn('MaterialLongDescriptionEcom_de')).toBe('de');
    expect(languageCodeForColumn('Ecom Long Desc_pt_PT')).toBe('pt-PT');
    expect(languageCodeForColumn('Material Number')).toBeUndefined();
    expect(targetColumnFor('sv')).toBe('MaterialLongDescriptionEcom_sv');
  });

  it('infers sloggi from the SLG prefix and the brand word', () => {
    expect(inferBrandFromName('SLG Briefs')).toBe('sloggi');
    expect(inferBrandFromName('sloggi ZERO Feel')).toBe('sloggi');
    expect(inferBrandFromName('Amourette Charm')).toBe('Triumph');
  });
});
