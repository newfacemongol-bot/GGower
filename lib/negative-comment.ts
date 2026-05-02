const NEGATIVE_PATTERNS = [
  'худал', 'хуурамч', 'залилсан', 'залилах', 'залилж',
  'луйвар', 'луйварчин',
  'хог', 'хогтой', 'хог2',
  'муухай', 'муу бараа', 'муу2',
  'хулхидаж', 'хулхи', 'хулхичин',
  'хуурч байна', 'хуурч', 'хуурсан',
  'битгий худлаа', 'худлаа зар', 'худлаа',
  'буруу юм зарж', 'ажиллахгүй', 'эвдэрсэн',
  'скам', 'скамм',
  'гологдол', 'гологдсон', 'гологд',
  'хэрэггүй юм',
  'худал2', 'луйвар2', 'залил2',

  'hudal', 'xudal',
  'huuramch', 'xuuramch', 'huurch',
  'zalilsan', 'zalilan', 'zalilj', 'zalil2',
  'luivar', 'luivariin', 'luivarchin',
  'hog', 'hog2', 'hogtoi',
  'muuhaj', 'muuhai', 'muu baraa',
  'hulhi', 'hulhidaj', 'hulhichin',
  'sda', 'sdaa',
  'zail', 'zail2',
  'scam', 'skam', 'sham',
  'golog', 'gologdol', 'gologdson',
];

export function isNegativeComment(text: string): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const kw of NEGATIVE_PATTERNS) {
    const k = kw.toLowerCase();
    if (k.includes(' ')) {
      if (normalized.includes(k)) return true;
    } else {
      const re = new RegExp(`(^|[^a-zа-яё0-9])${escapeRegex(k)}([^a-zа-яё0-9]|$)`, 'i');
      if (re.test(normalized)) return true;
    }
  }
  return false;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
