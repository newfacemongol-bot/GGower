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

// Galig (latin -> cyrillic) dictionary based on 5,097 real customer conversations.
// Applied word-by-word, case-insensitive, BEFORE slot extraction.
const GALIG: Record<string, string> = {
  zahialay: 'захиалая',
  zahialya: 'захиалья',
  zahialga: 'захиалга',
  zahialah: 'захиалах',
  zahialiya: 'захиалъя',
  zahialii: 'захиалъя',
  zahial: 'захиал',
  zahialmaar: 'захиалмаар',

  awii: 'авъя',
  avii: 'авъя',
  away: 'авъя',
  avya: 'авъя',
  abii: 'авъя',
  awi: 'авъя',
  awiy: 'авъя',
  avay: 'авъя',
  avi: 'авъя',
  avna: 'авна',
  avmaar: 'авмаар',

  bzd: 'БЗД',
  bgd: 'БГД',
  shd: 'СХД',
  sxd: 'СХД',
  sbd: 'СБД',
  hud: 'ХУД',
  xud: 'ХУД',
  chd: 'ЧД',
  dvvreg: 'дүүрэг',
  duureg: 'дүүрэг',

  bair: 'байр',
  bairaas: 'байраас',
  bairnii: 'байрны',
  horoo: 'хороо',
  toot: 'тоот',
  orts: 'орц',
  davhar: 'давхар',
  davhart: 'давхарт',
  dawhar: 'давхар',
  hothon: 'хотхон',
  horoolol: 'хороолол',
  gudamj: 'гудамж',
  zvvn: 'зүүн',
  baruun: 'баруун',
  urd: 'урд',
  taliin: 'талын',
  tald: 'талд',
  zam: 'зам',
  corpus: 'корпус',
  korpus: 'корпус',
  block: 'блок',
  blok: 'блок',

  ungu: 'өнгө',
  ygaan: 'ягаан',
  yagaan: 'ягаан',
  saaral: 'саарал',
  tsagaan: 'цагаан',
  har: 'хар',
  nogoon: 'ногоон',
  ulaan: 'улаан',
  tsaivar: 'цайвар',
  bor: 'бор',

  bnu: 'байна уу',
  bnuu: 'байна уу',
  bga: 'байгаа',
  bgaa: 'байгаа',
  bn: 'байна',
  bna: 'байна',
  bnauu: 'байна уу',
  yu: 'юу',
  ym: 'юм',
  yum: 'юм',
  ve: 'вэ',
  uu: 'уу',
  ni: 'нь',
  sh: 'шүү',
  sn: 'шинэ',
  ene: 'энэ',
  deer: 'дээр',
  bi: 'би',
  bol: 'бол',
  hed: 'хэд',
  heden: 'хэдэн',
  vne: 'үнэ',
  une: 'үнэ',
  sain: 'сайн',

  onoodor: 'өнөөдөр',
  unuudur: 'өнөөдөр',
  ireh: 'ирэх',
  hurgelt: 'хүргэлт',
  hodoo: 'хөдөө',

  aimag: 'аймаг',
  unaand: 'унаанд',
  oron: 'орон',
  darhand: 'Дархан',
  darkhan: 'Дархан',
  erdenet: 'Эрдэнэт',
  howsgol: 'Хөвсгөл',
  uvurkhangai: 'Өвөрхангай',
  uwurkhangai: 'Өвөрхангай',

  tos: 'тос',
  nom: 'ном',
  kod: 'код',
  hiisen: 'хийсэн',
  bodit: 'бодит',
};

const DOT_ABBREV_MAP: [RegExp, string][] = [
  [/\bb\.z\.d\b/gi, 'бзд'],
  [/\bb\.g\.d\b/gi, 'бгд'],
  [/\bs\.h\.d\b/gi, 'схд'],
  [/\bs\.b\.d\b/gi, 'сбд'],
  [/\bh\.u\.d\b/gi, 'худ'],
  [/\bch\.d\b/gi, 'чд'],
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const GALIG_ENTRIES = Object.entries(GALIG).sort((a, b) => b[0].length - a[0].length);
const WORD_MAP: [RegExp, string][] = [
  ...DOT_ABBREV_MAP,
  ...GALIG_ENTRIES.map(([k, v]) => [new RegExp(`\\b${escapeRegex(k)}\\b`, 'gi'), v] as [RegExp, string]),
];

export function latinToCyrillic(text: string): string {
  if (!hasLatin(text)) return text;
  let out = text;
  for (const [re, rep] of WORD_MAP) {
    out = out.replace(re, rep);
  }
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
