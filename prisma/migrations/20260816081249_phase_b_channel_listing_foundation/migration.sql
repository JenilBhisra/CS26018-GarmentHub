-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('NATIVE', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ChannelConnectionStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'ERROR', 'PENDING');

-- CreateEnum
CREATE TYPE "ChannelListingStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'FAILED', 'PAUSED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "channelId" TEXT,
ADD COLUMN     "externalOrderId" TEXT;

-- CreateTable
CREATE TABLE "SalesChannel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL DEFAULT 'EXTERNAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerChannelAccount" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" "ChannelConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "externalAccountId" TEXT,
    "displayName" TEXT,
    "credentials" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerChannelAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelListing" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "sellerChannelAccountId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "externalListingId" TEXT,
    "channelSku" TEXT,
    "priceOverride" DECIMAL(12,2),
    "status" "ChannelListingStatus" NOT NULL DEFAULT 'DRAFT',
    "syncError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesChannel_code_key" ON "SalesChannel"("code");

-- CreateIndex
CREATE INDEX "SellerChannelAccount_sellerId_idx" ON "SellerChannelAccount"("sellerId");

-- CreateIndex
CREATE INDEX "SellerChannelAccount_channelId_idx" ON "SellerChannelAccount"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerChannelAccount_sellerId_channelId_externalAccountId_key" ON "SellerChannelAccount"("sellerId", "channelId", "externalAccountId");

-- CreateIndex
CREATE INDEX "ChannelListing_variantId_idx" ON "ChannelListing"("variantId");

-- CreateIndex
CREATE INDEX "ChannelListing_sellerChannelAccountId_idx" ON "ChannelListing"("sellerChannelAccountId");

-- CreateIndex
CREATE INDEX "ChannelListing_channelId_idx" ON "ChannelListing"("channelId");

-- CreateIndex
CREATE INDEX "ChannelListing_status_idx" ON "ChannelListing"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelListing_variantId_channelId_key" ON "ChannelListing"("variantId", "channelId");

-- CreateIndex
CREATE INDEX "Order_channelId_idx" ON "Order"("channelId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "SalesChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerChannelAccount" ADD CONSTRAINT "SellerChannelAccount_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerChannelAccount" ADD CONSTRAINT "SellerChannelAccount_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "SalesChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelListing" ADD CONSTRAINT "ChannelListing_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelListing" ADD CONSTRAINT "ChannelListing_sellerChannelAccountId_fkey" FOREIGN KEY ("sellerChannelAccountId") REFERENCES "SellerChannelAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelListing" ADD CONSTRAINT "ChannelListing_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "SalesChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
