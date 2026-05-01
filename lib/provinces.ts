export const PROVINCES = [
  'Улаанбаатар', 'Архангай', 'Баян-Өлгий', 'Баянхонгор', 'Булган',
  'Говь-Алтай', 'Дархан-Уул', 'Дорноговь', 'Дорнод', 'Дундговь',
  'Завхан', 'Орхон', 'Өвөрхангай', 'Өмнөговь', 'Сүхбаатар',
  'Сэлэнгэ', 'Төв', 'Увс', 'Ховд', 'Хөвсгөл', 'Хэнтий',
];

export const UB_DISTRICTS = ['БЗД', 'БГД', 'СБД', 'СХД', 'ХУД', 'ЧД'];

const DISTRICT_ALIASES: Record<string, string> = {
  'бзд': 'БЗД', 'bzd': 'БЗД', 'баянзүрх': 'БЗД', 'баянзурх': 'БЗД',
  'бгд': 'БГД', 'bgd': 'БГД', 'баянгол': 'БГД',
  'сбд': 'СБД', 'sbd': 'СБД', 'сүхбаатар': 'СБД', 'сухбаатар': 'СБД',
  'схд': 'СХД', 'shd': 'СХД', 'sxd': 'СХД', 'сонгинохайрхан': 'СХД',
  'худ': 'ХУД', 'hud': 'ХУД', 'xud': 'ХУД', 'хан-уул': 'ХУД', 'хануул': 'ХУД',
  'чд': 'ЧД', 'cd': 'ЧД', 'chd': 'ЧД', 'чингэлтэй': 'ЧД',
  'нд': 'НД', 'nd': 'НД', 'налайх': 'НД',
  'бнд': 'БНД', 'bnd': 'БНД', 'багануур': 'БНД',
  'бхд': 'БХД', 'bhd': 'БХД', 'багахангай': 'БХД',
};

export function normalizeDistrict(input: string): string | null {
  const key = input.trim().toLowerCase().replace(/[^а-яөүёa-z-]/gi, '');
  if (!key) return null;
  if (DISTRICT_ALIASES[key]) return DISTRICT_ALIASES[key];
  for (const [alias, code] of Object.entries(DISTRICT_ALIASES)) {
    if (key.includes(alias)) return code;
  }
  return null;
}

const PROVINCE_ALIASES: Record<string, string> = {
  'уб': 'Улаанбаатар', 'ub': 'Улаанбаатар', 'ulaanbaatar': 'Улаанбаатар',
  'улаанбаатар': 'Улаанбаатар',
};

export function normalizeProvince(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  if (PROVINCE_ALIASES[raw]) return PROVINCE_ALIASES[raw];
  for (const [alias, name] of Object.entries(PROVINCE_ALIASES)) {
    if (raw.includes(alias)) return name;
  }
  for (const p of PROVINCES) {
    const pLower = p.toLowerCase();
    const first = pLower.split('-')[0];
    if (raw === pLower || raw.includes(pLower) || (first.length >= 4 && raw.includes(first))) {
      return p;
    }
  }
  return null;
}

export function isUB(province: string): boolean {
  return province.toLowerCase().includes('улаанбаатар') || province.toLowerCase() === 'ub' || province.toLowerCase() === 'уб';
}
