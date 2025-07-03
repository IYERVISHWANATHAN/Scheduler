import { meetings, ddfsAttendees, globalSettings, users, changeLogs, userOnboarding, categories, categoryAttendees, userDateSettings, type Meeting, type InsertMeeting, type DdfsAttendee, type InsertDdfsAttendee, type GlobalSetting, type InsertGlobalSetting, type ChangeLog, type InsertChangeLog, type UserOnboarding, type InsertUserOnboarding, type Category, type InsertCategory, type CategoryAttendee, type InsertCategoryAttendee, type UserDateSettings, type InsertUserDateSettings, CATEGORY_ATTENDEES, type User, type InsertUser, type UserRole } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getMeeting(id: number): Promise<Meeting | undefined>;
  getMeetingsByDate(date: string): Promise<Meeting[]>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: number, meeting: Partial<InsertMeeting>): Promise<Meeting | undefined>;
  deleteMeeting(id: number): Promise<boolean>;
  getAllMeetings(): Promise<Meeting[]>;
  checkConflicts(date: string, startTime: string, endTime: string, mandatoryAttendees: string[], excludeMeetingId?: number): Promise<string[]>;
  checkBufferViolations(date: string, startTime: string, endTime: string, mandatoryAttendees: string[], excludeMeetingId?: number): Promise<string[]>;
  
  // User authentication methods
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  authenticateUser(email: string, password: string): Promise<User | null>;
  changeUserPassword(userId: number, oldPassword: string, newPassword: string): Promise<boolean>;
  
  // User management methods
  getAllUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  updateUserPermissions(id: number, permissions: any): Promise<User | undefined>;
  updateUserTimezone(id: number, timezone: string): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // DDFS Attendees management methods
  getAllDdfsAttendees(): Promise<DdfsAttendee[]>;
  getDdfsAttendee(id: number): Promise<DdfsAttendee | undefined>;
  createDdfsAttendee(attendee: InsertDdfsAttendee): Promise<DdfsAttendee>;
  updateDdfsAttendee(id: number, attendee: Partial<InsertDdfsAttendee>): Promise<DdfsAttendee | undefined>;
  deleteDdfsAttendee(id: number): Promise<boolean>;
  reorderDdfsAttendees(attendeeOrders: { id: number; displayOrder: number }[]): Promise<boolean>;
  
  // Global Settings management methods
  getGlobalSetting(key: string): Promise<GlobalSetting | undefined>;
  setGlobalSetting(key: string, value: string, description?: string, updatedBy?: number): Promise<GlobalSetting>;
  getAllGlobalSettings(): Promise<GlobalSetting[]>;
  
  // Change Logs management methods
  createChangeLog(changeLog: InsertChangeLog): Promise<ChangeLog>;
  getChangeLogs(limit?: number, offset?: number): Promise<ChangeLog[]>;
  getChangeLogsByEntity(entityType: string, entityId?: string): Promise<ChangeLog[]>;
  getChangeLogsByUser(userId: number): Promise<ChangeLog[]>;

  // Onboarding operations
  getUserOnboarding(userId: number): Promise<UserOnboarding | undefined>;
  createUserOnboarding(data: InsertUserOnboarding): Promise<UserOnboarding>;
  updateUserOnboarding(userId: number, data: Partial<InsertUserOnboarding>): Promise<UserOnboarding>;

  // Category management methods
  getAllCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;
  
  // Category-Attendee relationship methods
  getCategoryAttendees(categoryId: number): Promise<DdfsAttendee[]>;
  assignAttendeeToCategory(attendeeId: number, categoryId: number): Promise<CategoryAttendee>;
  removeAttendeeFromCategory(attendeeId: number, categoryId: number): Promise<boolean>;
  getAttendeesWithCategories(): Promise<DdfsAttendee[]>;

  // Date Settings management methods
  getUserDateSettings(userId: number): Promise<UserDateSettings | null>;
  setUserDateSettings(userId: number, settings: { defaultStartDate: string }): Promise<UserDateSettings>;
}

export class MemStorage implements IStorage {
  private meetings: Map<number, Meeting>;
  private users: Map<number, User>;
  private ddfsAttendees: Map<number, DdfsAttendee>;
  private globalSettings: Map<string, GlobalSetting>;
  private currentId: number;
  private currentUserId: number;
  private currentDdfsAttendeeId: number;
  private currentGlobalSettingId: number;

  constructor() {
    this.meetings = new Map();
    this.users = new Map();
    this.ddfsAttendees = new Map();
    this.globalSettings = new Map();
    this.currentId = 1;
    this.currentUserId = 1;
    this.currentDdfsAttendeeId = 1;
    this.currentGlobalSettingId = 1;
    
    // Initialize default users and attendees
    this.initializeUsers();
    this.initializeDdfsAttendees();
    this.initializeGlobalSettings();
  }

