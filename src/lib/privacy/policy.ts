export const PRIVACY_VERSION = "2026-10-26.v1";
export const privacyDetails = {
  controller: process.env.NEXT_PUBLIC_PRIVACY_CONTROLLER ?? "",
  contact: process.env.NEXT_PUBLIC_PRIVACY_CONTACT ?? "",
  retention: process.env.NEXT_PUBLIC_PRIVACY_RETENTION ?? "",
};
export function isPrivacyApproved() {
  return (
    process.env.NEXT_PUBLIC_PRIVACY_POLICY_APPROVED === "true" &&
    Object.values(privacyDetails).every((value) => value.trim().length > 0)
  );
}
