/*
  Warnings:

  - Added the required column `auth_method` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "auth_method" "public"."AuthMethod" NOT NULL;
