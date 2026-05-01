import { PROVINCES, normalizeProvince, normalizeDistrict } from './provinces';
import { latinToCyrillic } from './translit';

export interface ExtractedSlots {
  productCode?: string;
  quantity?: number;
  phone?: string;
  extraPhone?: string;
  province?: string;
  district?: string;
  address?: string;
  remainingText: string;
}

const DIGIT_RE = /\d+/g;
const PRODUCT_PREFIX_RE = /([pPcCрРсС])[-]?(\d{1,5})/g;

function padCode(num: string): string {
  return num.padStart(4, '0');
}

export function extractSlots(text: string, opts: { productSelected: boolean; wantPhone: boolean }): ExtractedSlots {
  const result: ExtractedSlots = { remainingText: text };
  let working = text;
  const normalized = latinToCyrillic(working);

  const prefixedCodes: string[] = [];
  let m: RegExpExecArray | null;
  const prefixRe = new RegExp(PRODUCT_PREFIX_RE.source, 'g');
  while ((m = prefixRe.exec(normalized))) {
    const letter = m[1].toLowerCase();
    const cyrToLat: Record<string, string> = { 'р': 'P', 'с': 'C', 'p': 'P', 'c': 'C' };
    const L = cyrToLat[letter] || letter.toUpperCase();
    prefixedCodes.push(`${L}-${padCode(m[2])}`);
  }

  const digitTokens: { value: string; index: number }[] = [];
  const tokenRe = /\d+/g;
  while ((m = tokenRe.exec(working))) {
    digitTokens.push({ value: m[0], index: m.index });
  }

  let phoneToken: { value: string; index: number } | null = null;
  let extraPhoneToken: { value: string; index: number } | null = null;
  const phoneCandidates = digitTokens.filter((d) => d.value.length === 8 && /^[789]/.test(d.value));
  if (phoneCandidates.length > 0) {
    phoneToken = phoneCandidates[0];
    result.phone = phoneToken.value;
    if (phoneCandidates.length > 1) {
      extraPhoneToken = phoneCandidates[1];
      result.extraPhone = extraPhoneToken.value;
    }
  }

  let productCode: string | null = null;
  if (prefixedCodes.length > 0) {
    productCode = prefixedCodes[0];
  } else {
    const nonPhoneDigits = digitTokens.filter(
      (d) => d !== phoneToken && d !== extraPhoneToken && d.value.length >= 3 && d.value.length <= 5,
    );
    if (nonPhoneDigits.length > 0 && !opts.productSelected) {
      productCode = padCode(nonPhoneDigits[0].value);
    }
  }
  if (productCode) result.productCode = productCode;

  if (opts.productSelected) {
    const qtyToken = digitTokens.find(
      (d) => d !== phoneToken && d !== extraPhoneToken && d.value.length >= 1 && d.value.length <= 2,
    );
    if (qtyToken) {
      const q = parseInt(qtyToken.value, 10);
      if (q >= 1 && q <= 99) result.quantity = q;
    }
  }

  const province = normalizeProvince(normalized);
  if (province) result.province = province;

  const district = normalizeDistrict(normalized);
  if (district) result.district = district;

  let remaining = normalized;
  if (result.phone) remaining = remaining.replace(result.phone, ' ');
  if (result.extraPhone) remaining = remaining.replace(result.extraPhone, ' ');
  if (result.district) {
    const aliases = [result.district.toLowerCase(), result.district];
    for (const a of aliases) remaining = remaining.replace(new RegExp(a, 'gi'), ' ');
  }
  if (result.province) {
    remaining = remaining.replace(new RegExp(result.province, 'gi'), ' ');
    remaining = remaining.replace(/\bуб\b|\bub\b|\bulaanbaatar\b/gi, ' ');
  }
  for (const p of PROVINCES) {
    remaining = remaining.replace(new RegExp(p, 'gi'), ' ');
  }
  if (productCode) {
    remaining = remaining.replace(new RegExp(productCode, 'gi'), ' ');
    const plain = productCode.replace(/^[PC]-/, '');
    remaining = remaining.replace(new RegExp('\\b' + plain + '\\b', 'g'), ' ');
    remaining = remaining.replace(new RegExp('\\b' + parseInt(plain, 10) + '\\b', 'g'), ' ');
  }
  remaining = remaining.replace(/\s+/g, ' ').trim();
  if (remaining.length >= 5 && /[а-яөүёa-z]/i.test(remaining)) {
    result.address = remaining;
  }
  result.remainingText = remaining;

  return result;
}
