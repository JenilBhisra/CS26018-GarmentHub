// Loads .env and switches Prisma to the separate TEST_DATABASE_URL database before any test
// file imports it. Tests refuse to run unless that database name ends in "_test".
import "./scripts/test-database-guard";
