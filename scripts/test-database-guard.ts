// Safety guard for every test that writes to PostgreSQL (the Vitest suites and the manual
// test-*.ts scripts in this folder). These tests create, change and delete real rows, so they
// must never run against the normal development database. They only run when
// TEST_DATABASE_URL points to a separate database whose name ends in "_test"; that URL then
// replaces DATABASE_URL for the current process before Prisma connects.
import { config } from "dotenv";

config({ path: ".env" });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Add a separate test database URL (its name must end in _test) to .env. See README."
  );
}

let databaseName = "";
try {
  databaseName = decodeURIComponent(new URL(testUrl).pathname.replace(/^\//, ""));
} catch {
  throw new Error("TEST_DATABASE_URL is not a valid database URL.");
}

if (!databaseName.endsWith("_test")) {
  throw new Error(
    `Refusing to run tests: the database in TEST_DATABASE_URL ("${databaseName}") does not end in "_test".`
  );
}

process.env.DATABASE_URL = testUrl;
