import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  schedulerName: text("scheduler_name").notNull(),
  category: text("category").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  startTime: text("start_time").notNull(), // HH:MM format
  endTime: text("end_time").notNull(), // HH:MM format
  location: text("location").notNull(),
  status: text("status").notNull(), // "confirmed" or "tentative"
  ddfsAttendees: text("ddfs_attendees").array().notNull().default([]), // Array of attendee names
  mandatoryAttendees: text("mandatory_attendees").array().notNull().default([]), // Subset of ddfsAttendees that are mandatory
  brandAttendees: text("brand_attendees").array().notNull().default([]), // JSON strings of {name, designation}
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({
  id: true,
});

export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetings.$inferSelect;

// Legacy category mappings (deprecated - use dynamic categories table instead)
export const CATEGORY_ATTENDEES = {
  liquor: ['Varun Khanna', 'Vishwanath Iyer', 'Chiragh Oberoi', 'Ashish Chopra'],
  tobacco: ['Varun Khanna', 'Vishwanath Iyer', 'Chiragh Oberoi', 'Ashish Chopra'],
  pnc: ['Payal Lal', 'Vishwanath Iyer', 'Chiragh Oberoi', 'Ashish Chopra'],
  confectionary: ['Payal Lal', 'Vishwanath Iyer', 'Chiragh Oberoi', 'Ashish Chopra'],
  fashion: ['Payal Lal', 'Vishwanath Iyer', 'Chiragh Oberoi', 'Ashish Chopra'],
  destination: ['Varun Khanna', 'Payal Lal', 'Vishwanath Iyer', 'Chiragh Oberoi', 'Ashish Chopra', 'Abhijit Das']
} as const;

export const CATEGORY_COLORS = {
  liquor: '#A52A2A',
  tobacco: '#D2691E',
  confectionary: '#FFD700',
  pnc: '#CD5C5C',
  fashion: '#3CB371',
  destination: '#4169E1'
} as const;

export type CategoryKey = keyof typeof CATEGORY_ATTENDEES;

// User authentication and roles
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(), // "admin", "liquor_tobacco", "pnc_confectionary_fashion", "guest"
  customPermissions: text("custom_permissions").default("{}"), // JSON string for custom permissions
  timezone: text("timezone").default("Europe/Berlin"), // User's preferred timezone (CEST)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// User roles and permissions
export const USER_ROLES = {
  admin: {
    name: "Administrator",
    permissions: {
      canView: true,
      canSchedule: true,
      canEdit: true,
      categories: ["liquor", "tobacco", "pnc", "confectionary", "fashion", "destination"]
    }
  },
  liquor_tobacco: {
    name: "Liquor & Tobacco Manager",
    permissions: {
      canView: true,
      canSchedule: true,
      canEdit: true,
      categories: ["liquor", "tobacco"] as Category[]
    }
  },
  pnc_confectionary_fashion: {
    name: "PNC, Confectionary & Fashion Manager",
    permissions: {
      canView: true,
      canSchedule: true,
      canEdit: true,
      categories: ["pnc", "confectionary", "fashion"] as Category[]
    }
  },
  guest: {
    name: "Guest",
    permissions: {
      canView: true,
      canSchedule: false,
      canEdit: false,
      categories: [] as Category[]
    }
  },
  vendor: {
    name: "Vendor",
    permissions: {
      canView: false,
      canSchedule: true,
      canEdit: false,
      categories: ["liquor", "tobacco", "pnc", "confectionary", "fashion", "destination"] as Category[]
    }
  }
} as const;

export type UserRole = keyof typeof USER_ROLES;

