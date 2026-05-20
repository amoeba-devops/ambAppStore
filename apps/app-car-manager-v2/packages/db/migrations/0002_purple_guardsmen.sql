CREATE TABLE "car_push_subscriptions" (
	"psh_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"psh_user_id" char(36) NOT NULL,
	"psh_endpoint" text NOT NULL,
	"psh_p256dh" varchar(200) NOT NULL,
	"psh_auth" varchar(100) NOT NULL,
	"psh_user_agent" text,
	"psh_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"psh_last_used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "car_push_subscriptions" ADD CONSTRAINT "car_push_subscriptions_psh_user_id_car_users_usr_id_fk" FOREIGN KEY ("psh_user_id") REFERENCES "public"."car_users"("usr_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_car_push_subscriptions_endpoint" ON "car_push_subscriptions" USING btree ("psh_endpoint");--> statement-breakpoint
CREATE INDEX "idx_car_push_subscriptions_user" ON "car_push_subscriptions" USING btree ("ent_id","psh_user_id");