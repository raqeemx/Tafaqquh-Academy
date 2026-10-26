export function authError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-email":
      return "تعذّر تسجيل الدخول. راجع البريد وكلمة المرور.";
    case "auth/email-already-in-use":
      return "تعذّر إنشاء الحساب. جرّب الدخول أو استعادة كلمة المرور.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "كلمة المرور لا تستوفي سياسة الأمان. استخدم كلمة أطول وأكثر تنوعًا.";
    case "auth/too-many-requests":
      return "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.";
    case "auth/network-request-failed":
    case "unavailable":
      return "تعذّر الاتصال. تحقق من الشبكة ثم حاول مجددًا.";
    case "permission-denied":
      return "تعذّر الوصول إلى بيانات التسجيل. تواصل مع إدارة الأكاديمية.";
    default:
      return "تعذّر إتمام العملية. حاول لاحقًا، أو تواصل مع إدارة الأكاديمية إذا استمرت المشكلة.";
  }
}
