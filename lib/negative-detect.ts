export type NegativeCategory =
  | 'delivery_when'
  | 'delivery_delay'
  | 'order_cancel'
  | 'fake_product'
  | 'refund'
  | 'phone_unreachable'
  | null;

export type Sentiment = 'neutral' | 'negative' | 'complaint' | 'urgent';

export interface NegativeMatch {
  category: NegativeCategory;
  sentiment: Sentiment;
  response: string;
  handoff: boolean;
  resetToIdle: boolean;
}

const SUPPORT_PHONE = '77774090';

export function detectNegative(text: string): NegativeMatch | null {
  const t = text.toLowerCase();

  if (/(буцаа|мөнгө\s*буцаа|буцааж\s*өг|давхар\s*авсан|мөнгө.*буцаа)/i.test(t)) {
    return {
      category: 'refund',
      sentiment: 'urgent',
      response: `Уучлаарай, энэ асуудлыг яаралтай шийдвэрлэнэ 🙏\nОператор тантай удахгүй холбогдоно.\n📞 ${SUPPORT_PHONE}`,
      handoff: true,
      resetToIdle: false,
    };
  }

  if (/(худал|хуурамч|залилсан|луйвар|буруу\s*бараа|хуурч|хуурмаг)/i.test(t)) {
    return {
      category: 'fake_product',
      sentiment: 'complaint',
      response: `Уучлаарай, энэ асуудлыг шийдвэрлэхийн тулд оператортой холбогдоно уу 🙏\n📞 ${SUPPORT_PHONE}`,
      handoff: true,
      resetToIdle: false,
    };
  }

  if (/(утсаа\s*авахгүй|утас\s*авахгүй|утсаа\s*авдаггүй|утас\s*авдаггүй)/i.test(t)) {
    return {
      category: 'phone_unreachable',
      sentiment: 'negative',
      response: `Уучлаарай, одоо оператор завгүй байна. Удахгүй холбогдоно 🙏\n📞 ${SUPPORT_PHONE}`,
      handoff: true,
      resetToIdle: false,
    };
  }

  if (/(цуцал|цуцлаа|авахгүй\s*болсон|болихоо|хэрэггүй\s*болч|хүргэж\s*ирэх\s*хэрэггүй|болих\s*болсон)/i.test(t)) {
    return {
      category: 'order_cancel',
      sentiment: 'neutral',
      response: 'Ойлголоо, захиалгыг цуцаллаа.\nДахин захиалах бол мессеж илгээнэ үү 😊',
      handoff: false,
      resetToIdle: true,
    };
  }

  if (/(удаж\s*байна|хүлээж\s*байна|ирдэггүй|ирэхгүй\s*байна|хүргэлт.*удаж)/i.test(t)) {
    return {
      category: 'delivery_delay',
      sentiment: 'complaint',
      response: `Уучлаарай, саатал учирсанд өршөөгөөрэй 🙏\nЗахиалгын дугаараа бичнэ үү эсвэл ${SUPPORT_PHONE} дугаарт залгана уу.`,
      handoff: true,
      resetToIdle: false,
    };
  }

  if (/(хэзээ\s*ирэх|хэзээ\s*очих|хүргэлт\s*хэзээ|өнөөдөр\s*ирэх\s*үү|маргааш\s*ирэх\s*үү|хэдэн\s*цагт\s*ирэх)/i.test(t)) {
    return {
      category: 'delivery_when',
      sentiment: 'neutral',
      response: `Захиалгын дугаараа бичнэ үү, статусыг шалгаж хариулна.\nЭсвэл ${SUPPORT_PHONE} дугаарт залгана уу 😊`,
      handoff: false,
      resetToIdle: false,
    };
  }

  return null;
}
