/**
 * Validates critical environment variables required for startup.
 * Throws clean runtime startup errors if keys are missing.
 */
export function validateEnvironment() {
  const requiredEnv = [
    "DATABASE_URL",
    "AUTH_SECRET",
  ];

  const missing = requiredEnv.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const errorMsg = `
=========================================
⚠️ ENVIRONMENT VARIABLE CONFIGURATION ERROR
=========================================
Missing critical environment variables:
${missing.map((m) => `  - ${m}`).join("\n")}

Please configure these variables in your local '.env' file.
=========================================`;
    console.error(errorMsg);
    throw new Error(`Startup failed: Missing environment variables ${missing.join(", ")}`);
  }
}
