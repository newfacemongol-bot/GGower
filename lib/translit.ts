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

// Complete galig (latin -> cyrillic) dictionary based on 5,097 real conversations.
// Exact word-boundary match. Case-insensitive.
export const GALIG: Record<string, string> = {
  // ЗАХИАЛГА
  zahialay: 'захиалая', zahialga: 'захиалга', zahialii: 'захиалъя',
  zahialiya: 'захиалъя', zahialiy: 'захиалъя', zahialah: 'захиалах',
  zahialgaa: 'захиалгаа', zahiali: 'захиалъя', zahialy: 'захиалья',
  zahialaad: 'захиалаад', zahialaya: 'захиалая', zahialya: 'захиалья',
  zaxialga: 'захиалга', zahial: 'захиал', zahialmaar: 'захиалмаар',

  // АВАХ
  awii: 'авъя', avii: 'авъя', away: 'авъя', awi: 'авъя', avay: 'авъя',
  awiy: 'авъя', avya: 'авъя', abii: 'авъя', avie: 'авъя', avna: 'авна',
  aviya: 'авъя', awiii: 'авъя', aviy: 'авъя', awie: 'авъя', avaya: 'авъя',
  avi: 'авъя', awiya: 'авъя', avnaa: 'авна', tawih: 'тавих', awaya: 'авъя',
  aviraa: 'авираа', aviii: 'авъя', avahaa: 'авахаа', avah: 'авах',
  tawihuu: 'тавихуу', awiiii: 'авъя', tawiad: 'тавиад', tawiulii: 'тавиулъя',
  abya: 'авъя', awna: 'авна', awya: 'авъя', awah: 'авах', awahgui: 'авахгүй',
  awhaar: 'авхаар', avchihiya: 'авчихъя', avch: 'авч', awch: 'авч',
  awmar: 'авмаар', awy: 'авъя', abi: 'авъя', avmaar: 'авмаар',
  awsan: 'авсан', absan: 'авсан',

  // ДҮҮРЭГ
  bzd: 'БЗД', bgd: 'БГД', shd: 'СХД', sxd: 'СХД', sbd: 'СБД',
  hud: 'ХУД', xud: 'ХУД', chd: 'ЧД', dvvreg: 'дүүрэг', duureg: 'дүүрэг',
  bzduureg: 'БЗД дүүрэг', huduu: 'ХУД дүүрэг', hchd: 'ХЧД',

  // ХАЯГ
  toot: 'тоот', tootod: 'тоотод',
  bair: 'байр', bairnii: 'байрны', bairni: 'байрны', bairaas: 'байраас',
  horoo: 'хороо', khoroo: 'хороо', horooo: 'хороо',
  horoolol: 'хороолол', horoololiin: 'хороололын',
  orts: 'орц', ortsnii: 'орцны', ortsni: 'орцны',
  davhar: 'давхар', davhart: 'давхарт', dawhar: 'давхар',
  dawhart: 'давхарт', dabhar: 'давхар',
  hothon: 'хотхон', hothonii: 'хотхоны', khotkhon: 'хотхон',
  hotgon: 'хотхон', xotxon: 'хотхон',
  gudamj: 'гудамж', gudam: 'гудамж',
  zamiin: 'замын', zamd: 'замд', zam: 'зам',
  hayg: 'хаяг', xoroo: 'хороо', xoroolol: 'хороолол',
  zvvn: 'зүүн', zuun: 'зүүн', baruun: 'баруун',
  urd: 'урд', tald: 'талд', taliin: 'талын',
  hajuud: 'хажууд', hajuu: 'хажуу',
  hoind: 'хойд', hoino: 'хойно',
  deer: 'дээр', deeree: 'дээрээ', ard: 'ард',
  urdsdhujq: 'урд', awtobusnii: 'автобусны', awtobusni: 'автобусны',
  buudal: 'буудал', buudlin: 'буудлын',
  corpus: 'корпус', korpus: 'корпус', block: 'блок', blok: 'блок',

  // ӨНГӨ
  saaral: 'саарал', saaraliig: 'саарлыг', saaralaas: 'саарлаас',
  saraal: 'саарал', ungu: 'өнгө', ungutei: 'өнгөтэй',
  ungunuus: 'өнгөнөөс', ongo: 'өнгө', ungiig: 'өнгийг',
  ongoos: 'өнгөөс', yagaan: 'ягаан', ygaan: 'ягаан',
  ygaanaas: 'ягаанаас', tsagaan: 'цагаан',
  nogoon: 'ногоон', nogoonii: 'ногооны', ulaan: 'улаан',
  tsaivar: 'цайвар', tsaiwar: 'цайвар',
  bor: 'бор', bordoo: 'бордоо',
  har: 'хар',

  // ЦАГ
  onoodor: 'өнөөдөр', unuudur: 'өнөөдөр', odoo: 'одоо',
  margaash: 'маргааш', margash: 'маргааш',
  ireh: 'ирэх', irehgui: 'ирэхгүй', ireed: 'ирээд',
  irsen: 'ирсэн', irheer: 'ирэхэд', irhvv: 'ирэхээ', irj: 'ирж',
  hurgelt: 'хүргэлт', hurgelteer: 'хүргэлтээр', hurgeltiin: 'хүргэлтийн',
  hvrgelt: 'хүргэлт', hvrgeltiin: 'хүргэлтийн', xvrgeltiin: 'хүргэлтийн',
  hvrgelttei: 'хүргэлттэй', hvrtel: 'хүртэл', hvrgeh: 'хүргэх',
  hezee: 'хэзээ', tsagt: 'цагт', tsag: 'цаг', tsagaas: 'цагаас',
  ochigdur: 'өчигдөр', uchigdur: 'өчигдөр',
  odort: 'өдөрт', oroi: 'орой', ert: 'эрт',

  // АЙМАГ/ГАЗАР
  aimag: 'аймаг', aimagt: 'аймагт', unaand: 'унаанд', unaa: 'унаа',
  oron: 'орон', nutag: 'нутаг', nutagt: 'нутагт', nutgiin: 'нутгийн',
  hodoo: 'хөдөө', hodo: 'хөдөө',
  darhand: 'Дархан', darkhan: 'Дархан', darhan: 'Дархан',
  erdenet: 'Эрдэнэт', howsgol: 'Хөвсгөл', huwsgul: 'Хөвсгөл',
  uvurkhangai: 'Өвөрхангай', uwurkhangai: 'Өвөрхангай',
  omnogowi: 'Өмнөговь', umnugowi: 'Өмнөговь', umnugovi: 'Өмнөговь',
  dornod: 'Дорнод', dornogowi: 'Дорноговь',
  selenge: 'Сэлэнгэ', svhbaatar: 'Сүхбаатар', suhbaatar: 'Сүхбаатар',
  bulgan: 'Булган', arhangai: 'Архангай',
  zawhan: 'Завхан', zavhan: 'Завхан',
  howd: 'Ховд', altai: 'Алтай', gobi: 'Говь',
  sum: 'сум', zaisan: 'Зайсан', zaisangiin: 'Зайсангийн',
  nalaih: 'Налайх', chingeltei: 'Чингэлтэй',
  songin: 'Сонгино', hairhan: 'Хайрхан',
  sansar: 'Сансар', narantuul: 'Нарантуул',

  // ГАЗРЫН НЭРС / БАЙГУУЛЛАГА
  emneleg: 'эмнэлэг', emnelegt: 'эмнэлэгт', emiin: 'эмийн',
  surguuli: 'сургууль', surguuliin: 'сургуулийн',
  delguur: 'дэлгүүр', delguuriin: 'дэлгүүрийн', delgvvr: 'дэлгүүр',
  zah: 'зах', zahiin: 'захын',
  park: 'парк', plaza: 'плаза', center: 'центр', centeriin: 'центрийн',
  mall: 'молл', town: 'таун', villa: 'вилла',
  apartment: 'апартмент', garden: 'гарден',

  // АСУУЛТ/ҮЙЛДЭЛ
  bnu: 'байна уу', bnuu: 'байна уу', bainuu: 'байна уу',
  baina: 'байна', bga: 'байгаа', bgaa: 'байгаа', baigaa: 'байгаа',
  bn: 'байна', bna: 'байна', bnaa: 'байна', bnauu: 'байна уу',
  bolhuu: 'болох уу', bolohuu: 'болох уу', bolwuu: 'болох уу',
  boluu: 'болох уу', bolno: 'болно', boloh: 'болох',
  bolson: 'болсон', bolloo: 'боллоо', bolu: 'болоо', bolison: 'болсон',
  bvl: 'бол', bol: 'бол',
  yu: 'юу', ym: 'юм', yum: 'юм', yuma: 'юм', ymaa: 'юмаа',
  ymu: 'юм', ymuu: 'юм уу', yub: 'юу б',
  ymar: 'ямар', yamar: 'ямар',
  yaj: 'яаж', yaaj: 'яаж', yagaad: 'яагаад', yah: 'яах',
  ve: 'вэ', vne: 'үнэ', une: 'үнэ',
  uu: 'уу', ni: 'нь', ene: 'энэ',
  iig: 'ийг', eniig: 'энийг',
  hl: 'хэл', hed: 'хэд', heden: 'хэдэн',
  hemjee: 'хэмжээ', hemjeetei: 'хэмжээтэй',
  heregleh: 'хэрэглэх', hereglehvv: 'хэрэглэхээ',
  haana: 'хаана',
  neg: 'нэг', nomer: 'номер', noimor: 'номер',
  dugaar: 'дугаар', dugaaraa: 'дугаараа', dugaarluu: 'дугаар луу',
  utas: 'утас', utasaa: 'утасаа',
  sh: 'шүү', sn: 'шинэ',
  bi: 'би',

  // ҮЙЛДЭЛ
  sain: 'сайн',
  za: 'за', zaza: 'зазаа',
  tiim: 'тийм', tei: 'тэй',
  gesen: 'гэсэн', gej: 'гэж', geed: 'гээд', gsen: 'гэсэн', gd: 'гэд',
  tegvel: 'тэгвэл', teged: 'тэгээд',
  bayrllaa: 'баярлалаа', bayrlaa: 'баярлалаа', bayrlla: 'баярлалаа',
  bayrmaa: 'баярмаа',
  zalgah: 'залгах', zalgaarai: 'залгаарай', zalgaad: 'залгаад',
  holboo: 'холбоо', barih: 'барих',
  ochood: 'очоод', orood: 'ороод',
  uuchlaarai: 'уучлаарай', kargo: 'карго', kargod: 'каргод',
  tsutsallaa: 'цуцаллаа',

  // БАРАА/БУСАД
  kod: 'код', zurag: 'зураг', nom: 'ном', tos: 'тос', tosoo: 'тосоо',
  malgai: 'малгай',
  baraa: 'бараа', baraag: 'барааг', baraagaa: 'барааг', baraan: 'барааны',
  krem: 'крем', mask: 'маск', esreg: 'эсрэг',
  medeelel: 'мэдээлэл', medeell: 'мэдээлэл',
  ajil: 'ажил', ajiltai: 'ажилтай',
  hiisen: 'хийсэн', hisen: 'хийсэн',
  garsan: 'гарсан',
  bodit: 'бодит', mongol: 'монгол',
  mn: 'МН', ub: 'УБ',
};

