import { Mail, Phone, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Нууцлалын бодлого | Privacy Policy',
  description:
    'Facebook Messenger чатбот үйлчилгээний нууцлалын бодлого / Privacy policy for the Facebook Messenger chatbot service.',
};

interface SectionContent {
  title: string;
  intro?: string;
  items?: string[];
  contact?: { email: string; phone: string };
}

const MN: SectionContent[] = [
  {
    title: 'Нууцлалын бодлого',
    intro:
      'Энэхүү баримт нь манай Facebook Messenger чатбот үйлчилгээг ашиглахад хэрхэн хэрэглэгчийн мэдээллийг цуглуулж, ашиглаж, хадгалдаг талаар тайлбарласан болно. Уг үйлчилгээг ашигласнаар та доорх нөхцөлийг зөвшөөрсөнд тооцогдоно.',
  },
  {
    title: '1. Мэдээлэл цуглуулах',
    items: [
      'Нэр, утасны дугаар, хаяг (захиалгад ашиглагдана)',
      'Facebook PSID (bot-той харилцахад ашиглагдана)',
      'Мессеж болон харилцааны агуулга',
    ],
  },
  {
    title: '2. Мэдээлэл ашиглах',
    items: ['Захиалга боловсруулах', 'Хүргэлт зохицуулах', 'Оператортой холбоо барих'],
  },
  {
    title: '3. Мэдээлэл хадгалах',
    items: [
      'Таны өгөгдөл манай серверт найдвартай хадгалагдана',
      'Гуравдагч этгээдэд худалдаалах, шилжүүлэхгүй',
      'Facebook-ийн нууцлалын бодлого (Privacy Policy)-ыг дагана',
    ],
  },
  {
    title: '4. Хэрэглэгчийн эрх',
    items: [
      'Өөрийн мэдээллийг шалгах, шинэчлэх, устгуулах хүсэлт гаргах',
      'Facebook Messenger дээр ярианаас гарах болон bot-ыг блоклох',
    ],
  },
  {
    title: '5. Холбоо барих',
    contact: { email: 'erpzahialga@gmail.com', phone: '+976 77774090' },
  },
];

const EN: SectionContent[] = [
  {
    title: 'Privacy Policy',
    intro:
      'This document explains how we collect, use, and store user information when you use our Facebook Messenger chatbot service. By using this service, you agree to the terms outlined below.',
  },
  {
    title: '1. Information We Collect',
    items: [
      'Name, phone number, and address (used for orders)',
      'Facebook PSID (used to interact with the bot)',
      'Messages and conversation content',
    ],
  },
  {
    title: '2. How We Use Information',
    items: ['Processing orders', 'Coordinating delivery', 'Contacting you through an operator'],
  },
  {
    title: '3. Data Storage',
    items: [
      'Your data is stored securely on our servers',
      'We do not sell or share your data with third parties',
      "We comply with Facebook's Privacy Policy",
    ],
  },
  {
    title: '4. User Rights',
    items: [
      'Request to review, update, or delete your information',
      'Leave the conversation or block the bot on Facebook Messenger',
    ],
  },
  {
    title: '5. Contact',
    contact: { email: 'erpzahialga@gmail.com', phone: '+976 77774090' },
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
              Нууцлалын бодлого / Privacy Policy
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Facebook Messenger чатбот үйлчилгээ · Chatbot service
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          <PolicyColumn label="Монгол" content={MN} />
          <PolicyColumn label="English" content={EN} />
        </div>

        <p className="text-xs text-slate-500 text-center mt-6">
          Хамгийн сүүлд шинэчилсэн / Last updated: 2026-05-02
        </p>
      </div>
    </main>
  );
}

function PolicyColumn({ label, content }: { label: string; content: SectionContent[] }) {
  const [header, ...rest] = content;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-4">
        {label}
      </div>
      {header.intro && (
        <p className="text-slate-700 leading-relaxed mb-7">{header.intro}</p>
      )}
      <div className="space-y-7">
        {rest.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mb-3">{s.title}</h2>
            {s.items && (
              <ul className="list-disc pl-5 space-y-1.5 text-slate-700 leading-relaxed">
                {s.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            )}
            {s.contact && (
              <div className="space-y-2 text-slate-700">
                <a
                  href={`mailto:${s.contact.email}`}
                  className="inline-flex items-center gap-2 text-slate-800 hover:text-slate-900 font-medium"
                >
                  <Mail className="w-4 h-4" /> {s.contact.email}
                </a>
                <div>
                  <a
                    href={`tel:${s.contact.phone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-2 text-slate-800 hover:text-slate-900 font-medium"
                  >
                    <Phone className="w-4 h-4" /> {s.contact.phone}
                  </a>
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
