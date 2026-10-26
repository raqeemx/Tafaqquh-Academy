// Replaced by authenticated, atomic decisions in /admin with actor identity and audit logs.
// Do not retain a second admission path that bypasses those checks.
console.error(
  "Use /admin to review students. For initial administrator provisioning, see docs/admin.md. No write was performed.",
);
process.exitCode = 1;
