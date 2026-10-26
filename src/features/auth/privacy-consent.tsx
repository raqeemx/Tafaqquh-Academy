import Link from "next/link";
import { PRIVACY_VERSION, isPrivacyApproved } from "@/lib/privacy/policy";
export function ConsentCheckbox({ disabled = false }: { disabled?: boolean }) {
  return (
    <div className="consent-block">
      <label className="consent-check">
        <input
          type="checkbox"
          name="consent"
          required
          disabled={disabled || !isPrivacyApproved()}
        />
        <span>
          قرأت{" "}
          <Link href="/privacy" target="_blank" rel="noopener noreferrer">
            سياسة الخصوصية
          </Link>{" "}
          وأوافق صراحةً على جمع اسمي وبريدي وبيانات طلبي لإدارة التسجيل
          والتعلّم.
        </span>
      </label>
      <p className="quiet">
        إصدار الموافقة: {PRIVACY_VERSION}. يُحفظ تاريخ الموافقة مع طلبك.
      </p>
      {!isPrivacyApproved() && (
        <p className="notice">
          نص السياسة قيد مراجعة الإدارة. إنشاء الطلبات الجديدة متوقف حتى
          اعتماده.
        </p>
      )}
    </div>
  );
}
