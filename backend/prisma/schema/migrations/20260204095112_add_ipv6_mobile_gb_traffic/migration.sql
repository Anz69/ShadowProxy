-- AddColumn
ALTER TABLE "public"."users" ADD COLUMN "ipv6_gb_traffic_left" TEXT NOT NULL DEFAULT '0';

-- AddColumn
ALTER TABLE "public"."users" ADD COLUMN "mobile_gb_traffic_left" TEXT NOT NULL DEFAULT '0';


