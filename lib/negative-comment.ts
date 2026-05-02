const NEGATIVE_PATTERNS = [
  // Cyrillic
  'худал', 'хуурамч', 'залилсан', 'залилах', 'залилж', 'залиллаж', 'залилаж',
  'луйвар', 'луйварчин', 'луйварлаж', 'луйварлах',
  'хог', 'хогтой', 'хог2',
  'муухай', 'муу бараа', 'муу үйлчилгээ', 'муу2', 'муу юм',
  'хулхидаж', 'хулхи', 'хулхичин',
  'хуурч байна', 'хуурч', 'хуурсан', 'мэхэлж', 'мэхэлсэн',
  'битгий худлаа', 'худлаа зар', 'худлаа',
  'буруу юм зарж', 'ажиллахгүй', 'эвдэрсэн',
  'скам', 'скамм',
  'гологдол', 'гологдсон', 'гологд',
  'хэрэггүй юм',
  'худал2', 'луйвар2', 'залил2',

  // Latin / Mixed
  'hudal', 'xudal',
  'huuramch', 'xuuramch', 'huurch',
  'zalilsan', 'zalilan', 'zalilj', 'zalil2',
  'luivar', 'luivariin', 'luivarchin',
  'hog', 'hog2', 'hogtoi',
  'muuhaj', 'muuhai', 'muu baraa', 'muu',
  'hulhi', 'hulhidaj', 'hulhichin',
  'sda', 'sdaa',
  'zail', 'zail2',
  'scam', 'skam', 'sham',
  'golog', 'gologdol', 'gologdson',
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const NEGATIVE_REGEX = new RegExp(
  `(^|[^a-zа-яё0-9])(?:${NEGATIVE_PATTERNS.map(escapeRegex).join('|')})([^a-zа-яё0-9]|$)`,
  'i',
);

export function isNegativeComment(text: string): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return NEGATIVE_REGEX.test(normalized);
}