// DDFS Attendees table
export const ddfsAttendees = pgTable("ddfs_attendees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  categories: text("categories").array().notNull().default([]),
  whatsappNumber: text("whatsapp_number"),
  whatsappContactId: text("whatsapp_contact_id"),
  enableWhatsappAlerts: boolean("enable_whatsapp_alerts").default(false),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDdfsAttendeeSchema = createInsertSchema(ddfsAttendees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDdfsAttendee = z.infer<typeof insertDdfsAttendeeSchema>;
export type DdfsAttendee = typeof ddfsAttendees.$inferSelect;

// Global settings table
export const globalSettings = pgTable("global_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  description: text("description"),
  updatedBy: integer("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertGlobalSettingSchema = createInsertSchema(globalSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertGlobalSetting = z.infer<typeof insertGlobalSettingSchema>;
export type GlobalSetting = typeof globalSettings.$inferSelect;

// Change logs table for tracking system modifications
export const changeLogs = pgTable("change_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(), // "create", "update", "delete"
  entityType: text("entity_type").notNull(), // "user", "meeting", "attendee", "setting"
  entityId: text("entity_id"), // ID of the affected entity
  changes: text("changes").notNull(), // JSON string of changes made
  userId: integer("user_id").references(() => users.id).notNull(),
  userEmail: text("user_email").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

export const insertChangeLogSchema = createInsertSchema(changeLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertChangeLog = z.infer<typeof insertChangeLogSchema>;
export type ChangeLog = typeof changeLogs.$inferSelect;

// User date settings table for calendar default dates
export const userDateSettings = pgTable("user_date_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  defaultStartDate: text("default_start_date").notNull(), // YYYY-MM-DD format
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserDateSettingsSchema = createInsertSchema(userDateSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserDateSettings = z.infer<typeof insertUserDateSettingsSchema>;
export type UserDateSettings = typeof userDateSettings.$inferSelect;

// Timezone constants and options
export const TIMEZONE_OPTIONS = [
  { value: "Europe/Berlin", label: "Central European Time (CEST)", offset: "+02:00" },
  { value: "Europe/London", label: "British Summer Time (BST)", offset: "+01:00" },
  { value: "America/New_York", label: "Eastern Daylight Time (EDT)", offset: "-04:00" },
  { value: "America/Chicago", label: "Central Daylight Time (CDT)", offset: "-05:00" },
  { value: "America/Denver", label: "Mountain Daylight Time (MDT)", offset: "-06:00" },
  { value: "America/Los_Angeles", label: "Pacific Daylight Time (PDT)", offset: "-07:00" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST)", offset: "+09:00" },
  { value: "Asia/Shanghai", label: "China Standard Time (CST)", offset: "+08:00" },
  { value: "Asia/Kolkata", label: "India Standard Time (IST)", offset: "+05:30" },
  { value: "Australia/Sydney", label: "Australian Eastern Daylight Time (AEDT)", offset: "+11:00" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)", offset: "+00:00" },
] as const;

export const DEFAULT_TIMEZONE = "Europe/Berlin";

export type TimezoneValue = typeof TIMEZONE_OPTIONS[number]["value"];

// User onboarding table
export const userOnboarding = pgTable("user_onboarding", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false).notNull(),
  lastOnboardingVersion: varchar("last_onboarding_version", { length: 20 }),
  onboardingSkippedAt: timestamp("onboarding_skipped_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UserOnboarding = typeof userOnboarding.$inferSelect;
export type InsertUserOnboarding = typeof userOnboarding.$inferInsert;

// User notification preferences table for Smart Notification Optimizer
export const userNotificationPreferences = pgTable("user_notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  category: varchar("category").notNull(),
  emailEnabled: boolean("email_enabled").default(true),
  emailAdvanceMinutes: integer("email_advance_minutes").default(30),
  whatsappEnabled: boolean("whatsapp_enabled").default(false),
  whatsappAdvanceMinutes: integer("whatsapp_advance_minutes").default(15),
  smsEnabled: boolean("sms_enabled").default(false),
  smsAdvanceMinutes: integer("sms_advance_minutes").default(10),
  pushEnabled: boolean("push_enabled").default(true),
  pushAdvanceMinutes: integer("push_advance_minutes").default(5),
  reminderEnabled: boolean("reminder_enabled").default(true),
  reminderAdvanceMinutes: integer("reminder_advance_minutes").default(60),
  isOptimized: boolean("is_optimized").default(false),
  lastOptimizedAt: timestamp("last_optimized_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UserNotificationPreferences = typeof userNotificationPreferences.$inferSelect;
export type InsertUserNotificationPreferences = typeof userNotificationPreferences.$inferInsert;

// Notification behavior tracking table for analytics
export const notificationBehaviorTracking = pgTable("notification_behavior_tracking", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  meetingId: integer("meeting_id").references(() => meetings.id),
  category: varchar("category").notNull(),
  notificationType: varchar("notification_type").notNull(), // email, whatsapp, sms, push, reminder
  sentAt: timestamp("sent_at").notNull(),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  respondedAt: timestamp("responded_at"),
  responseType: varchar("response_type"), // accepted, declined, tentative, no_response
  meetingAttended: boolean("meeting_attended"),
  advanceMinutes: integer("advance_minutes").notNull(),
  timeOfDay: varchar("time_of_day").notNull(), // morning, afternoon, evening
  dayOfWeek: varchar("day_of_week").notNull(),
  deviceType: varchar("device_type"), // mobile, desktop, tablet
  createdAt: timestamp("created_at").defaultNow(),
});

export type NotificationBehaviorTracking = typeof notificationBehaviorTracking.$inferSelect;
export type InsertNotificationBehaviorTracking = typeof notificationBehaviorTracking.$inferInsert;

// Smart notification recommendations table
export const notificationRecommendations = pgTable("notification_recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  category: varchar("category").notNull(),
  recommendationType: varchar("recommendation_type").notNull(), // timing, channel, frequency
  currentSetting: text("current_setting").notNull(),
  recommendedSetting: text("recommended_setting").notNull(),
  confidenceScore: integer("confidence_score").notNull(), // 0-100
  reasoning: text("reasoning").notNull(),
  potentialImprovement: text("potential_improvement"),
  isApplied: boolean("is_applied").default(false),
  appliedAt: timestamp("applied_at"),
  dismissedAt: timestamp("dismissed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type NotificationRecommendations = typeof notificationRecommendations.$inferSelect;
export type InsertNotificationRecommendations = typeof notificationRecommendations.$inferInsert;

// Categories table for persistent category management
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // "liquor", "tobacco", etc.
  label: text("label").notNull(), // "Liquor", "Tobacco", etc.
  color: text("color").notNull(), // Hex color code
  description: text("description"),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Category-Attendee relationship table for many-to-many relationships
export const categoryAttendees = pgTable("category_attendees", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  attendeeId: integer("attendee_id").notNull().references(() => ddfsAttendees.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCategoryAttendeeSchema = createInsertSchema(categoryAttendees).omit({
  id: true,
  createdAt: true,
});

export type InsertCategoryAttendee = z.infer<typeof insertCategoryAttendeeSchema>;
export type CategoryAttendee = typeof categoryAttendees.$inferSelect;
