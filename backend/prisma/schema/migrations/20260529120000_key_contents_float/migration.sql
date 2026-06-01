-- Часть 4.3: разрешить дробный объём (МБ) у ключей — contents Int → Float.
ALTER TABLE "keys" ALTER COLUMN "contents" SET DATA TYPE DOUBLE PRECISION;
