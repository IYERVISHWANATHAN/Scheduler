import { db } from "./db";
import { categories, categoryAttendees, ddfsAttendees } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export async function initializeDatabase() {
  try {
    console.log("Initializing database with default categories and relationships...");

    // Insert default categories with conflict resolution
    const defaultCategories = [
      {
        key: 'destination',
        label: 'Destination',
        color: '#3B82F6',
        description: 'Destination category',
        isActive: true,
        displayOrder: 0,
      },
      {
        key: 'liquor',
        label: 'Liquor',
        color: '#EF4444',
        description: 'Alcoholic beverages category',
        isActive: true,
        displayOrder: 1,
      },
      {
        key: 'tobacco',
        label: 'Tobacco',
        color: '#F97316',
        description: 'Tobacco products category',
        isActive: true,
        displayOrder: 2,
      },
      {
        key: 'pnc',
        label: 'PNC',
        color: '#10B981',
        description: 'Personal and confectionery items',
        isActive: true,
        displayOrder: 3,
      },
      {
        key: 'confectionary',
        label: 'Confectionary',
        color: '#F59E0B',
        description: 'Sweet treats and candy',
        isActive: true,
        displayOrder: 4,
      },
      {
        key: 'fashion',
        label: 'Fashion',
        color: '#EC4899',
        description: 'Fashion and accessories',
        isActive: true,
        displayOrder: 5,
      },
    ];

    // Insert categories with upsert logic
    for (const category of defaultCategories) {
      await db
        .insert(categories)
        .values(category)
        .onConflictDoUpdate({
          target: categories.key,
          set: {
            label: sql`EXCLUDED.label`,
            color: sql`EXCLUDED.color`,
            description: sql`EXCLUDED.description`,
            isActive: sql`EXCLUDED.is_active`,
            displayOrder: sql`EXCLUDED.display_order`,
            updatedAt: new Date(),
          },
        });
    }

    // Sync category-attendee relationships based on attendee category arrays
    await syncCategoryAttendeeRelationships();

    console.log("Database initialization completed successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}

async function syncCategoryAttendeeRelationships() {
  try {
    // Get all categories and attendees
    const allCategories = await db.select().from(categories);
    const allAttendees = await db.select().from(ddfsAttendees);

    // Clear existing relationships to rebuild them
    await db.delete(categoryAttendees);

    // Build new relationships based on attendee category arrays
    for (const attendee of allAttendees) {
      if (attendee.categories && attendee.categories.length > 0) {
        for (const categoryKey of attendee.categories) {
          const category = allCategories.find(c => c.key === categoryKey);
          if (category) {
            await db.insert(categoryAttendees).values({
              categoryId: category.id,
              attendeeId: attendee.id,
            }).onConflictDoNothing();
          }
        }
      }
    }

    console.log("Category-attendee relationships synchronized successfully");
  } catch (error) {
    console.error("Error syncing category-attendee relationships:", error);
    throw error;
  }
}

// Export the sync function for use in API routes
export { syncCategoryAttendeeRelationships };