CREATE TABLE "image" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"ownerId" text NOT NULL,
	"organizationId" text NOT NULL,
	"uploaderId" text NOT NULL,
	"uploadedAt" timestamp NOT NULL,
	"thumbhash" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"state" text NOT NULL,
	"notScreened" boolean NOT NULL,
	"scores" jsonb NOT NULL,
	"decidedBy" text,
	"decidedAt" timestamp,
	"detachedAt" timestamp,
	CONSTRAINT "image_state" CHECK ("image"."state" IN ('approved', 'in_review', 'rejected')),
	CONSTRAINT "image_kind" CHECK ("image"."kind" IN ('event_banner', 'organization_logo'))
);
--> statement-breakpoint
CREATE TABLE "screening_policy" (
	"category" text PRIMARY KEY NOT NULL,
	"lower" double precision NOT NULL,
	"upper" double precision NOT NULL,
	CONSTRAINT "screening_policy_cut_offs" CHECK (0 <= "screening_policy"."lower" AND "screening_policy"."lower" <= "screening_policy"."upper" AND "screening_policy"."upper" <= 1)
);
--> statement-breakpoint
ALTER TABLE "image" ADD CONSTRAINT "image_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image" ADD CONSTRAINT "image_uploaderId_user_id_fk" FOREIGN KEY ("uploaderId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image" ADD CONSTRAINT "image_decidedBy_user_id_fk" FOREIGN KEY ("decidedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_owner" ON "image" USING btree ("kind","ownerId");--> statement-breakpoint
CREATE INDEX "image_uploader_uploaded_at" ON "image" USING btree ("uploaderId","uploadedAt");--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "bannerImage";--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN "logo";