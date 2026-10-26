# إعداد Firebase

مشروع الإنتاج الموجود: `tafaqquh-academy`. لا تستخدم بياناته لاختبارات التطوير. إعداد Staging يأتي في طلب مراجعة مستقل ويجب دمجه مع تحديث الإدارة قبل نشر نسخة تجريبية.

## Console ومتغيرات البيئة

1. في المشروع المقصود، فعّل Email/Password وراجع سياسة كلمة المرور وقوالب التحقق والاستعادة. أضف نطاق التطبيق إلى Authorized domains. لا تُنشئ حسابات اختبار في الإنتاج.
2. استخدم Firestore `(default)` بقواعد مغلقة، وراجع موقع البيانات وملاءمته قبل الإنشاء. طبّق `firestore.rules` و`firestore.indexes.json` على المشروع المحدد بعد مراجعتها؛ الفهارس المركبة ضرورية للبحث والفرز. لا يستلزم هذا التحديث تفعيل Storage؛ قواعده تمنع الجميع.
3. املأ الستة متغيرات `NEXT_PUBLIC_FIREBASE_*` الخاصة بتطبيق الويب، ومعرّف المشروع. يجب أن تتطابق مع `FIREBASE_PROJECT_ID` على الخادم. `APP_ENV` و`NEXT_PUBLIC_APP_ENV` يساويان `local` محليًا أو `production` للإنتاج أو `staging` للبيئة المستقلة.
4. `NEXT_PUBLIC_FIREBASE_AUTH_ENABLED=true` يفعّل واجهة المصادقة بعد الإعداد. `FIREBASE_ADMIN_ENABLED=true` يفعّل العمليات الخلفية فقط مع هوية ADC صحيحة. `APP_ORIGIN` هو أصل الموقع الدقيق (scheme + hostname + port محليًا)، دون مسار أو شرطة ختامية.
5. راجع نص `/privacy` واعتمده إداريًا قبل التسجيل: حدد الجهة المسؤولة، وسيلة التواصل، مدة الاحتفاظ، موقع البيانات، إجراءات الحذف/التصحيح، وضوابط القُصّر إن انطبقت. املأ `NEXT_PUBLIC_PRIVACY_CONTROLLER` و`NEXT_PUBLIC_PRIVACY_CONTACT` و`NEXT_PUBLIC_PRIVACY_RETENTION` ثم اضبط `NEXT_PUBLIC_PRIVACY_POLICY_APPROVED=true`. هذا اعتماد تشغيلي للنص وليس شهادة امتثال قانوني.
6. جميع `NEXT_PUBLIC_*` تُضمَّن وقت البناء؛ تعديلها يستلزم بناء جديدًا. لا تضع أي اعتماد إداري أو مفتاح خاص فيها. أعلام الواجهة لا تحل محل قواعد الأمان.

يحفظ التسجيل `consentVersion` و`consentedAt` بتوقيت الخادم. يجب تحديث إصدار السياسة في `src/lib/privacy/policy.ts` وقواعد Firestore معًا عند تغييرها تغييرًا يتطلب تجديد الموافقة؛ الطالب القديم يجددها من `/student` دون تغيير قرار طلبه.

## هوية الخادم

Admin SDK يستخدم Application Default Credentials على الخادم فقط. في Google Cloud استخدم هوية خدمة مرتبطة ببيئة التشغيل، دون تحميل مفاتيح JSON. تحتاج قراءة مستخدمي Auth وقراءة/إنشاء/تحديث مستندات Firestore للعمليات الإدارية. لا تمنح Owner/Editor لخادم التطبيق. Admin يتجاوز Security Rules؛ لذلك كل API يتحقق من ID token وإبطاله وتعطيل الحساب والبريد الموثق والصلاحيات الحية.

محليًا استخدم ADC أو impersonation موثوقًا خارج المستودع وفق سياسة IAM. لا ترسل ملفات حساب خدمة في المحادثة. ملفات `.env.local` والمفاتيح مستثناة من Git. الجلسة في session persistence؛ لا يخزن التطبيق كلمات المرور أو يسجل tokens.

## الاختبارات

`npm run test:rules` يشغّل المحاكيات بمشروع `demo-tafaqquh` فقط، على loopback (Auth 9099 وFirestore 8080)، والاختبار التكاملي يشغّل Next dev على 3100 بإعدادات وهمية ويحظر اتصال المتصفح خارج localhost. يمسح بيانات المحاكي؛ لا تستخدم جلسة محاكاة تريد الاحتفاظ بها. لا يرسل بريدًا حقيقيًا.

للتشغيل اليدوي اضبط المشروع الوهمي في إعدادات Client وAdmin، والبيئة `local`، وعلمَي USE_EMULATORS إلى true، و`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` و`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`. يحظر Admin استخدام المحاكيات في بناء production. اختبارات المتصفح العادية تفحص البناء مع تعطيل المصادقة؛ اختبارات الأمان تفحص التجربة الفعلية بالمحاكي.

لم تُنشر قواعد أو فهارس أو موقع، ولم تُنشأ حسابات أو مواد في المشروع الحقيقي. نجاح المحاكيات لا يثبت صلاحية IAM أو تسليم البريد أو دعم محول الاستضافة. توجد تنبيهات تطوير متوسطة معروفة في تبعيات Firebase CLI؛ راجع `npm audit` قبل الإطلاق ولا تطبق تغييرات رئيسية قسرية دون اختبار.

المراجع: [Admin SDK](https://firebase.google.com/docs/admin/setup)، [قواعد الأمان](https://firebase.google.com/docs/firestore/security/rules-conditions)، [اختبار القواعد](https://firebase.google.com/docs/rules/unit-tests).

تحديث التشغيل: حزم Firebase المقفلة تتطلب Node.js >=24.12.0؛ لذلك أصبح engines وCI على سلسلة 24، دون تغيير إصدار Next.js أو حزم Firebase.
