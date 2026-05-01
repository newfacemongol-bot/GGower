const DIGRAPH_MAP: [RegExp, string][] = [
  [/sh/gi, 'ш'],
  [/ch/gi, 'ч'],
  [/ya/gi, 'я'],
  [/yo/gi, 'ё'],
  [/yu/gi, 'ю'],
  [/ts/gi, 'ц'],
  [/oo/gi, 'оо'],
  [/ee/gi, 'ээ'],
  [/uu/gi, 'үү'],
  [/ii/gi, 'ий'],
];

const SINGLE_MAP: Record<string, string> = {
  a: 'а', b: 'б', c: 'ц', d: 'д', e: 'э', f: 'ф',
  g: 'г', h: 'х', i: 'и', j: 'ж', k: 'к', l: 'л',
  m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р',
  s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'х',
  y: 'й', z: 'з',
};

function hasLatin(s: string): boolean {
  return /[a-zA-Z]/.test(s);
}

export function latinToCyrillic(text: string): string {
  if (!hasLatin(text)) return text;
  let out = text;
  for (const [re, rep] of DIGRAPH_MAP) {
    out = out.replace(re, (m) => (m[0] === m[0].toUpperCase() ? rep.toUpperCase() : rep));
  }
  out = out.replace(/[a-zA-Z]/g, (ch) => {
    const lower = ch.toLowerCase();
    const mapped = SINGLE_MAP[lower];
    if (!mapped) return ch;
    return ch === ch.toUpperCase() ? mapped.toUpperCase() : mapped;
  });
  return out;
}

export function normalizeSearchText(text: string): string {
  return latinToCyrillic(text);
}
