export const PRODUCTION_PROJECT = "tafaqquh-academy";
export const EMULATOR_PROJECT = "demo-tafaqquh";
export function validFirebaseTarget(
  environment: string,
  projectId: string | undefined,
  emulated: boolean,
  stagingProjectId: string | undefined,
) {
  if (!projectId) return false;
  if (emulated)
    return environment === "local" && projectId === EMULATOR_PROJECT;
  if (environment === "production") return projectId === PRODUCTION_PROJECT;
  if (environment === "staging")
    return Boolean(
      stagingProjectId &&
      projectId === stagingProjectId &&
      projectId !== PRODUCTION_PROJECT &&
      !projectId.startsWith("demo-"),
    );
  return environment === "local" && projectId === PRODUCTION_PROJECT;
}
