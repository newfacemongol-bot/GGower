const MN_ALT: Record<string, string[]> = {
  'ө': ['о', 'у', 'ү'],
  'ү': ['у', 'ө', 'о'],
  'в': ['ф'],
  'ф': ['в'],
  'б': ['п'],
  'п': ['б'],
  'т': ['д'],
  'д': ['т'],
  'з': ['с', 'ц'],
  'с': ['з', 'ц'],
  'ц': ['с', 'ч'],
  'ч': ['ц'],
  'й': ['и'],
  'и': ['й'],
  'ё': ['е'],
  'е': ['ё'],
  'ъ': ['ь'],
  'ь': ['ъ'],
};

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp: number[] = Array(n + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const sameClass = a[i - 1] === b[j - 1] || (MN_ALT[a[i - 1]]?.includes(b[j - 1]));
      dp[j] = sameClass
        ? prev
        : 1 + Math.min(prev, dp[j - 1], dp[j]);
      prev = tmp;
    }
  }
  return dp[n];
}

export function fuzzyMatch(query: string, candidate: string, maxRatio = 0.4): boolean {
  const q = query.toLowerCase().trim();
  const c = candidate.toLowerCase().trim();
  if (!q || !c) return false;
  if (c.includes(q)) return true;
  const words = c.split(/\s+/);
  for (const w of words) {
    if (w.startsWith(q)) return true;
    const d = levenshtein(q, w);
    if (d / Math.max(q.length, w.length) <= maxRatio) return true;
  }
  return false;
}

export function extractPriceRange(text: string): { max?: number; min?: number } | null {
  const t = text.toLowerCase();
  const range: { max?: number; min?: number } = {};

  const maxMatch = t.match(/(\d{1,3}(?:[ ,']?\d{3})*)\s*(?:төгрөг|₮|тугрик)?\s*(?:хүртэл|хүртэлх|дор|доош|доороо|дотор)/);
  if (maxMatch) {
    range.max = parseInt(maxMatch[1].replace(/[^\d]/g, ''), 10);
  }

  const minMatch = t.match(/(\d{1,3}(?:[ ,']?\d{3})*)\s*(?:төгрөг|₮|тугрик)?\s*(?:-?с|-?ээс|дээш|дээр|-?оос|-?өөс)/);
  if (minMatch) {
    range.min = parseInt(minMatch[1].replace(/[^\d]/g, ''), 10);
  }

  if (range.max === undefined && range.min === undefined) return null;
  return range;
}
