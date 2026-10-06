import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    include: {
      seller: true,
      items: true,
    }
  });

  console.log(`=== ALL ORDERS IN DATABASE (${orders.length}) ===`);
  for (const o of orders) {
    console.log(
      `- Order ID: ${o.id} | Order Number: ${o.orderNumber} | Total: ${o.totalAmount} | Seller: ${o.seller?.storeName} | Status: ${o.status}`
    );
  }

  const wallets = await prisma.sellerWallet.findMany({
    include: {
      seller: true,
    }
  });
  console.log(`\n=== ALL WALLETS IN DATABASE ===`);
  for (const w of wallets) {
    console.log(
      `- Wallet ID: ${w.id} | Seller: ${w.seller?.storeName} | Available: ${w.availableBalance} | Pending: ${w.pendingBalance} | Withdrawable: ${w.withdrawableBalance}`
    );
  }
}

main().catch(err => {
  console.error(err);
});
