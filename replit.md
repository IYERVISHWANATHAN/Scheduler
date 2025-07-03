# Calendar Scheduling App

## Overview

This is a comprehensive calendar scheduling platform built with modern web technologies that enables intelligent team collaboration through advanced meeting management. The application features a React frontend with TypeScript, Express.js backend, and PostgreSQL database integration with Drizzle ORM.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development practices
- **Build Tool**: Vite for fast development and optimized production builds
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent design
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation
- **Authentication**: Context-based authentication with role-based access control

### Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Session-based authentication with role-based permissions
- **API Design**: RESTful API with structured error handling
- **Storage**: Hybrid approach supporting both PostgreSQL and in-memory storage for development

## Key Components

### User Management System
- **Role-Based Access Control**: Four distinct user roles (admin, liquor_tobacco, pnc_confectionary_fashion, guest)
- **Permission System**: Granular permissions for viewing, scheduling, and editing meetings
- **Category-Based Access**: Users can only access meetings in their designated categories
- **Guest User Restrictions**: 
  - Can only see blocked time slots without meeting details or titles
  - Can schedule new meetings but cannot access meeting details
  - Cannot access file management features (import/export) 
  - User dropdown menu contains only logout option
  - Restricted from analytics, settings, administrative functions, and print options
  - No access to voice input, app walkthrough, or zen mode features

### Meeting Management
- **Calendar Views**: Week view and day view with 15-minute time slots (8 AM - 8 PM)
- **Category System**: Five meeting categories (liquor, tobacco, pnc, confectionary, fashion)
- **Attendee Management**: DDFS attendees with mandatory/optional designation and brand attendees
- **Conflict Detection**: Real-time checking for overlapping meetings with mandatory attendees
- **Buffer Management**: 10-minute buffer enforcement between meetings

### Advanced Features
- **AI Integration**: OpenAI API integration for intelligent scheduling suggestions
- **Export Capabilities**: Excel (.xlsx) and iCal (.ics) export functionality
- **External Integrations**: Google Calendar, Outlook, and Apple Calendar sync capabilities
- **Email Notifications**: SendGrid integration for meeting notifications
- **Mobile Optimization**: Responsive design optimized for mobile devices

## Data Flow

### Authentication Flow
1. User submits credentials through login form
2. Backend validates credentials against user database
3. Session token generated and stored in localStorage
4. Token included in all subsequent API requests via Authorization header
5. Backend middleware validates token and attaches user context to requests

### Meeting Management Flow
1. User selects date/time slot in calendar interface
2. Meeting form validates attendee selections based on user role and category
3. Backend performs conflict detection against existing meetings
4. If conflicts exist with mandatory attendees, user receives warning with override option  
5. Meeting saved to database with automatic relationship mapping
6. Calendar views updated in real-time via React Query cache invalidation

### Data Synchronization
- Calendar views automatically refetch data when date ranges change
- Real-time conflict detection during meeting creation/editing
- Optimistic updates for immediate UI feedback
- Automatic cache invalidation ensures data consistency

## External Dependencies

### Core Dependencies
- **React Ecosystem**: React 18, React DOM, React Hook Form, React Query
- **UI Libraries**: Radix UI primitives, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js, Drizzle ORM, Zod validation
- **Database**: PostgreSQL with connection pooling
- **Build Tools**: Vite, TypeScript, PostCSS

### Optional Integrations
- **AI Services**: OpenAI API for scheduling optimization
- **Email Services**: SendGrid for notifications
- **Calendar APIs**: Google Calendar, Microsoft Outlook APIs
- **File Processing**: XLSX library for Excel export/import
- **Communication**: WhatsApp Business API integration

### Development Dependencies
- **TypeScript**: Full type safety across frontend and backend
- **ESBuild**: Fast production builds
- **Drizzle Kit**: Database schema management and migrations

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js 20+ with tsx for TypeScript execution
- **Database**: PostgreSQL 16 with automatic schema initialization
- **Hot Reload**: Vite HMR for frontend, tsx watch mode for backend
- **Environment**: Replit-optimized with automatic port configuration

### Production Deployment
- **Build Process**: 
  1. Frontend: Vite build generates optimized static assets
  2. Backend: ESBuild bundles server code with external dependencies
  3. Database: Drizzle migrations applied automatically
