CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit" (
	"id" text PRIMARY KEY NOT NULL,
	"actorId" text,
	"organizationId" text,
	"action" text NOT NULL,
	"targetType" text NOT NULL,
	"targetId" text NOT NULL,
	"details" jsonb,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "command" (
	"id" text PRIMARY KEY NOT NULL,
	"deviceId" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	"status" text NOT NULL,
	"issuedBy" text NOT NULL,
	"issuedAt" timestamp NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "device" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"location" text,
	"organizationId" text,
	"status" text NOT NULL,
	"connectedAt" timestamp NOT NULL,
	"approvedAt" timestamp,
	"approvedBy" text,
	"tokenHash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"location" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"bannerImage" text,
	"creatorId" text NOT NULL,
	"organizationId" text NOT NULL,
	"isHidden" boolean DEFAULT false NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp NOT NULL,
	"schedule" jsonb NOT NULL,
	"tags" jsonb NOT NULL,
	"links" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_label" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"shadowBanThreshold" integer DEFAULT 5 NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" text PRIMARY KEY NOT NULL,
	"reporterId" text NOT NULL,
	"eventId" text NOT NULL,
	"reason" text NOT NULL,
	"comment" text,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"isSystemDefined" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_data" (
	"deviceId" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_heartbeat" (
	"deviceId" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"status" text NOT NULL,
	"errors" jsonb,
	CONSTRAINT "telemetry_heartbeat_deviceId_timestamp_pk" PRIMARY KEY("deviceId","timestamp")
);
--> statement-breakpoint
CREATE TABLE "telemetry_log" (
	"id" text PRIMARY KEY NOT NULL,
	"deviceId" text NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"timestamp" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean NOT NULL,
	"image" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"firstName" text DEFAULT '' NOT NULL,
	"lastName" text DEFAULT '' NOT NULL,
	"normalizedName" text DEFAULT '' NOT NULL,
	"organizationId" text,
	"role" text DEFAULT 'Member' NOT NULL,
	"isShadowBanned" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp,
	"updatedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "vote" (
	"userId" text NOT NULL,
	"eventId" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	CONSTRAINT "vote_userId_eventId_pk" PRIMARY KEY("userId","eventId")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit" ADD CONSTRAINT "audit_actorId_user_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit" ADD CONSTRAINT "audit_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command" ADD CONSTRAINT "command_deviceId_device_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."device"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command" ADD CONSTRAINT "command_issuedBy_user_id_fk" FOREIGN KEY ("issuedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device" ADD CONSTRAINT "device_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device" ADD CONSTRAINT "device_approvedBy_user_id_fk" FOREIGN KEY ("approvedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_creatorId_user_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_reporterId_user_id_fk" FOREIGN KEY ("reporterId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_eventId_event_id_fk" FOREIGN KEY ("eventId") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_data" ADD CONSTRAINT "telemetry_data_deviceId_device_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."device"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_heartbeat" ADD CONSTRAINT "telemetry_heartbeat_deviceId_device_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."device"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_log" ADD CONSTRAINT "telemetry_log_deviceId_device_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."device"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_eventId_event_id_fk" FOREIGN KEY ("eventId") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;