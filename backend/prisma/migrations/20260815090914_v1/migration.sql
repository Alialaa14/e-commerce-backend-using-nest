-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'brand', 'admin', 'delievryC', 'courier');

-- CreateEnum
CREATE TYPE "otpPurpose" AS ENUM ('resetpassword', 'signup');

-- CreateEnum
CREATE TYPE "orderStatus" AS ENUM ('pending', 'accepted', 'rejected', 'packing', 'shipping', 'delivering', 'delivered', 'returned');

-- CreateEnum
CREATE TYPE "brand_verification_tier" AS ENUM ('pending', 'basic_verification', 'full_verification', 'suspended');

-- CreateEnum
CREATE TYPE "BrandDocType" AS ENUM ('trademark_certificate', 'business_registration', 'representative_id', 'proof_of_address', 'shop_photo', 'product_packaging', 'social_platform', 'website', 'invoice_sample');

-- CreateEnum
CREATE TYPE "courierDocuments" AS ENUM ('nationalId', 'drivingLicense', 'vehicleRegistration', 'plateNumber');

-- CreateEnum
CREATE TYPE "brand_doc_rejection_reason" AS ENUM ('illegible', 'expired', 'name_mismatch', 'wrong_doc_type', 'incomplete', 'unsupported_format', 'suspected_fraud', 'other');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'user',
    "password" TEXT NOT NULL,
    "picture_url" TEXT,
    "picture_url_id" TEXT,
    "otp" TEXT,
    "otp_expiration" TIMESTAMP(3),
    "otp_purpose" "otpPurpose",
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "refreshToken" TEXT,
    "created_At" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_At" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_id" TEXT,
    "passwordChangedAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "brandDocumentId" UUID,
    "wishlistUserId" UUID,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "brand_name" TEXT NOT NULL,
    "verification_status" "brand_verification_tier" NOT NULL DEFAULT 'pending',
    "rating" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "logo_url" TEXT,
    "logo_url_id" TEXT,
    "followers_count" INTEGER NOT NULL DEFAULT 0,
    "viewed_times" INTEGER NOT NULL DEFAULT 0,
    "is_promoted" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_details" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_branches" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "branch_name" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "place_id" TEXT,
    "formatted_address" TEXT,
    "address_line" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postal_code" TEXT,
    "location_granularity" TEXT,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_documents" (
    "document_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "doc_type" "BrandDocType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_url_id" TEXT NOT NULL,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rejectionReason" "brand_doc_rejection_reason",

    CONSTRAINT "brand_documents_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "brand_social_links" (
    "brand_id" UUID NOT NULL,
    "platform" VARCHAR(30) NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "brand_social_links_pkey" PRIMARY KEY ("brand_id","platform")
);

-- CreateTable
CREATE TABLE "brand_followers" (
    "brand_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "followed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_followers_pkey" PRIMARY KEY ("brand_id","user_id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "media" JSONB[],
    "description" TEXT NOT NULL,
    "brand_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "discount" INTEGER DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wishlistUserId" UUID,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "color" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "cartId" UUID NOT NULL,
    "orderOrderId" UUID,

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "category_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "media" JSONB NOT NULL,
    "ishidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "productId" UUID,
    "content" TEXT NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "discount" INTEGER,
    "cartNote" TEXT,
    "userLocation" TEXT NOT NULL,
    "userNumber" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist" (
    "userId" UUID NOT NULL,

    CONSTRAINT "wishlist_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Order" (
    "orderId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "discount" INTEGER,
    "status" "orderStatus" NOT NULL DEFAULT 'pending',
    "otp" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "deliveryCId" UUID NOT NULL,
    "courierId" UUID,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "OrderBrand" (
    "orderId" UUID NOT NULL,
    "brandId" UUID NOT NULL,

    CONSTRAINT "OrderBrand_pkey" PRIMARY KEY ("orderId","brandId")
);

-- CreateTable
CREATE TABLE "D_Company" (
    "deliveryCompany" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "balance" INTEGER NOT NULL,

    CONSTRAINT "D_Company_pkey" PRIMARY KEY ("deliveryCompany")
);

-- CreateTable
CREATE TABLE "Courier" (
    "id" UUID NOT NULL,
    "photo_url" TEXT NOT NULL,
    "photo_id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "documents" "courierDocuments"[],
    "plateNumber" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "delieveryCId" UUID NOT NULL,

    CONSTRAINT "Courier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "brands_user_id_key" ON "brands"("user_id");

-- CreateIndex
CREATE INDEX "brand_branches_brand_id_idx" ON "brand_branches"("brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "variants_cartId_key" ON "variants"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "variants_product_id_color_size_key" ON "variants"("product_id", "color", "size");

-- CreateIndex
CREATE UNIQUE INDEX "Category_category_name_key" ON "Category"("category_name");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_userId_key" ON "wishlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_deliveryCId_key" ON "Order"("deliveryCId");

-- CreateIndex
CREATE UNIQUE INDEX "Courier_delieveryCId_key" ON "Courier"("delieveryCId");

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_branches" ADD CONSTRAINT "brand_branches_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_documents" ADD CONSTRAINT "brand_documents_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_documents" ADD CONSTRAINT "brand_documents_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_social_links" ADD CONSTRAINT "brand_social_links_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_followers" ADD CONSTRAINT "brand_followers_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_followers" ADD CONSTRAINT "brand_followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_wishlistUserId_fkey" FOREIGN KEY ("wishlistUserId") REFERENCES "wishlist"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_orderOrderId_fkey" FOREIGN KEY ("orderOrderId") REFERENCES "Order"("orderId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryCId_fkey" FOREIGN KEY ("deliveryCId") REFERENCES "D_Company"("deliveryCompany") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBrand" ADD CONSTRAINT "OrderBrand_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("orderId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBrand" ADD CONSTRAINT "OrderBrand_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courier" ADD CONSTRAINT "Courier_delieveryCId_fkey" FOREIGN KEY ("delieveryCId") REFERENCES "D_Company"("deliveryCompany") ON DELETE RESTRICT ON UPDATE CASCADE;
