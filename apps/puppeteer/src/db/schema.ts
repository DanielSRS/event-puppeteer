import { pgTable, text, timestamp, boolean, integer, doublePrecision, jsonb, primaryKey } from "drizzle-orm/pg-core";

export const organization = pgTable("organization", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	description: text("description"),
	logo: text("logo"),
	url: text("url"),
	colorScheme: text("colorScheme"),
	location: text("location"),
	latitude: doublePrecision("latitude"),
	longitude: doublePrecision("longitude"),
	shadowBanThreshold: integer("shadowBanThreshold").notNull().default(5),
	createdAt: timestamp("createdAt").notNull(),
	updatedAt: timestamp("updatedAt").notNull()
});

export const user = pgTable("user", {
	// Better Auth base fields
	id: text("id").primaryKey(),
	name: text("name").notNull(), // better-auth generic name
	email: text("email").notNull().unique(),
	emailVerified: boolean("emailVerified").notNull(),
	image: text("image"),
	createdAt: timestamp("createdAt").notNull(),
	updatedAt: timestamp("updatedAt").notNull(),
	
	// Our app-specific User fields
	firstName: text("firstName").notNull().default(""),
	lastName: text("lastName").notNull().default(""),
	normalizedName: text("normalizedName").notNull().default(""),
	organizationId: text("organizationId").references(() => organization.id),
	role: text("role").notNull().default('Member'),
	isShadowBanned: boolean("isShadowBanned").notNull().default(false)
});

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expiresAt").notNull(),
	token: text("token").notNull().unique(),
	createdAt: timestamp("createdAt").notNull(),
	updatedAt: timestamp("updatedAt").notNull(),
	ipAddress: text("ipAddress"),
	userAgent: text("userAgent"),
	userId: text("userId").notNull().references(() => user.id)
});

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text("accountId").notNull(),
	providerId: text("providerId").notNull(),
	userId: text("userId").notNull().references(() => user.id),
	accessToken: text("accessToken"),
	refreshToken: text("refreshToken"),
	idToken: text("idToken"),
	accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
	refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("createdAt").notNull(),
	updatedAt: timestamp("updatedAt").notNull()
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expiresAt").notNull(),
	createdAt: timestamp("createdAt"),
	updatedAt: timestamp("updatedAt")
});


export const tag = pgTable("tag", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	isSystemDefined: boolean("isSystemDefined").notNull().default(false)
});

export const linkLabel = pgTable("link_label", {
	id: text("id").primaryKey(),
	name: text("name").notNull()
});

export const event = pgTable("event", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	description: text("description").notNull(),
	location: text("location").notNull(),
	latitude: doublePrecision("latitude"),
	longitude: doublePrecision("longitude"),
	bannerImage: text("bannerImage"),
	creatorId: text("creatorId").notNull().references(() => user.id),
	organizationId: text("organizationId").notNull().references(() => organization.id),
	isHidden: boolean("isHidden").notNull().default(false),
	isDeleted: boolean("isDeleted").notNull().default(false),
	createdAt: timestamp("createdAt").notNull(),
	schedule: jsonb("schedule").notNull(),
	tags: jsonb("tags").notNull(),
	links: jsonb("links").notNull()
});

export const vote = pgTable("vote", {
	userId: text("userId").notNull().references(() => user.id),
	eventId: text("eventId").notNull().references(() => event.id),
	createdAt: timestamp("createdAt").notNull()
}, (t) => ({
	pk: primaryKey({ columns: [t.userId, t.eventId] })
}));

export const report = pgTable("report", {
	id: text("id").primaryKey(),
	reporterId: text("reporterId").notNull().references(() => user.id),
	eventId: text("eventId").notNull().references(() => event.id),
	reason: text("reason").notNull(),
	comment: text("comment"),
	createdAt: timestamp("createdAt").notNull()
});

export const audit = pgTable("audit", {
	id: text("id").primaryKey(),
	actorId: text("actorId").references(() => user.id),
	organizationId: text("organizationId").references(() => organization.id),
	action: text("action").notNull(),
	targetType: text("targetType").notNull(),
	targetId: text("targetId").notNull(),
	details: jsonb("details"),
	createdAt: timestamp("createdAt").notNull()
});

export const device = pgTable("device", {
	id: text("id").primaryKey(),
	name: text("name"),
	location: text("location"),
	organizationId: text("organizationId").references(() => organization.id),
	status: text("status").notNull(),
	connectedAt: timestamp("connectedAt").notNull(),
	approvedAt: timestamp("approvedAt"),
	approvedBy: text("approvedBy").references(() => user.id),
	tokenHash: text("tokenHash").notNull()
});

export const telemetryHeartbeat = pgTable("telemetry_heartbeat", {
	deviceId: text("deviceId").notNull().references(() => device.id),
	timestamp: timestamp("timestamp").notNull(),
	status: text("status").notNull(),
	errors: jsonb("errors")
}, (t) => ({
	pk: primaryKey({ columns: [t.deviceId, t.timestamp] })
}));

export const telemetryLog = pgTable("telemetry_log", {
	id: text("id").primaryKey(),
	deviceId: text("deviceId").notNull().references(() => device.id),
	level: text("level").notNull(),
	message: text("message").notNull(),
	timestamp: timestamp("timestamp").notNull()
});

export const telemetryData = pgTable("telemetry_data", {
	deviceId: text("deviceId").primaryKey().references(() => device.id),
	data: jsonb("data").notNull() // store all DeviceTelemetry fields
});

export const command = pgTable("command", {
	id: text("id").primaryKey(),
	deviceId: text("deviceId").notNull().references(() => device.id),
	type: text("type").notNull(),
	payload: jsonb("payload"),
	status: text("status").notNull(),
	issuedBy: text("issuedBy").notNull().references(() => user.id),
	issuedAt: timestamp("issuedAt").notNull(),
	completedAt: timestamp("completedAt")
});
