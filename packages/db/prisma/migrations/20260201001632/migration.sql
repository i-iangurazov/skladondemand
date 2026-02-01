/*
  Warnings:

  - You are about to drop the column `address` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `CartItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CartItemModifier` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CategoryTranslation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `IdempotencyKey` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ImportAuditLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ImportJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ImportRow` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Menu` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MenuCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MenuChangeEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MenuItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MenuModifierGroup` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MenuModifierOption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Order` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderItemModifier` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderNotificationJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PaymentAllocation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PaymentIntent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PaymentQuote` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlatformSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlatformUser` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductTranslation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SplitPlan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StaffSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StaffUser` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Table` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TableOrder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TableSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Variant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VariantTranslation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Venue` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_menuItemId_fkey";

-- DropForeignKey
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "CartItemModifier" DROP CONSTRAINT "CartItemModifier_cartItemId_fkey";

-- DropForeignKey
ALTER TABLE "CategoryTranslation" DROP CONSTRAINT "CategoryTranslation_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "IdempotencyKey" DROP CONSTRAINT "IdempotencyKey_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "IdempotencyKey" DROP CONSTRAINT "IdempotencyKey_staffUserId_fkey";

-- DropForeignKey
ALTER TABLE "IdempotencyKey" DROP CONSTRAINT "IdempotencyKey_tableId_fkey";

-- DropForeignKey
ALTER TABLE "IdempotencyKey" DROP CONSTRAINT "IdempotencyKey_venueId_fkey";

-- DropForeignKey
ALTER TABLE "ImportAuditLog" DROP CONSTRAINT "ImportAuditLog_importJobId_fkey";

-- DropForeignKey
ALTER TABLE "ImportAuditLog" DROP CONSTRAINT "ImportAuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "ImportJob" DROP CONSTRAINT "ImportJob_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "ImportRow" DROP CONSTRAINT "ImportRow_importJobId_fkey";

-- DropForeignKey
ALTER TABLE "Menu" DROP CONSTRAINT "Menu_venueId_fkey";

-- DropForeignKey
ALTER TABLE "MenuCategory" DROP CONSTRAINT "MenuCategory_menuId_fkey";

-- DropForeignKey
ALTER TABLE "MenuCategory" DROP CONSTRAINT "MenuCategory_venueId_fkey";

-- DropForeignKey
ALTER TABLE "MenuChangeEvent" DROP CONSTRAINT "MenuChangeEvent_menuId_fkey";

-- DropForeignKey
ALTER TABLE "MenuChangeEvent" DROP CONSTRAINT "MenuChangeEvent_venueId_fkey";

-- DropForeignKey
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_menuId_fkey";

-- DropForeignKey
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_venueId_fkey";

-- DropForeignKey
ALTER TABLE "MenuModifierGroup" DROP CONSTRAINT "MenuModifierGroup_itemId_fkey";

-- DropForeignKey
ALTER TABLE "MenuModifierOption" DROP CONSTRAINT "MenuModifierOption_groupId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "Order" DROP CONSTRAINT IF EXISTS "Order_userId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_menuItemId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItemModifier" DROP CONSTRAINT "OrderItemModifier_orderItemId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "OrderNotificationJob" DROP CONSTRAINT IF EXISTS "OrderNotificationJob_orderId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentAllocation" DROP CONSTRAINT "PaymentAllocation_orderItemId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentAllocation" DROP CONSTRAINT "PaymentAllocation_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentIntent" DROP CONSTRAINT "PaymentIntent_orderId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentIntent" DROP CONSTRAINT "PaymentIntent_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentIntent" DROP CONSTRAINT "PaymentIntent_splitPlanId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentIntent" DROP CONSTRAINT "PaymentIntent_venueId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentQuote" DROP CONSTRAINT "PaymentQuote_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentQuote" DROP CONSTRAINT "PaymentQuote_splitPlanId_fkey";

-- DropForeignKey
ALTER TABLE "PlatformSession" DROP CONSTRAINT "PlatformSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "PlatformUser" DROP CONSTRAINT "PlatformUser_venueId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "ProductTranslation" DROP CONSTRAINT "ProductTranslation_productId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "SplitPlan" DROP CONSTRAINT "SplitPlan_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "StaffSession" DROP CONSTRAINT "StaffSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "StaffUser" DROP CONSTRAINT "StaffUser_venueId_fkey";

-- DropForeignKey
ALTER TABLE "Table" DROP CONSTRAINT "Table_venueId_fkey";

-- DropForeignKey
ALTER TABLE "TableOrder" DROP CONSTRAINT "TableOrder_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "TableOrder" DROP CONSTRAINT "TableOrder_tableId_fkey";

-- DropForeignKey
ALTER TABLE "TableOrder" DROP CONSTRAINT "TableOrder_venueId_fkey";

-- DropForeignKey
ALTER TABLE "TableSession" DROP CONSTRAINT "TableSession_tableId_fkey";

-- DropForeignKey
ALTER TABLE "TableSession" DROP CONSTRAINT "TableSession_venueId_fkey";

-- DropForeignKey
ALTER TABLE "Variant" DROP CONSTRAINT "Variant_productId_fkey";

-- DropForeignKey
ALTER TABLE "VariantTranslation" DROP CONSTRAINT "VariantTranslation_variantId_fkey";

-- DropIndex
DROP INDEX "User_phone_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "address",
DROP COLUMN "isActive",
DROP COLUMN "name",
DROP COLUMN "role",
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- DropTable
DROP TABLE "CartItem";

-- DropTable
DROP TABLE "CartItemModifier";

-- DropTable
DROP TABLE "Category";

-- DropTable
DROP TABLE "CategoryTranslation";

-- DropTable
DROP TABLE "IdempotencyKey";

-- DropTable
DROP TABLE "ImportAuditLog";

-- DropTable
DROP TABLE "ImportJob";

-- DropTable
DROP TABLE "ImportRow";

-- DropTable
DROP TABLE "Menu";

-- DropTable
DROP TABLE "MenuCategory";

-- DropTable
DROP TABLE "MenuChangeEvent";

-- DropTable
DROP TABLE "MenuItem";

-- DropTable
DROP TABLE "MenuModifierGroup";

-- DropTable
DROP TABLE "MenuModifierOption";

-- DropTable
DROP TABLE IF EXISTS "Order";

-- DropTable
DROP TABLE "OrderItem";

-- DropTable
DROP TABLE "OrderItemModifier";

-- DropTable
DROP TABLE IF EXISTS "OrderNotificationJob";

-- DropTable
DROP TABLE "PaymentAllocation";

-- DropTable
DROP TABLE "PaymentIntent";

-- DropTable
DROP TABLE "PaymentQuote";

-- DropTable
DROP TABLE "PlatformSession";

-- DropTable
DROP TABLE "PlatformUser";

-- DropTable
DROP TABLE "Product";

-- DropTable
DROP TABLE "ProductTranslation";

-- DropTable
DROP TABLE "Session";

-- DropTable
DROP TABLE "SplitPlan";

-- DropTable
DROP TABLE "StaffSession";

-- DropTable
DROP TABLE "StaffUser";

-- DropTable
DROP TABLE "Table";

-- DropTable
DROP TABLE "TableOrder";

-- DropTable
DROP TABLE "TableSession";

-- DropTable
DROP TABLE "Variant";

-- DropTable
DROP TABLE "VariantTranslation";

-- DropTable
DROP TABLE "Venue";

-- DropEnum
DROP TYPE "ImportJobStatus";

-- DropEnum
DROP TYPE "ImportRowStatus";

-- DropEnum
DROP TYPE "ImportSourceType";

-- DropEnum
DROP TYPE "Locale";

-- DropEnum
DROP TYPE "OrderStatus";

-- DropEnum
DROP TYPE "PaymentMode";

-- DropEnum
DROP TYPE "PaymentStatus";

-- DropEnum
DROP TYPE "StaffRole";

-- DropEnum
DROP TYPE "TableSessionStatus";

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "postalCode" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productHandle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "productHandle" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "authorName" TEXT,
    "authorEmail" TEXT,
    "avatarUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'import',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonusLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BonusLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_productHandle_key" ON "Favorite"("userId", "productHandle");

-- CreateIndex
CREATE INDEX "Review_productHandle_idx" ON "Review"("productHandle");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusLedger" ADD CONSTRAINT "BonusLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