const DOT_ABBREV_MAP: [RegExp, string][] = [
  [/\bb\.z\.d\b/gi, 'бзд'],
  [/\bb\.g\.d\b/gi, 'бгд'],
  [/\bs\.h\.d\b/gi, 'схд'],
  [/\bs\.b\.d\b/gi, 'сбд'],
  [/\bh\.u\.d\b/gi, 'худ'],
  [/\bch\.d\b/gi, 'чд'],
];

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

const GALIG_KEYS = Object.keys(GALIG);
const FUZZY_MIN_LEN = 4;
const fuzzyCache = new Map<string, string | null>();

function fuzzyMatch(word: string): string | null {
  if (word.length < FUZZY_MIN_LEN) return null;
  const lower = word.toLowerCase();
  if (fuzzyCache.has(lower)) return fuzzyCache.get(lower) ?? null;

  const maxDist = lower.length <= 5 ? 1 : 2;
  let bestKey: string | null = null;
  let bestDist = Infinity;

  for (const key of GALIG_KEYS) {
    if (Math.abs(key.length - lower.length) > maxDist) continue;
    const d = levenshtein(lower, key);
    if (d < bestDist && d <= maxDist) {
      bestDist = d;
      bestKey = key;
      if (d === 0) break;
    }
  }

  const result = bestKey ? GALIG[bestKey] : null;
  fuzzyCache.set(lower, result);
  return result;
}

function lookupGalig(word: string): string | null {
  const lower = word.toLowerCase();
  if (GALIG[lower] !== undefined) return GALIG[lower];
  return fuzzyMatch(lower);
}

function applyGalig(text: string): string {
  return text.replace(/[A-Za-z][A-Za-z'-]*/g, (m) => {
    const rep = lookupGalig(m);
    return rep !== null ? rep : m;
  });
}

export function latinToCyrillic(text: string): string {
  if (!hasLatin(text)) return text;
  let out = text;
  for (const [re, rep] of DOT_ABBREV_MAP) {
    out = out.replace(re, rep);
  }
  out = applyGalig(out);
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
