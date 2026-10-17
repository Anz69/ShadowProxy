-- AlterEnum: роль поддержки — админка только с разделом «Поддержка».
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPPORT';
