import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
export const metadata: Metadata = { title: "أنا طالب جديد" };
const steps = [
  [
    "استحضر نيّتك",
    "ابدأ بنية التعلّم والعمل، وخذ وقتك في بناء عادة ثابتة لطلب العلم.",
  ],
  [
    "هيّئ وقتك وأدواتك",
    "خصّص وقتًا مناسبًا، ودفترًا لتدوين الفوائد والأسئلة، ومكانًا هادئًا للمراجعة.",
  ],
  [
    "تعرّف إلى البرنامج عند إعلانه",
    "اطّلع على متطلبات البرنامج ومستواه قبل الالتحاق. لم تُنشر برامج معتمدة بعد.",
  ],
  [
    "تعلّم وراجع باستمرار",
    "اجمع بين الاستماع والتدوين والمراجعة، ولا تتعجل الانتقال قبل فهم الأساس.",
  ],
];
export default function NewStudent() {
  return (
    <div className="container page-space">
      <Link href="/" className="breadcrumb">
        الرئيسية / دليل البداية
      </Link>
      <div className="page-intro">
        <span className="eyebrow">دليل الطالب الجديد</span>
        <h1>أهلًا بخطوتك الأولى.</h1>
        <p className="lead">
          لا تحتاج إلى أن تعرف الطريق كله لتبدأ.
          <br />
          هذه خطوات تعينك على الاستعداد لرحلتك في طلب العلم.
        </p>
      </div>
      <div className="student-grid">
        <section aria-label="خطوات الاستعداد" className="steps">
          {steps.map(([title, text], i) => (
            <article key={title} className="step">
              <span className="step-number">
                {new Intl.NumberFormat("ar").format(i + 1)}
              </span>
              <div>
                <h2>{title}</h2>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </section>
        <aside className="student-note">
          <span className="eyebrow">قبل أن تبدأ</span>
          <h2>
            القليل الدائم
            <br />
            يبني الكثير.
          </h2>
          <ul>
            {[
              "وقت ثابت يناسب يومك",
              "دفتر للفوائد والأسئلة",
              "مراجعة لما سبق تعلّمه",
            ].map((t) => (
              <li key={t}>
                <Check size={18} />
                {t}
              </li>
            ))}
          </ul>
          <div className="notice">
            التسجيل غير متاح حاليًا. هذه نسخة تأسيسية، ولا تُجمع فيها بيانات
            الطلاب.
          </div>
          <Link href="/login" className="text-link">
            اطّلع على صفحة الدخول <ArrowLeft size={16} />
          </Link>
        </aside>
      </div>
      <section className="faq">
        <span className="eyebrow">أسئلة البداية</span>
        <h2>ما الذي تحتاج إلى معرفته؟</h2>
        <details>
          <summary>هل أحتاج إلى دراسة شرعية سابقة؟</summary>
          <p>
            ستُوضّح المتطلبات لكل برنامج عند إعلانه. لا توجد حاليًا برامج مفتوحة
            للالتحاق.
          </p>
        </details>
        <details>
          <summary>كيف أنشئ حسابًا في المنصة؟</summary>
          <p>
            إنشاء الحسابات غير مفعّل في هذه المرحلة. ستُحدّث خطوات التسجيل بعد
            تجهيز الخدمة واعتماد سياسة الخصوصية.
          </p>
        </details>
        <details>
          <summary>أين أجد الدروس والتسجيلات؟</summary>
          <p>
            لم تُنشر دروس أو تسجيلات بعد. ستظهر المواد التعليمية بعد اعتمادها
            والإذن بنشرها.
          </p>
        </details>
      </section>
    </div>
  );
}
