export const PROVINCES = [
  'Улаанбаатар', 'Архангай', 'Баян-Өлгий', 'Баянхонгор', 'Булган',
  'Говь-Алтай', 'Дархан-Уул', 'Дорноговь', 'Дорнод', 'Дундговь',
  'Завхан', 'Орхон', 'Өвөрхангай', 'Өмнөговь', 'Сүхбаатар',
  'Сэлэнгэ', 'Төв', 'Увс', 'Ховд', 'Хөвсгөл', 'Хэнтий',
];

export const UB_DISTRICTS = ['БЗД', 'БГД', 'СБД', 'СХД', 'ХУД', 'ЧД'];

export function isUB(province: string): boolean {
  return province.toLowerCase().includes('улаанбаатар') || province.toLowerCase() === 'ub';
}