  private initializeUsers() {
    const defaultUsers: User[] = [
      {
        id: 1,
        email: "vishwanath.iyer@delhidutyfree.co.in",
        password: "Vishu@123",
        name: "Vishwanath Iyer",
        role: "admin",
        timezone: "Europe/Berlin",
        customPermissions: JSON.stringify({
          canView: true,
          canSchedule: true,
          canEdit: true,
          categories: ["liquor", "tobacco", "pnc", "confectionary", "fashion"]
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        email: "Payal.lal@delhidutyfree.co.in",
        password: "Payal@123",
        name: "Payal Lal",
        role: "pnc_confectionary_fashion",
        timezone: "Europe/Berlin",
        customPermissions: JSON.stringify({
          canView: true,
          canSchedule: true,
          canEdit: true,
          categories: ["pnc", "confectionary", "fashion"]
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        email: "Varun.khanna@delhidutyfree.co.in",
        password: "Varun@123",
        name: "Varun Khanna",
        role: "liquor_tobacco",
        timezone: "Europe/Berlin",
        customPermissions: JSON.stringify({
          canView: true,
          canSchedule: true,
          canEdit: true,
          categories: ["liquor", "tobacco"]
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 4,
        email: "Guest",
        password: "Guest@123",
        name: "Guest",
        role: "guest",
        timezone: "Europe/Berlin",
        customPermissions: JSON.stringify({
          canView: true,
          canSchedule: false,
          canEdit: false,
          categories: []
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 5,
        email: "Vendor",
        password: "Vendor@123",
        name: "Brand",
        role: "vendor",
        timezone: "Europe/Berlin",
        customPermissions: JSON.stringify({
          canView: false,
          canSchedule: true,
          canEdit: false,
          categories: []
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 6,
        email: "abhijit.das@delhidutyfree.co.in",
        password: "Abhijit@123",
        name: "Abhijit Das",
        role: "admin",
        timezone: "Europe/Berlin",
        customPermissions: JSON.stringify({
          canView: true,
          canSchedule: true,
          canEdit: true,
          categories: ["liquor", "tobacco", "pnc", "confectionary", "fashion"]
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    defaultUsers.forEach(user => {
      this.users.set(user.id, user);
      this.currentUserId = Math.max(this.currentUserId, user.id + 1);
    });
  }

  private initializeDdfsAttendees() {
    const defaultAttendees: DdfsAttendee[] = [
      {
        id: 1,
        name: "Varun Khanna",
        email: "Varun.khanna@delhidutyfree.co.in",
        categories: ["destination", "liquor", "tobacco"],
        whatsappNumber: null,
        whatsappContactId: null,
        enableWhatsappAlerts: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        displayOrder: 1
      },
      {
        id: 2,
        name: "Payal Lal",
        email: "Payal.lal@delhidutyfree.co.in",
        categories: ["destination", "pnc", "confectionary", "fashion"],
        whatsappNumber: null,
        whatsappContactId: null,
        enableWhatsappAlerts: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        displayOrder: 2
      },
      {
        id: 3,
        name: "Vishwanath Iyer",
        email: "vishwanath.iyer@delhidutyfree.co.in",
        categories: ["destination", "liquor", "tobacco", "pnc", "confectionary", "fashion"],
        whatsappNumber: null,
        whatsappContactId: null,
        enableWhatsappAlerts: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        displayOrder: 3
      },
      {
        id: 4,
        name: "Ashish Chopra",
        email: "Ashish.Chopra@delhidutyfree.co.in",
        categories: ["destination", "liquor", "tobacco", "pnc", "confectionary", "fashion"],
        whatsappNumber: null,
        whatsappContactId: null,
        enableWhatsappAlerts: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        displayOrder: 4
      },
      {
        id: 5,
        name: "Chiragh Oberoi",
        email: "Chiragh.Oberoi@Gmrgroup.in",
        categories: ["destination", "liquor", "tobacco", "pnc", "confectionary", "fashion"],
        whatsappNumber: null,
        whatsappContactId: null,
        enableWhatsappAlerts: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        displayOrder: 5
      }
    ];

    defaultAttendees.forEach(attendee => {
      this.ddfsAttendees.set(attendee.id, attendee);
      this.currentDdfsAttendeeId = Math.max(this.currentDdfsAttendeeId, attendee.id + 1);
    });
  }

  private initializeGlobalSettings() {
    const defaultSettings: GlobalSetting[] = [
      {
        id: 1,
        settingKey: "default_week_start_date",
        settingValue: new Date().toISOString().split('T')[0], // Use today's date instead of hardcoded
        description: "Default week start date for all users",
        updatedBy: 1,
        updatedAt: new Date()
      }
    ];

    defaultSettings.forEach(setting => {
      this.globalSettings.set(setting.settingKey, setting);
      this.currentGlobalSettingId = Math.max(this.currentGlobalSettingId, setting.id + 1);
    });
  }

  async getMeeting(id: number): Promise<Meeting | undefined> {
    return this.meetings.get(id);
  }

  async getMeetingsByDate(date: string): Promise<Meeting[]> {
    return Array.from(this.meetings.values()).filter(
      (meeting) => meeting.date === date
    );
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const id = this.currentId++;
    const meeting: Meeting = { 
      ...insertMeeting, 
      id,
      ddfsAttendees: insertMeeting.ddfsAttendees || [],
      mandatoryAttendees: insertMeeting.mandatoryAttendees || [],
      brandAttendees: insertMeeting.brandAttendees || []
    };
    this.meetings.set(id, meeting);
    return meeting;
  }

  async updateMeeting(id: number, updateData: Partial<InsertMeeting>): Promise<Meeting | undefined> {
    const existingMeeting = this.meetings.get(id);
    if (!existingMeeting) return undefined;

    const updatedMeeting = { ...existingMeeting, ...updateData };
    this.meetings.set(id, updatedMeeting);
    return updatedMeeting;
  }

  async deleteMeeting(id: number): Promise<boolean> {
    return this.meetings.delete(id);
  }

  async getAllMeetings(): Promise<Meeting[]> {
    return Array.from(this.meetings.values());
  }

  async checkConflicts(
    date: string, 
    startTime: string, 
    endTime: string, 
    mandatoryAttendees: string[], 
    excludeMeetingId?: number
  ): Promise<string[]> {
    const conflictingAttendees: string[] = [];
    
    // Convert time strings to minutes for easier comparison
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);
    
    const meetingsOnDate = Array.from(this.meetings.values()).filter(
      (meeting) => meeting.date === date && meeting.id !== excludeMeetingId
    );
    
    for (const meeting of meetingsOnDate) {
      const meetingStart = timeToMinutes(meeting.startTime);
      const meetingEnd = timeToMinutes(meeting.endTime);
      
      // Check if times overlap
      const hasTimeOverlap = (newStart < meetingEnd && newEnd > meetingStart);
      
      if (hasTimeOverlap) {
        // Check for common mandatory attendees
        const commonMandatory = mandatoryAttendees.filter(attendee => 
          meeting.mandatoryAttendees.includes(attendee)
        );
        
        conflictingAttendees.push(...commonMandatory);
      }
    }
    
    return Array.from(new Set(conflictingAttendees)); // Remove duplicates
  }

  async checkBufferViolations(
    date: string,
    startTime: string,
    endTime: string,
    mandatoryAttendees: string[],
    excludeMeetingId?: number
  ): Promise<string[]> {
    const violatingAttendees: string[] = [];
    
    // Convert time strings to minutes for easier comparison
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);
    const bufferMinutes = 10; // 10-minute buffer
    
    const meetingsOnDate = Array.from(this.meetings.values()).filter(
      (meeting) => meeting.date === date && meeting.id !== excludeMeetingId
    );
    
    for (const meeting of meetingsOnDate) {
      const meetingStart = timeToMinutes(meeting.startTime);
      const meetingEnd = timeToMinutes(meeting.endTime);
      
      // Check for buffer violations (within 10 minutes but not overlapping)
      const hasBufferViolation = (
        (newStart >= meetingEnd && newStart < meetingEnd + bufferMinutes) || // New meeting starts too soon after existing
        (newEnd <= meetingStart && newEnd > meetingStart - bufferMinutes)    // New meeting ends too close to existing
      );
      
      if (hasBufferViolation) {
        // Check for common mandatory attendees
        const commonMandatory = mandatoryAttendees.filter(attendee => 
          meeting.mandatoryAttendees.includes(attendee)
        );
        
        violatingAttendees.push(...commonMandatory);
      }
    }
    
    return Array.from(new Set(violatingAttendees)); // Remove duplicates
  }

  // User authentication methods
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id,
      customPermissions: insertUser.customPermissions || "{}",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async authenticateUser(email: string, password: string): Promise<User | null> {
    console.log(`Authenticating user: ${email}`);
    console.log(`Available users:`, Array.from(this.users.values()).map(u => u.email));
    const user = await this.getUserByEmail(email);
    console.log(`Found user:`, user ? user.email : 'Not found');
    if (user && user.password === password) {
      console.log(`Password match for: ${email}`);
      return user;
    }
    console.log(`Authentication failed for: ${email}`);
    return null;
  }

  // User management methods
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async updateUserPermissions(id: number, permissions: any): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      const updatedUser = {
        ...user,
        customPermissions: JSON.stringify(permissions),
        updatedAt: new Date()
      };
      this.users.set(id, updatedUser);
      return updatedUser;
    }
    return undefined;
  }

  async updateUserTimezone(id: number, timezone: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      const updatedUser = {
        ...user,
        timezone: timezone,
        updatedAt: new Date()
      };
      this.users.set(id, updatedUser);
      return updatedUser;
    }
    return undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // DDFS Attendees management methods
  async getAllDdfsAttendees(): Promise<DdfsAttendee[]> {
    return Array.from(this.ddfsAttendees.values())
      .filter(attendee => attendee.isActive)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  async getDdfsAttendee(id: number): Promise<DdfsAttendee | undefined> {
    return this.ddfsAttendees.get(id);
  }

  async createDdfsAttendee(insertAttendee: InsertDdfsAttendee): Promise<DdfsAttendee> {
    const id = this.currentDdfsAttendeeId++;
    const attendee: DdfsAttendee = { 
      ...insertAttendee,
      id,
      categories: insertAttendee.categories || [],
      isActive: insertAttendee.isActive ?? true,
      displayOrder: insertAttendee.displayOrder ?? this.ddfsAttendees.size + 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.ddfsAttendees.set(id, attendee);
    return attendee;
  }

  async updateDdfsAttendee(id: number, updateData: Partial<InsertDdfsAttendee>): Promise<DdfsAttendee | undefined> {
    const existingAttendee = this.ddfsAttendees.get(id);
    if (existingAttendee) {
      const updatedAttendee: DdfsAttendee = {
        ...existingAttendee,
        ...updateData,
        updatedAt: new Date()
      };
      this.ddfsAttendees.set(id, updatedAttendee);
      return updatedAttendee;
    }
    return undefined;
  }

  async deleteDdfsAttendee(id: number): Promise<boolean> {
    const attendee = this.ddfsAttendees.get(id);
    if (attendee) {
      const updatedAttendee: DdfsAttendee = {
        ...attendee,
        isActive: false,
        updatedAt: new Date()
      };
      this.ddfsAttendees.set(id, updatedAttendee);
      return true;
    }
    return false;
  }

  async reorderDdfsAttendees(attendeeOrders: { id: number; displayOrder: number }[]): Promise<boolean> {
    try {
      for (const { id, displayOrder } of attendeeOrders) {
        const attendee = this.ddfsAttendees.get(id);
        if (attendee) {
          const updatedAttendee: DdfsAttendee = {
            ...attendee,
            displayOrder,
            updatedAt: new Date()
          };
          this.ddfsAttendees.set(id, updatedAttendee);
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  // Global Settings methods
  async getGlobalSetting(key: string): Promise<GlobalSetting | undefined> {
    return this.globalSettings.get(key);
  }

  async setGlobalSetting(key: string, value: string, description?: string, updatedBy?: number): Promise<GlobalSetting> {
    const existing = this.globalSettings.get(key);
    const setting: GlobalSetting = {
      id: existing?.id || this.currentGlobalSettingId++,
      settingKey: key,
      settingValue: value,
      description: description || existing?.description,
      updatedBy: updatedBy || existing?.updatedBy,
      updatedAt: new Date()
    };
    this.globalSettings.set(key, setting);
    return setting;
  }

  async getAllGlobalSettings(): Promise<GlobalSetting[]> {
    return Array.from(this.globalSettings.values());
  }

  async createChangeLog(insertChangeLog: InsertChangeLog): Promise<ChangeLog> {
    // This is a placeholder implementation for MemStorage
    // In production, this would be handled by DatabaseStorage
    const changeLog: ChangeLog = {
      id: this.currentGlobalSettingId++,
      ...insertChangeLog,
      timestamp: new Date(),
    };
    return changeLog;
  }

  async getChangeLogs(limit: number = 100, offset: number = 0): Promise<ChangeLog[]> {
    // Placeholder implementation for MemStorage
    return [];
  }

  async getChangeLogsByEntity(entityType: string, entityId?: string): Promise<ChangeLog[]> {
    // Placeholder implementation for MemStorage
    return [];
  }

  async getChangeLogsByUser(userId: number): Promise<ChangeLog[]> {
    // Placeholder implementation for MemStorage
    return [];
  }

  async changeUserPassword(userId: number, oldPassword: string, newPassword: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) {
      return false;
    }
    
    // Verify old password
    if (user.password !== oldPassword) {
      return false;
    }
    
    // Update password
    const updatedUser: User = {
      ...user,
      password: newPassword,
      updatedAt: new Date()
    };
    this.users.set(userId, updatedUser);
    return true;
  }

  // Onboarding operations
  async getUserOnboarding(userId: number): Promise<UserOnboarding | undefined> {
    // For mem storage, return default values since we don't persist onboarding state
    return undefined;
  }

  async createUserOnboarding(data: InsertUserOnboarding): Promise<UserOnboarding> {
    // For mem storage, just return the data with defaults
    const onboarding: UserOnboarding = {
      userId: data.userId,
      hasCompletedOnboarding: data.hasCompletedOnboarding,
      lastOnboardingVersion: data.lastOnboardingVersion,
      onboardingSkippedAt: data.onboardingSkippedAt || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return onboarding;
  }

  async updateUserOnboarding(userId: number, data: Partial<InsertUserOnboarding>): Promise<UserOnboarding> {
    // For mem storage, just return updated data
    const onboarding: UserOnboarding = {
      userId: userId,
      hasCompletedOnboarding: data.hasCompletedOnboarding || false,
      lastOnboardingVersion: data.lastOnboardingVersion || "1.0.0",
      onboardingSkippedAt: data.onboardingSkippedAt || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return onboarding;
  }
}

export class DatabaseStorage implements IStorage {
  async clearAndReinitialize(): Promise<void> {
    try {
      // Clear existing users
      await db.delete(users);
      console.log('Cleared existing users');
      
      // Reinitialize with all default users including new ones
      await this.initializeDefaultData();
    } catch (error) {
      console.error('Error clearing and reinitializing data:', error);
    }
  }

  async initializeDefaultData(): Promise<void> {
    try {
      // Initialize default categories if none exist
      const existingCategories = await this.getAllCategories();
      if (existingCategories.length === 0) {
        const defaultCategories = [
          { key: 'liquor', label: 'Liquor', color: '#EF4444', description: 'Alcoholic beverages category', isActive: true, displayOrder: 1 },
          { key: 'tobacco', label: 'Tobacco', color: '#F97316', description: 'Tobacco products category', isActive: true, displayOrder: 2 },
          { key: 'pnc', label: 'PNC', color: '#10B981', description: 'Personal and confectionery items', isActive: true, displayOrder: 3 },
          { key: 'confectionary', label: 'Confectionary', color: '#F59E0B', description: 'Sweet treats and candy', isActive: true, displayOrder: 4 },
          { key: 'fashion', label: 'Fashion', color: '#EC4899', description: 'Fashion and accessories', isActive: true, displayOrder: 5 }
        ];

        for (const categoryData of defaultCategories) {
          await db.insert(categories).values(categoryData);
        }
        console.log('Default categories initialized');
      }

      // Initialize default users if none exist
      const existingUsers = await this.getAllUsers();
      if (existingUsers.length === 0) {
        const defaultUsers = [
          {
            name: "Vishwanath Iyer",
            email: "vishwanath.iyer@delhidutyfree.co.in",
            password: "Vishu@123",
            role: "admin" as UserRole,
            customPermissions: JSON.stringify({
              canView: true,
              canSchedule: true,
              canEdit: true,
              categories: ['liquor', 'tobacco', 'pnc', 'confectionary', 'fashion']
            }),
            timezone: "Europe/Berlin"
          },
          {
            name: "Payal Lal",
            email: "Payal.lal@delhidutyfree.co.in",
            password: "Payal@123",
            role: "pnc_confectionary_fashion" as UserRole,
            customPermissions: JSON.stringify({
              canView: true,
              canSchedule: true,
              canEdit: true,
              categories: ['pnc', 'confectionary', 'fashion']
            }),
            timezone: "Europe/Berlin"
          },
          {
            name: "Varun Khanna",
            email: "Varun.khanna@delhidutyfree.co.in",
            password: "Varun@123",
            role: "liquor_tobacco" as UserRole,
            customPermissions: JSON.stringify({
              canView: true,
              canSchedule: true,
              canEdit: true,
              categories: ['liquor', 'tobacco']
            }),
            timezone: "Europe/Berlin"
          },
          {
            name: "Guest",
            email: "Guest",
            password: "Guest@123",
            role: "guest" as UserRole,
            customPermissions: JSON.stringify({
              canView: true,
              canSchedule: false,
              canEdit: false,
              categories: []
            }),
            timezone: "Europe/Berlin"
          },
          {
            name: "Brand",
            email: "Vendor",
            password: "Vendor@123",
            role: "vendor" as UserRole,
            customPermissions: JSON.stringify({
              canView: false,
              canSchedule: true,
              canEdit: false,
              categories: []
            }),
            timezone: "Europe/Berlin"
          },
          {
            name: "Abhijit Das",
            email: "abhijit.das@delhidutyfree.co.in",
            password: "Abhijit@123",
            role: "admin" as UserRole,
            customPermissions: JSON.stringify({
              canView: true,
              canSchedule: true,
              canEdit: true,
              categories: ['liquor', 'tobacco', 'pnc', 'confectionary', 'fashion']
            }),
            timezone: "Europe/Berlin"
          },
          {
            name: "Rajesh Kumar",
            email: "rajesh.kumar@delhidutyfree.co.in",
            password: "Rajesh@123",
            role: "liquor_tobacco" as UserRole,
            customPermissions: JSON.stringify({
              canView: true,
              canSchedule: true,
              canEdit: true,
              categories: ['liquor', 'tobacco']
            }),
            timezone: "Europe/Berlin"
          },
          {
            name: "Priya Sharma",
            email: "priya.sharma@delhidutyfree.co.in",
            password: "Priya@123",
            role: "pnc_confectionary_fashion" as UserRole,
            customPermissions: JSON.stringify({
              canView: true,
              canSchedule: true,
              canEdit: true,
              categories: ['pnc', 'confectionary', 'fashion']
            }),
            timezone: "Europe/Berlin"
          },
          {
            name: "Amit Singh",
            email: "amit.singh@delhidutyfree.co.in",
            password: "Amit@123",
            role: "admin" as UserRole,
            customPermissions: JSON.stringify({
              canView: true,
              canSchedule: true,
              canEdit: true,
              categories: ['liquor', 'tobacco', 'pnc', 'confectionary', 'fashion']
            }),
            timezone: "Europe/Berlin"
          },
          {
            name: "Sonia Gupta",
            email: "sonia.gupta@delhidutyfree.co.in",
            password: "Sonia@123",
            role: "pnc_confectionary_fashion" as UserRole,
            customPermissions: JSON.stringify({
              canView: true,
              canSchedule: true,
              canEdit: true,
              categories: ['pnc', 'confectionary', 'fashion']
            }),
            timezone: "Europe/Berlin"
          },
          {
            name: "Deepak Verma",
            email: "deepak.verma@delhidutyfree.co.in",
            password: "Deepak@123",
            role: "liquor_tobacco" as UserRole,
            customPermissions: JSON.stringify({
              canView: true,
              canSchedule: true,
              canEdit: true,
              categories: ['liquor', 'tobacco']
            }),
            timezone: "Europe/Berlin"
          },
          {
            name: "Manager",
            email: "manager@delhidutyfree.co.in",
            password: "Manager@123",
            role: "admin" as UserRole,
            customPermissions: JSON.stringify({
              canView: true,
              canSchedule: true,
              canEdit: true,
              categories: ['liquor', 'tobacco', 'pnc', 'confectionary', 'fashion']
            }),
            timezone: "Europe/Berlin"
          },
          {
            name: "Scheduler",
            email: "scheduler@delhidutyfree.co.in",
            password: "Scheduler@123",
            role: "admin" as UserRole,
            customPermissions: JSON.stringify({
              canView: true,
              canSchedule: true,
              canEdit: true,
              categories: ['liquor', 'tobacco', 'pnc', 'confectionary', 'fashion']
            }),
            timezone: "Europe/Berlin"
          }
        ];

        for (const user of defaultUsers) {
          await this.createUser(user);
        }
        console.log('Default users initialized');
      }

      // Initialize default DDFS attendees if none exist
      const existingAttendees = await this.getAllDdfsAttendees();
      if (existingAttendees.length === 0) {
        const defaultAttendees = [
          {
            name: "Varun Khanna",
            email: "Varun.khanna@delhidutyfree.co.in",
            categories: ['liquor', 'tobacco'],
            whatsappNumber: null,
            whatsappContactId: null,
            enableWhatsappAlerts: null,
            isActive: true,
            displayOrder: 1
          },
          {
            name: "Payal Lal",
            email: "Payal.lal@delhidutyfree.co.in",
            categories: ['pnc', 'confectionary', 'fashion'],
            whatsappNumber: null,
            whatsappContactId: null,
            enableWhatsappAlerts: null,
            isActive: true,
            displayOrder: 2
          },
          {
            name: "Vishwanath Iyer",
            email: "vishwanath.iyer@delhidutyfree.co.in",
            categories: ['liquor', 'tobacco', 'pnc', 'confectionary', 'fashion'],
            whatsappNumber: null,
            whatsappContactId: null,
            enableWhatsappAlerts: null,
            isActive: true,
            displayOrder: 3
          },
          {
            name: "Ashish Chopra",
            email: "Ashish.Chopra@delhidutyfree.co.in",
            categories: ['liquor', 'tobacco', 'pnc', 'confectionary', 'fashion'],
            whatsappNumber: null,
            whatsappContactId: null,
            enableWhatsappAlerts: null,
            isActive: true,
            displayOrder: 4
          },
          {
            name: "Chiragh Oberoi",
            email: "Chiragh.Oberoi@Gmrgroup.in",
            categories: ['liquor', 'tobacco', 'pnc', 'confectionary', 'fashion'],
            whatsappNumber: null,
            whatsappContactId: null,
            enableWhatsappAlerts: null,
            isActive: true,
            displayOrder: 5
          }
        ];

        for (const attendee of defaultAttendees) {
          await this.createDdfsAttendee(attendee);
        }
        console.log('Default DDFS attendees initialized');
      }

      // Initialize default global settings if none exist
      const existingSettings = await this.getAllGlobalSettings();
      if (existingSettings.length === 0) {
        const defaultSettings = [
          {
            key: "meeting_buffer_minutes",
            value: "10",
            description: "Buffer time in minutes between meetings for the same attendees"
          },
          {
            key: "business_hours_start",
            value: "08:00",
            description: "Business hours start time"
          },
          {
            key: "business_hours_end",
            value: "20:00",
            description: "Business hours end time"
          },
          {
            key: "default_meeting_duration",
            value: "60",
            description: "Default meeting duration in minutes"
          },
          {
            key: "email_notifications_enabled",
            value: "true",
            description: "Enable email notifications for meeting invites and reminders"
          }
        ];

        for (const setting of defaultSettings) {
          await this.setGlobalSetting(setting.key, setting.value, setting.description);
        }
        console.log('Default global settings initialized');
      }
    } catch (error) {
      console.error('Error initializing default data:', error);
    }
  }
  // Meeting operations
  async getMeeting(id: number): Promise<Meeting | undefined> {
    const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id));
    return meeting;
  }

  async getMeetingsByDate(date: string): Promise<Meeting[]> {
    return await db.select().from(meetings).where(eq(meetings.date, date));
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const [meeting] = await db.insert(meetings).values(insertMeeting).returning();
    return meeting;
  }

  async updateMeeting(id: number, updateData: Partial<InsertMeeting>): Promise<Meeting | undefined> {
    const [meeting] = await db
      .update(meetings)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(meetings.id, id))
      .returning();
    return meeting;
  }

  async deleteMeeting(id: number): Promise<boolean> {
    const result = await db.delete(meetings).where(eq(meetings.id, id));
    return result.rowCount > 0;
  }

  async getAllMeetings(): Promise<Meeting[]> {
    return await db.select().from(meetings);
  }

  async checkConflicts(date: string, startTime: string, endTime: string, mandatoryAttendees: string[], excludeMeetingId?: number): Promise<string[]> {
    const dayMeetings = await this.getMeetingsByDate(date);
    const conflicts: string[] = [];

    for (const meeting of dayMeetings) {
      if (excludeMeetingId && meeting.id === excludeMeetingId) continue;

      if (this.timeOverlaps(startTime, endTime, meeting.startTime, meeting.endTime)) {
        const conflictingAttendees = mandatoryAttendees.filter(attendee => 
          meeting.mandatoryAttendees.includes(attendee)
        );
        conflicts.push(...conflictingAttendees);
      }
    }

    return [...new Set(conflicts)];
  }

  async checkBufferViolations(date: string, startTime: string, endTime: string, mandatoryAttendees: string[], excludeMeetingId?: number): Promise<string[]> {
    const dayMeetings = await this.getMeetingsByDate(date);
    const violations: string[] = [];

    for (const meeting of dayMeetings) {
      if (excludeMeetingId && meeting.id === excludeMeetingId) continue;

      const hasCommonAttendees = mandatoryAttendees.some(attendee => 
        meeting.mandatoryAttendees.includes(attendee)
      );

      if (hasCommonAttendees) {
        if (this.hasBufferViolation(startTime, endTime, meeting.startTime, meeting.endTime)) {
          const violatingAttendees = mandatoryAttendees.filter(attendee => 
            meeting.mandatoryAttendees.includes(attendee)
          );
          violations.push(...violatingAttendees);
        }
      }
    }

    return [...new Set(violations)];
  }

  private timeOverlaps(start1: string, end1: string, start2: string, end2: string): boolean {
    const start1Minutes = this.timeToMinutes(start1);
    const end1Minutes = this.timeToMinutes(end1);
    const start2Minutes = this.timeToMinutes(start2);
    const end2Minutes = this.timeToMinutes(end2);

    return start1Minutes < end2Minutes && end1Minutes > start2Minutes;
  }

  private hasBufferViolation(start1: string, end1: string, start2: string, end2: string): boolean {
    const bufferMinutes = 10;
    const start1Minutes = this.timeToMinutes(start1);
    const end1Minutes = this.timeToMinutes(end1);
    const start2Minutes = this.timeToMinutes(start2);
    const end2Minutes = this.timeToMinutes(end2);

    const gap1 = Math.abs(end1Minutes - start2Minutes);
    const gap2 = Math.abs(end2Minutes - start1Minutes);

    return gap1 < bufferMinutes || gap2 < bufferMinutes;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // User operations
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Normalize email to lowercase for consistent authentication
    const normalizedUser = {
      ...insertUser,
      email: insertUser.email.toLowerCase(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const [user] = await db.insert(users).values(normalizedUser).returning();
    return user;
  }

  async authenticateUser(email: string, password: string): Promise<User | null> {
    // Ensure case-insensitive email lookup
    const user = await this.getUserByEmail(email.toLowerCase());
    if (user && user.password === password) {
      return user;
    }
    return null;
  }

  async changeUserPassword(userId: number, oldPassword: string, newPassword: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user || user.password !== oldPassword) {
      return false;
    }

    const [updatedUser] = await db
      .update(users)
      .set({ password: newPassword, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    return !!updatedUser;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async updateUserPermissions(id: number, permissions: any): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ customPermissions: JSON.stringify(permissions), updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserTimezone(id: number, timezone: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ timezone: timezone, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount! > 0;
  }

  // DDFS Attendees operations
  async getAllDdfsAttendees(): Promise<DdfsAttendee[]> {
    return await db.select().from(ddfsAttendees).orderBy(ddfsAttendees.displayOrder);
  }

  async getDdfsAttendee(id: number): Promise<DdfsAttendee | undefined> {
    const [attendee] = await db.select().from(ddfsAttendees).where(eq(ddfsAttendees.id, id));
    return attendee;
  }

  async createDdfsAttendee(insertAttendee: InsertDdfsAttendee): Promise<DdfsAttendee> {
    // Set defaults and ensure proper data structure
    const attendeeData = {
      ...insertAttendee,
      categories: insertAttendee.categories || [],
      isActive: insertAttendee.isActive ?? true,
      displayOrder: insertAttendee.displayOrder ?? 0,
      enableWhatsappAlerts: insertAttendee.enableWhatsappAlerts ?? false,
      whatsappNumber: insertAttendee.whatsappNumber || null,
      whatsappContactId: insertAttendee.whatsappContactId || null
    };
    
    console.log('Creating DDFS attendee with data:', attendeeData);
    const [attendee] = await db.insert(ddfsAttendees).values(attendeeData).returning();
    console.log('Created DDFS attendee:', attendee);
    return attendee;
  }

  async updateDdfsAttendee(id: number, updateData: Partial<InsertDdfsAttendee>): Promise<DdfsAttendee | undefined> {
    const [attendee] = await db
      .update(ddfsAttendees)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(ddfsAttendees.id, id))
      .returning();
    return attendee;
  }

  async deleteDdfsAttendee(id: number): Promise<boolean> {
    const result = await db.delete(ddfsAttendees).where(eq(ddfsAttendees.id, id));
    return result.rowCount > 0;
  }

  async reorderDdfsAttendees(attendeeOrders: { id: number; displayOrder: number }[]): Promise<boolean> {
    try {
      for (const order of attendeeOrders) {
        await db
          .update(ddfsAttendees)
          .set({ displayOrder: order.displayOrder, updatedAt: new Date() })
          .where(eq(ddfsAttendees.id, order.id));
      }
      return true;
    } catch (error) {
      console.error('Error reordering attendees:', error);
      return false;
    }
  }

  // Global Settings operations
  async getGlobalSetting(key: string): Promise<GlobalSetting | undefined> {
    const [setting] = await db.select().from(globalSettings).where(eq(globalSettings.settingKey, key));
    return setting;
  }

  async setGlobalSetting(key: string, value: string, description?: string, updatedBy?: number): Promise<GlobalSetting> {
    const existing = await this.getGlobalSetting(key);
    
    if (existing) {
      const [setting] = await db
        .update(globalSettings)
        .set({ settingValue: value, description, updatedBy, updatedAt: new Date() })
        .where(eq(globalSettings.settingKey, key))
        .returning();
      return setting;
    } else {
      const [setting] = await db
        .insert(globalSettings)
        .values({ settingKey: key, settingValue: value, description, updatedBy })
        .returning();
      return setting;
    }
  }

  async getAllGlobalSettings(): Promise<GlobalSetting[]> {
    return await db.select().from(globalSettings);
  }

  // Change Logs operations
  async createChangeLog(insertChangeLog: InsertChangeLog): Promise<ChangeLog> {
    const [changeLog] = await db.insert(changeLogs).values(insertChangeLog).returning();
    return changeLog;
  }

  async getChangeLogs(limit: number = 100, offset: number = 0): Promise<ChangeLog[]> {
    return await db
      .select()
      .from(changeLogs)
      .orderBy(changeLogs.timestamp)
      .limit(limit)
      .offset(offset);
  }

  async getChangeLogsByEntity(entityType: string, entityId?: string): Promise<ChangeLog[]> {
    if (entityId) {
      return await db
        .select()
        .from(changeLogs)
        .where(eq(changeLogs.entityType, entityType) && eq(changeLogs.entityId, entityId))
        .orderBy(changeLogs.timestamp);
    } else {
      return await db
        .select()
        .from(changeLogs)
        .where(eq(changeLogs.entityType, entityType))
        .orderBy(changeLogs.timestamp);
    }
  }

  async getChangeLogsByUser(userId: number): Promise<ChangeLog[]> {
    return await db
      .select()
      .from(changeLogs)
      .where(eq(changeLogs.userId, userId))
      .orderBy(changeLogs.timestamp);
  }

  // Onboarding operations
  async getUserOnboarding(userId: number): Promise<UserOnboarding | undefined> {
    const [onboarding] = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId));
    return onboarding;
  }

  async createUserOnboarding(data: InsertUserOnboarding): Promise<UserOnboarding> {
    const [onboarding] = await db
      .insert(userOnboarding)
      .values(data)
      .returning();
    return onboarding;
  }

  async updateUserOnboarding(userId: number, data: Partial<InsertUserOnboarding>): Promise<UserOnboarding> {
    const [onboarding] = await db
      .update(userOnboarding)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userOnboarding.userId, userId))
      .returning();
    return onboarding;
  }

  // Category management methods
  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.displayOrder);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(categoryData: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(categoryData)
      .returning();
    return category;
  }

  async updateCategory(id: number, categoryData: Partial<InsertCategory>): Promise<Category | undefined> {
    const [category] = await db
      .update(categories)
      .set({ ...categoryData, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return category;
  }

  async syncAttendeeCategoryArrays(): Promise<void> {
    // Get all attendees and their category relationships
    const allAttendees = await db.select().from(ddfsAttendees);
    const allCategories = await db.select().from(categories);
    
    for (const attendee of allAttendees) {
      // Get category relationships for this attendee
      const attendeeCategories = await db
        .select({ categoryKey: categories.key })
        .from(categoryAttendees)
        .innerJoin(categories, eq(categoryAttendees.categoryId, categories.id))
        .where(eq(categoryAttendees.attendeeId, attendee.id));
      
      const categoryKeys = attendeeCategories.map(c => c.categoryKey);
      
      // Update attendee's categories array
      await db
        .update(ddfsAttendees)
        .set({ 
          categories: categoryKeys,
          updatedAt: new Date()
        })
        .where(eq(ddfsAttendees.id, attendee.id));
    }
  }

  async deleteCategory(id: number): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getCategoryAttendees(categoryId: number): Promise<DdfsAttendee[]> {
    const result = await db
      .select({
        id: ddfsAttendees.id,
        name: ddfsAttendees.name,
        email: ddfsAttendees.email,
        categories: ddfsAttendees.categories,
        whatsappNumber: ddfsAttendees.whatsappNumber,
        whatsappContactId: ddfsAttendees.whatsappContactId,
        enableWhatsappAlerts: ddfsAttendees.enableWhatsappAlerts,
        isActive: ddfsAttendees.isActive,
        displayOrder: ddfsAttendees.displayOrder,
        createdAt: ddfsAttendees.createdAt,
        updatedAt: ddfsAttendees.updatedAt
      })
      .from(ddfsAttendees)
      .innerJoin(categoryAttendees, eq(ddfsAttendees.id, categoryAttendees.attendeeId))
      .where(eq(categoryAttendees.categoryId, categoryId));
    return result;
  }

  async assignAttendeeToCategory(attendeeId: number, categoryId: number): Promise<CategoryAttendee> {
    const [relationship] = await db
      .insert(categoryAttendees)
      .values({ attendeeId, categoryId })
      .returning();
    return relationship;
  }

  async removeAttendeeFromCategory(attendeeId: number, categoryId: number): Promise<boolean> {
    const result = await db
      .delete(categoryAttendees)
      .where(
        eq(categoryAttendees.attendeeId, attendeeId) && 
        eq(categoryAttendees.categoryId, categoryId)
      );
    return (result.rowCount || 0) > 0;
  }

  async getAttendeesWithCategories(): Promise<DdfsAttendee[]> {
    return await db.select().from(ddfsAttendees).orderBy(ddfsAttendees.displayOrder);
  }

  // Date Settings management methods
  async getUserDateSettings(userId: number): Promise<UserDateSettings | null> {
    const [settings] = await db
      .select()
      .from(userDateSettings)
      .where(eq(userDateSettings.userId, userId));
    return settings || null;
  }

  async setUserDateSettings(userId: number, settingsData: { defaultStartDate: string }): Promise<UserDateSettings> {
    // Check if settings already exist for this user
    const existing = await this.getUserDateSettings(userId);
    
    if (existing) {
      // Update existing settings
      const [updated] = await db
        .update(userDateSettings)
        .set({
          defaultStartDate: settingsData.defaultStartDate,
          updatedAt: new Date()
        })
        .where(eq(userDateSettings.userId, userId))
        .returning();
      return updated;
    } else {
      // Create new settings
      const [created] = await db
        .insert(userDateSettings)
        .values({
          userId,
          defaultStartDate: settingsData.defaultStartDate
        })
        .returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();

// Initialize default data on startup
storage.initializeDefaultData().catch(console.error);
