# تفعيل التسجيل والإدارة على رابط Vercel الحالي

هذا الدليل لتحضير **المشروع الموجود** `tafaqquh-academy` على `https://tafaqquh-academy.vercel.app`، دون Staging أو مشروع Firebase إضافي.

> لا تفعّل التسجيل العام من مجرد توفر الرابط. لا تنشر قواعد Firestore أو تضف بيانات اعتماد الإنتاج إلى GitHub. لا تُنفّذ أية خطوة سحابية دون مراجعة المالك.

## ترتيب التنفيذ

1. راجع إعداد Firebase Authentication في مشروع `tafaqquh-academy`: مزود Email/Password مفعل، وأضف `tafaqquh-academy.vercel.app` إلى Authorized domains. افحص بريد التأكيد وإعادة تعيين كلمة المرور وحدود إساءة إنشاء الحسابات.
2. من Firebase Console > Project settings > Your apps، استخدم بيانات **Web app** الموجودة، لا حساب خدمة. قارن Project ID ورقم المشروع مع `tafaqquh-academy` و`1030580627418`. لا تُنسخ أي قيم سرية إلى GitHub أو الدردشة.
3. من Firestore Console راجع نسخة `firestore.rules` على `main`، ثم قواعد النشر الفعلية. **النشر الآلي لقواعد Firebase يبقى محظورًا**؛ التغيير الحقيقي يحتاج موافقة مستقلة مع مراجعة دقيقة. تأكد من حالة الفهارس اللازمة للاستعلامات.
4. راجع نص `/privacy`، واملأ الجهة المتحكمة بالبيانات ووسيلة التواصل الرسمية ومدد الاحتفاظ وكيفية التصحيح والحذف وموقع حفظ البيانات. لا تضبط `NEXT_PUBLIC_PRIVACY_POLICY_APPROVED=true` قبل اعتماد نص السياسة فعليًا.
5. اختر حساب مدير موثّق موجود أو أنشئه بإجراء موثوق من Firebase Console. تابع `docs/admin.md` لتسجيل `administrators/{uid}` وسجل بدء الإدارة. لا تمنح المسؤول بناء على البريد أو من الواجهة العامة.
6. **هوية الخادم على Vercel غير مجهزة بمجرد إضافة متغيرات web config**. `firebase-admin` يستخدم `applicationDefault()`. جهّز اتصالًا موثوقًا من Vercel إلى Google Cloud بهوية تشغيل محدودة الأذونات، مع مراجعة IAM والتوثيق في `docs/runtime-iam.md`. تجنب مشاركة ملفات JSON أو تخزينها في المستودع. اختبر استدعاء قراءة إداري محدود قبل تفعيل مستخدمين حقيقيين.
7. في إعدادات Vercel للمشروع `tafaqquh-academy` أنشئ متغيرات **Production فقط** أولًا، مع تمييز server-only عن `NEXT_PUBLIC_*`، ثم أعد بناء التطبيق:
   - `APP_ENV=production`
   - `NEXT_PUBLIC_APP_ENV=production`
   - `APP_ORIGIN=https://tafaqquh-academy.vercel.app`
   - `FIREBASE_PROJECT_ID=tafaqquh-academy`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID=tafaqquh-academy`
   - `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`: نسخها من مشروع Web المقصود.
   - `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=false`, `FIREBASE_USE_EMULATORS=false`
   - `DRIVE_ENABLED=false`, `DRIVE_MEDIA_ENABLED=false`
   - أبقِ `FIREBASE_ADMIN_ENABLED=false` و`NEXT_PUBLIC_FIREBASE_AUTH_ENABLED=false` حتى تُختبر هوية الخادم والقواعد.
   - أبقِ `NEXT_PUBLIC_PRIVACY_POLICY_APPROVED=false` إلى اعتماد السياسة؛ ثم أضف بيانات `NEXT_PUBLIC_PRIVACY_CONTROLLER` و`NEXT_PUBLIC_PRIVACY_CONTACT` و`NEXT_PUBLIC_PRIVACY_RETENTION` المعتمدة.
8. اختبر بحسابين تملكهما (مدير وطالب) على الموقع نفسه: تأكيد البريد، طلب pending، دخول المدير، قبول الطالب، منح برنامج تجريبي، رفض عرض المحتوى لطالب غير مصرح، سحب البرنامج وتعليق الحساب، ومراجعة سجل التدقيق. تراجع عن التفعيل إذا فشل أي تحقق. لا تستخدم بيانات طلاب حقيقيين في التجربة.

## حدود التغيير البرمجي

تضيف `validateProduction` إذن بناء مقيدًا باسم موقع Vercel ومعرف Firebase المعروف، ولا تسمح بتغيير قواعد البيانات أو تفعيل Auth أو Admin أو Drive بنفسها. الحواجز الأصلية لعمليات `firebase deploy` تبقى كما هي. أسماء نطاقات Firebase وAPP_ORIGIN وتوافق المشروع مجرد تحقق شكلي؛ ليست مصادقة فعلية، ولا تحقق من أمان IAM أو سياسة الخصوصية.

يجب التحقق من نشر Firestore Rules الحقيقية واختبار IAM قبل فتح التسجيل العام. قد تكون هناك حصص مجانية في Firebase وVercel، لكن الزيادة في الاستخدام قد تفرض حدودًا أو تكلفة بحسب الخطة؛ لا تُفعِّل الفوترة دون موافقة.
