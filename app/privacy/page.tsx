import { Mail, Phone, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Нууцлалын бодлого | Facebook Messenger chatbot',
  description:
    'Facebook Messenger чатбот үйлчилгээний нууцлалын бодлого — мэдээлэл цуглуулалт, ашиглалт, хадгалалт болон холбоо барих мэдээлэл.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
              Нууцлалын бодлого
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Facebook Messenger чатбот үйлчилгээ
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-8 shadow-sm">
          <p className="text-slate-700 leading-relaxed">
            Энэхүү баримт нь манай Facebook Messenger чатбот үйлчилгээг ашиглахад хэрхэн
            хэрэглэгчийн мэдээллийг цуглуулж, ашиглаж, хадгалдаг талаар тайлбарласан болно.
            Уг үйлчилгээг ашигласнаар та доорх нөхцөлийг зөвшөөрсөнд тооцогдоно.
          </p>

          <Section title="1. Мэдээлэл цуглуулах">
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700 leading-relaxed">
              <li>Нэр, утасны дугаар, хаяг (захиалгад ашиглагдана)</li>
              <li>Facebook PSID (bot-той харилцахад ашиглагдана)</li>
              <li>Мессеж, коммент болон харилцааны агуулга</li>
            </ul>
          </Section>

          <Section title="2. Мэдээлэл ашиглах">
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700 leading-relaxed">
              <li>Захиалга боловсруулах</li>
              <li>Хүргэлт зохицуулах</li>
              <li>Оператортой холбоо барих</li>
            </ul>
          </Section>

          <Section title="3. Мэдээлэл хадгалах">
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700 leading-relaxed">
              <li>Таны өгөгдөл манай серверт найдвартай хадгалагдана</li>
              <li>Гуравдагч этгээдэд худалдаалах, шилжүүлэхгүй</li>
              <li>Facebook-ийн нууцлалын бодлого (Privacy Policy)-ыг дагана</li>
            </ul>
          </Section>

          <Section title="4. Хэрэглэгчийн эрх">
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700 leading-relaxed">
              <li>Өөрийн мэдээллийг шалгах, шинэчлэх, устгуулах хүсэлт гаргах</li>
              <li>Facebook Messenger дээр ярианаас гарах болон bot-ыг блоклох</li>
            </ul>
          </Section>

          <Section title="5. Холбоо барих">
            <div className="space-y-2 text-slate-700">
              <a
                href="mailto:turbolddorlig@gmail.com"
                className="inline-flex items-center gap-2 text-slate-800 hover:text-slate-900 font-medium"
              >
                <Mail className="w-4 h-4" /> turbolddorlig@gmail.com
              </a>
              <div>
                <a
                  href="tel:+97677774090"
                  className="inline-flex items-center gap-2 text-slate-800 hover:text-slate-900 font-medium"
                >
                  <Phone className="w-4 h-4" /> +976 77774090
                </a>
              </div>
            </div>
          </Section>
        </div>

        <p className="text-xs text-slate-500 text-center mt-6">
          Хамгийн сүүлд шинэчилсэн: 2026-05-02
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mb-3">{title}</h2>
      {children}
    </section>
  );
}
