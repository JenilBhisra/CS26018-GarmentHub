import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Datasets ===");
  const datasets = await prisma.marketDataset.findMany({
    orderBy: { createdAt: "desc" },
    take: 5
  });
  console.dir(datasets, { depth: null });

  console.log("\n=== Insights ===");
  const insights = await prisma.marketInsight.findMany({
    take: 10
  });
  console.dir(insights, { depth: null });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
