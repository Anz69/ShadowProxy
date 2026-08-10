-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "referrer_id" TEXT;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
