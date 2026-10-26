import Link from "next/link";
import { ArrowLeft, BookOpen, Layers3, Compass, Sprout } from "lucide-react";

const steps = [
  {
    icon: Compass,
    title: "بداية واضحة",
    text: "تعرّف إلى آداب الطلب، وحدّد نقطة البداية المناسبة لرحلتك.",
  },
  {
    icon: Layers3,
    title: "تدرّج في التعلّم",
    text: "ابدأ بالأصول، وابنِ فهمك خطوةً خطوة، بعيدًا عن التشتّت.",
  },
  {
    icon: Sprout,
    title: "علمٌ يثمر عملًا",
    text: "اجعل المراجعة والتأمل والعمل بما تتعلّم جزءًا من يومك.",
  },
];
export default function Home() {
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="dot" /> أهلًا بك في أكاديمية تفقّه
          </span>
          <h1>
            خطوتك الأولى نحو
            <br />
            <em>علمٍ راسخ.</em>
          </h1>
          <p className="lead">
            رحلة في طلب العلم الشرعي، تبدأ بأصول واضحة، وتنمو بالتدرّج
            والمراجعة. مساحة تعينك على الفهم، وتمنح بدايتك وجهة.
          </p>
          <div className="actions">
            <Link href="/new-student" className="button button-primary">
              أنا طالب جديد <ArrowLeft size={19} />
            </Link>
            <Link href="#approach" className="text-link">
              تعرّف إلى منهج التعلّم <span>↓</span>
            </Link>
          </div>
          <p className="quiet hero-note">
            المنصة في مرحلتها التأسيسية. يُعلن عن البرامج بعد اعتمادها.
          </p>
        </div>
        <div className="hero-art" aria-label="رسم زخرفي لكتاب مفتوح">
          <div className="art-corner">
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </div>
          <div className="arch">
            <div className="arch-inner">
              <span className="art-star">✧</span>
              <BookOpen className="hero-book" strokeWidth={0.8} />
              <p>على بصيرة</p>
              <span className="art-caption">تأصيل · تدرّج · فهم</span>
            </div>
          </div>
          <div className="art-bottom">
            <span>رحلة العلم تبدأ بخطوة</span>
            <span>۰۱</span>
          </div>
        </div>
      </section>
      <section id="approach" className="approach">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">منهج التعلّم</span>
              <h2>بداية متأنّية، وأثرٌ ممتد.</h2>
            </div>
            <p>
              ليست العبرة بكثرة ما تبدأ،
              <br />
              بل بوضوح الطريق والاستمرار فيه.
            </p>
          </div>
          <div className="features">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <article key={title} className="feature">
                <div className="feature-top">
                  <Icon size={27} strokeWidth={1.5} />
                  <span>٠{i + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="container next-step">
        <div>
          <span className="eyebrow">من هنا تبدأ</span>
          <h2>
            لكل طالب علمٍ بداية.
            <br />
            اجعل بدايتك على هدى.
          </h2>
        </div>
        <div>
          <p>
            جمعنا لك خطوات بسيطة للاستعداد، وإجابات عن أسئلتك الأولى قبل انطلاق
            البرامج التعليمية.
          </p>
          <Link href="/new-student" className="button button-primary">
            اطّلع على دليل الطالب الجديد <ArrowLeft size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
