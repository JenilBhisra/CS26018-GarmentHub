import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const datasets = await prisma.marketDataset.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { insights: true }
      }
    }
  });
  console.log("=== Dataset processing summary ===");
  datasets.forEach(d => {
    console.log(`ID: ${d.id}`);
    console.log(`  File: ${d.fileName} (${d.originalName})`);
    console.log(`  Status: ${d.status}`);
    console.log(`  Rows: ${d.rowCount}`);
    console.log(`  Columns: ${JSON.stringify(d.columns)}`);
    console.log(`  Insights Count: ${d._count.insights}`);
    console.log(`  Processed At: ${d.processedAt}`);
    console.log(`  ErrorMessage: ${d.errorMessage}`);
    console.log("------------------------------------------------");
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