- **Deployment Target**: Replit Autoscale with automatic scaling
- **Port Configuration**: Internal port 5000 mapped to external port 80
- **Asset Serving**: Express serves static frontend assets in production

### Environment Configuration
- **Database**: Configurable PostgreSQL connection with fallback to in-memory storage
- **External APIs**: Optional API keys for enhanced features
- **Session Management**: Configurable session secrets and timeouts
- **Timezone**: Configurable default timezone (Asia/Kolkata)

## Changelog

```
Changelog:
- June 22, 2025. UBUNTU DEPLOYMENT PACKAGE UPDATED (FINAL) - Updated ubuntu-deployment-package.zip (1.53MB) with all latest changes including category display_order database persistence, print button removal, enhanced synchronization, and improved date validation
- June 22, 2025. PRINT BUTTON REMOVED - Removed print button from meeting details modal that opens when clicking on meetings, keeping only Edit and Delete actions
- June 22, 2025. CATEGORY ORDER SYNCHRONIZATION ENHANCED - Improved category reordering to permanently store changes in database and immediately reflect across all pages including Meeting Scheduler Category Legend with comprehensive cache invalidation
- June 22, 2025. DATE VALIDATION ERROR FIXED - Resolved "Invalid time value" RangeError by adding comprehensive date validation and safe parsing in Meeting Summary Page with enhanced formatTime function error handling
- June 22, 2025. MEETING DELETION ERROR FIXED - Resolved authentication and JSON parsing errors in meeting deletion by correcting auth token key, adding authenticateUser middleware to DELETE endpoint, and improving error handling
- June 22, 2025. MEETING SUMMARY PAGE ENHANCED - Improved header alignment and organization, set "Use Custom Range" as default checked state, updated "Back to Calendar" button to navigate to Home page instead of calendar view
- June 22, 2025. DAILY SCHEDULE PAGE ADDED - Created comprehensive day-wise meeting schedule page with automatic day change detection, navigation controls, and detailed meeting information including location, time, and attendees
- June 22, 2025. PRINT FUNCTIONALITY RESTORED - Added print buttons to Day View, Week View, and Meeting Details with guest user restrictions and professional formatting
- June 22, 2025. ATTENDEE DISPLAY IMPROVED - Fixed meeting details modal to show attendees organized as DDFS (Mandatory/Optional) and Brand (Mandatory/Optional) with clear visual distinction and removed duplicate close button
- June 22, 2025. DAY VIEW COLORS FIXED - Replaced EnhancedDayView with NewDayView in calendar page to use database colors instead of hardcoded ones
- June 22, 2025. CATEGORY REORDERING FIXED - Resolved route ordering conflict preventing category reordering functionality in Manage Categories page
- June 22, 2025. DYNAMIC CATEGORY LEGEND - Updated week view and calendar page to show all categories from database instead of hardcoded list
- June 22, 2025. CATEGORY COLORS UPDATED - Reset default category colors and stored in database: Liquor #d85a51, Confectionary #FFE799, PNC #ffa4c6, Tobacco #b18d00, Fashion #9f438d, Destination #e6a27e
- June 22, 2025. GHOST MEETING ALIGNMENT FIXED - Corrected drag preview positioning to align with timeline grid by adding 16px offset matching meeting positioning
- June 22, 2025. CLICK EVENTS FIXED - Successfully resolved mouse event conflicts between drag and click by implementing threshold-based drag detection, allowing proper single/double-click functionality
- June 22, 2025. PAGE RELOAD ELIMINATED - Fixed drag-drop to use React Query cache invalidation instead of window.location.reload() to prevent website reset
- June 22, 2025. DRAG-DROP RESCHEDULING FIXED - Implemented proper API calls to update meeting times and dates when dragged to new positions
- June 22, 2025. TIMELINE OFFSET APPLIED - Moved all meetings down by 15 minutes on timeline to improve visual alignment with grid structure
- June 22, 2025. MEETING ALIGNMENT CORRECTED - Implemented exact minute-based positioning so 8:15 AM meetings align with 8:15 AM timeline markers using pixel-perfect calculations
- June 22, 2025. CORRECTED POSITIONING FORMULA - Both time labels and meetings now use 48px header + (slotIndex * 16px) for perfect alignment
- June 22, 2025. FINE-TUNED TIMELINE WEIGHTS - Set hour markers to 2.25px and 15-minute markers to 1.6px dashed for precise visual balance and optimal readability
- June 22, 2025. PERFECT CENTER ALIGNMENT - Fixed hour timestamps to be exactly center-aligned with grid lines by adjusting positioning from translateY(-8px) to top offset minus 8px
- June 22, 2025. TIME LABEL PRECISION FIX - Corrected X-axis time labels that were off by 15 minutes by using exact slot index lookup instead of calculated positioning
- June 22, 2025. CRITICAL ALIGNMENT FIXES - Resolved timeline misalignment issues where timestamps and meetings were not aligned to grid lines
- June 22, 2025. CORRECTED WEEK DATE RANGE - Fixed week view to start from Sunday (weekStartsOn: 0) instead of Monday to match expected behavior
- June 22, 2025. MEETING POSITIONING OVERHAUL - Updated meeting positioning to use consistent calculation: startFromEight = minutes - (8 * 60), slotIndex = startFromEight / 15
- June 22, 2025. HOUR LABEL ALIGNMENT - Fixed hour labels to align with grid lines using hourIndex * 4 * 16px positioning with translateY(-8px) centering
- June 22, 2025. SYNCHRONIZED DAY AND WEEK VIEWS - Applied identical alignment fixes to both NewDayView and NewWeekView components for consistency
- June 22, 2025. TIMELINE ALIGNMENT PERFECTED - Fixed complete timeline misalignment where 8:00 AM was showing at header level instead of below it
- June 22, 2025. CORRECTED POSITIONING FORMULA - Both time labels and meetings now use 48px header + (slotIndex * 16px) for perfect alignment
- June 22, 2025. CENTERED HOUR TEXT - Hour labels now center-align with timeline grid lines for professional appearance
- June 22, 2025. SYNCHRONIZED GHOST MEETING - Ghost meeting during drag operations now aligns perfectly with corrected timeline positioning
- June 22, 2025. FINE-TUNED TIMELINE WEIGHTS - Set hour markers to 2.25px and 15-minute markers to 1.7px for precise visual balance and optimal readability
- June 22, 2025. MEETING ALIGNMENT CORRECTED - Implemented exact day view positioning logic in week view, ensuring 9:00 AM meetings align with 9:00 AM timeline markers using pixel-perfect calculations
- June 22, 2025. WEEK VIEW COMPLETELY RECONSTRUCTED - Full feature implementation with pixel-perfect alignment, drag-and-drop, and all interactive capabilities
- June 22, 2025. Reconstructed WeekViewComplete component from deployment package with all requested features: pixel-perfect timeline alignment, comprehensive drag-and-drop functionality, single/double-click interactions, empty slot scheduling
- June 22, 2025. Fixed timeline alignment using exact formula: 48px header + (timeSlotIndex * 16px) to eliminate 9:00am/9:30am misalignment issues
- June 22, 2025. Integrated complete meeting summary modal with edit/delete options accessible via single-click
- June 22, 2025. Added comprehensive time slot click handling for new meeting creation with proper date/time context
- June 22, 2025. Synchronized category colors across all views (destination: #FF6B6B, liquor: #4ECDC4, tobacco: #45B7D1, pnc: #96CEB4, confectionary: #FFEAA7, fashion: #DDA0DD)
- June 22, 2025. Enhanced drag-and-drop with visual feedback (rotation, scaling, drop zone indicators) and permission validation
- June 22, 2025. Cleaned up debug logging and completed week view integration with proper prop handling
- June 22, 2025. COMPLETE REBUILD SUCCESS - Both day view and week view fully restored with enhanced functionality
- June 22, 2025. Week view now uses same pixel-perfect alignment formula: 48px header + (timeSlotIndex * 16px)  
- June 22, 2025. Week view enhanced with complete drag-and-drop functionality and visual feedback
- June 22, 2025. Single click meetings show details modal with edit/delete options in both views
- June 22, 2025. Double click meetings opens edit form directly in both views
- June 22, 2025. Double click empty time slots opens new meeting form with prefilled date/time in both views
- June 22, 2025. Synchronized category colors across all views (destination: #FF6B6B, liquor: #4ECDC4, tobacco: #45B7D1, pnc: #96CEB4, confectionary: #FFEAA7, fashion: #DDA0DD)
- June 22, 2025. Enhanced drag-and-drop with visual feedback (rotation, scaling, drop zone indicators) in both views
- June 22, 2025. Fixed 9:00am meeting aligning with 9:30am timeline issue using timeSlots array indexing across all calendar views
- June 22, 2025. Added MeetingSummary modal integration to week view for complete functionality parity
- June 20, 2025. FINAL ALIGNMENT SUCCESS - Unified positioning system using timeSlots array indexing
- June 20, 2025. Both time labels and meetings now use identical logic: 48px header + (timeSlotIndex * 16px)
- June 20, 2025. Eliminated positioning inconsistencies by mapping directly to timeSlots array structure
- June 20, 2025. Meetings now align perfectly with their corresponding time grid positions
- June 20, 2025. CORRECTED ALIGNMENT CALCULATIONS - Fixed 9:15 meeting aligning to 10:00 AM line issue
- June 20, 2025. Time labels positioned consistently: 48px header + (hourIndex * 64px)
- June 20, 2025. Meeting blocks positioned consistently: 48px header + (slotIndex * 16px)
- June 20, 2025. Removed conflicting transforms and offsets for clean mathematical alignment
- June 20, 2025. PERFECTED meeting block alignment - meetings now sit exactly on their corresponding time lines with pixel-perfect precision
- June 20, 2025. Fixed positioning calculations to use consistent formula: 48px header + (slotIndex * 16px) + 8px offset
- June 20, 2025. Updated pixelToTime function to match meeting positioning for seamless drag-and-drop alignment
- June 20, 2025. ENHANCED drag-and-drop functionality - removed blue dotted slot indicator for cleaner visual experience
- June 20, 2025. Added animated sidebar with smooth transitions and mobile support using framer-motion
- June 20, 2025. Created AppLayout component with responsive sidebar that adapts to screen size
- June 20, 2025. Implemented touch support for mobile drag-and-drop functionality
- June 20, 2025. Enhanced drag visual feedback with rotation, scaling, and shadow effects
- June 20, 2025. Added intuitive drop zone highlighting during drag operations
- June 20, 2025. FIXED category reordering - resolved NaN value error by improving displayOrder validation and type checking
- June 20, 2025. Enhanced category reordering logic to handle null/undefined displayOrder values properly
- June 20, 2025. Added proper backend validation to prevent invalid displayOrder values from causing database errors
- June 20, 2025. Initialized proper sequential displayOrder values for all existing categories
- June 20, 2025. Added category reordering functionality to Manage Categories page with up/down arrow controls
- June 20, 2025. Implemented backend API endpoint (/api/categories/reorder) for updating category display order
- June 20, 2025. Categories now display in proper order based on displayOrder field with visual reordering controls
- June 20, 2025. Updated all deployment packages with category reordering functionality
- June 20, 2025. Added mandatory attendee validation - meetings cannot be scheduled without at least one mandatory attendee
- June 20, 2025. Enhanced form validation with clear error messages for missing requirements
- June 20, 2025. Reduced meeting form background transparency from 40% to 10% for improved text readability
- June 20, 2025. FIXED CRITICAL FORM BUG - Form inputs now persist user input correctly by preventing unnecessary form resets
- June 20, 2025. Resolved form state management issue where useEffect was constantly resetting form data on prop changes
- June 20, 2025. Form now only initializes when modal opens or when editing different meetings, maintaining user input integrity
- June 20, 2025. Updated button colors - Cancel button changed to red, Next button to soft green, added brand attendees section, and restored DDFS attendees functionality to Modern Meeting form
- June 20, 2025. Optimized Modern Meeting form for maximum readability with white background at 40% transparency, black text labels with bold font weight, and enhanced contrast throughout all form elements
- June 20, 2025. Changed meeting form background to grey-white tone for softer appearance
- June 20, 2025. Enhanced form input label colors to grey-800 for better readability
- June 20, 2025. Updated form header text with improved contrast and font weights
- June 20, 2025. Increased meeting form background opacity to 60% for optimal text readability
- June 20, 2025. Fixed double-click meeting interaction - meetings now open edit form when double-clicked
- June 20, 2025. Enhanced time slot clicking - empty slots trigger new meeting form with correct time context
- June 20, 2025. Updated ModernMeetingForm to handle both editing existing meetings and creating new ones
- June 20, 2025. Added proper form initialization based on scheduling context or editing state
- June 20, 2025. Integrated custom event system for seamless communication between calendar and forms
- June 20, 2025. Implemented comprehensive Wabi Sabi design system with modern, contemporary aesthetics
- June 20, 2025. Created natural color palette with organic shapes, textures, and typography
- June 20, 2025. Added WabiSabiLayout component with organic background elements and natural gradients
- June 20, 2025. Transformed login page with modern design featuring natural materials and mindful messaging
- June 20, 2025. Updated CSS variables for earth-tones, organic shadows, and contemporary spacing
- June 20, 2025. Enhanced Tailwind config with Wabi Sabi color extensions and organic border radius
- June 20, 2025. Created ModernMeetingForm with step-by-step wizard and natural design elements
- June 20, 2025. Applied contemporary styling to all UI components with natural aesthetics
- June 20, 2025. Added enhanced conflict checking endpoint with working hours validation
- June 20, 2025. Updated meeting form imports to use modern design components
- June 20, 2025. Added 15-minute minimum meeting duration validation with auto-adjustment of end time
- June 20, 2025. Enhanced attendee selection with mandatory/optional designation and validation
- June 20, 2025. Replaced complex MeetingForm with simplified SimpleMeetingForm component for reliable functionality
- June 19, 2025. Fixed meeting form functionality - removed restrictive category permissions and validation requirements
- June 19, 2025. All users can now access all categories for meeting scheduling regardless of role
- June 19, 2025. Simplified meeting creation validation to require only category selection and attendees
- June 19, 2025. Replaced shadcn Select with native HTML select for reliable category selection - resolves vendor user dropdown issues
- June 19, 2025. Fixed form initialization order to resolve category selection - resolved "Cannot access form before initialization" error
- June 19, 2025. Implemented Controller-based category selection with proper form binding - vendor users can now select categories
- June 19, 2025. Fixed category selection binding in meeting form for all user types - categories now properly save when selected
- June 19, 2025. Fixed category dropdown visibility for vendor users in meeting form
- June 19, 2025. Fixed meeting form modal access for vendor users - resolved Schedule Meeting button unresponsiveness
- June 19, 2025. Resolved vendor user button responsiveness by including vendor role in frontend permission checks
- June 19, 2025. Fixed frontend permission check to allow guest users to schedule meetings without restrictions
- June 19, 2025. Resolved vendor user scheduling issues by allowing guest users full access to attendees and categories
- June 19, 2025. Fixed backend permissions to allow guest users to schedule meetings and access attendee data
- June 19, 2025. Enabled guest users to schedule meetings while maintaining view restrictions
- June 19, 2025. Simplified guest user dropdown to show only logout option, removed all print and summary options
- June 19, 2025. Restricted guest user dropdown menu to logout option only, removed file management access
- June 19, 2025. Implemented comprehensive guest user restrictions across all UI components
- June 19, 2025. Implemented guest user restrictions - guests can only see blocked time slots without meeting details
- June 19, 2025. Updated all calendar views (week and day) to restrict guest user access to meeting information
- June 19, 2025. Updated all deployment packages with flat office space background image
- June 19, 2025. Synchronized all deployment folders (deployment-package, windows-installer, installer-package) with latest changes
- June 19, 2025. Updated login screen with professional flat office space background for complete page coverage
- June 19, 2025. Created single executable installer (calendar-app-installer.js) with interactive deployment wizard
- June 19, 2025. Updated deployment-package.zip with latest application code and database fixes
- June 19, 2025. Fixed database connection issues by switching from WebSocket to HTTP connection
- June 19, 2025. Updated all deployment packages (Windows installer, installer package, deployment package) with database connection fix
- June 19, 2025. Added database connection testing before app startup for better error handling
- June 17, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```