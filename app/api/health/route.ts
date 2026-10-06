import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  let dbStatus = "HEALTHY";
  let dbLatency = 0;

  try {
    const dbStart = Date.now();
    // Simple fast raw query to test database connection health
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - dbStart;
  } catch (err) {
    dbStatus = "UNHEALTHY";
    console.error("Database health check failure:", err);
  }

  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();

  const responseBody = {
    status: dbStatus === "HEALTHY" ? "OK" : "ERROR",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(uptime),
    database: {
      status: dbStatus,
      latencyMs: dbLatency,
    },
    system: {
      memory: {
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
      },
      nodeVersion: process.version,
      platform: process.platform,
    },
    latencyMs: Date.now() - start,
  };

  const status = dbStatus === "HEALTHY" ? 200 : 503;
  return NextResponse.json(responseBody, { status });
}
