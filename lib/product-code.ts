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

export function extractPhone(text: string): string | null {
  const cleaned = text.replace(/[^\d]/g, '');
  const match = cleaned.match(/([789]\d{7})/);
  return match ? match[1] : null;
}

export function isOrderIntent(text: string): boolean {
  const t = text.toLowerCase();
  return /захиалах|zahialah|zahialga|захиалга/.test(t);
}

export function detectProductMessage(text: string): { productCode: string | null; hasOrderIntent: boolean } {
  return {
    productCode: extractProductCode(text),
    hasOrderIntent: isOrderIntent(text),
  };
}
