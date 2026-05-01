const CYRILLIC_MAP: Record<string, string> = {
  'р': 'p', 'Р': 'P',
  'с': 'c', 'С': 'C',
};

export function normalizeProductCode(input: string): string | null {
  let s = input.trim();
  for (const [k, v] of Object.entries(CYRILLIC_MAP)) {
    s = s.replace(new RegExp(k, 'g'), v);
  }
  const match = s.match(/([pPcC])[-]?(\d{3,5})/);
  if (!match) return null;
  const letter = match[1].toUpperCase();
  const num = match[2].padStart(4, '0');
  return `${letter}-${num}`;
}

export function extractProductCode(text: string): string | null {
  return normalizeProductCode(text);
}

export function extractBareProductCode(text: string): string | null {
  const prefixed = normalizeProductCode(text);
  if (prefixed) return prefixed;
  const tokens = text.split(/\s+/);
  for (const tok of tokens) {
    const cleaned = tok.replace(/[^\d]/g, '');
    if (!cleaned) continue;
    if (cleaned.length >= 3 && cleaned.length <= 5 && !/^[789]/.test(cleaned)) {
      return cleaned.padStart(4, '0');
    }
    if (cleaned.length >= 3 && cleaned.length <= 5 && cleaned.length !== 8) {
      return cleaned.padStart(4, '0');
    }
  }
  return null;
}

export function extractPhone(text: string): string | null {
  const cleaned = text.replace(/[^\d]/g, '');
  const match = cleaned.match(/([789]\d{7})/);
  return match ? match[1] : null;
}

export function isOrderIntent(text: string): boolean {
  const t = text.toLowerCase();
  return /захиалах|захиалга|захиалмаар|захиалъя|захиалая|захиалаад|авмаар|авъя|авая|авмар|zahialah|zahialga|zahialmaar|avmaar|avya/.test(t);
}

export function isBareOrderIntent(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (!isOrderIntent(t)) return false;
  const withoutIntent = t
    .replace(/захиалга.*өгөе|захиалга.*өгмөөр|захиалга.*өгье|захиалмаар( байна)?|захиалая|захиалъя|авмаар( байна)?|авъя|авая|захиалах|zahialga|zahialah|zahialmaar|avmaar/g, '')
    .replace(/[.,!?\s]+/g, '');
  return withoutIntent.length < 3;
}

export function detectProductMessage(text: string): { productCode: string | null; hasOrderIntent: boolean } {
  return {
    productCode: extractProductCode(text),
    hasOrderIntent: isOrderIntent(text),
  };
}
