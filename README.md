# Calendar Scheduling App v11.0

A comprehensive calendar scheduling platform with AI-powered meeting management, voice-activated scheduling, and mobile-responsive design.

## Features

### Core Functionality
- **Meeting Management**: Create, edit, and manage meetings with detailed attendee tracking
- **Calendar Views**: Week and day views with 15-minute time slots (8 AM - 8 PM)
- **Category-Based Organization**: Liquor, Tobacco, PNC, Confectionary, Fashion categories
- **Role-Based Access Control**: Admin, Manager, Vendor roles with specific permissions

### Advanced Features
- **Voice-Activated Scheduling**: Natural language voice commands for meeting creation
- **AI-Powered Suggestions**: Smart meeting time recommendations and conflict resolution
- **Conflict Detection**: Automatic detection of overlapping meetings for mandatory attendees
- **Buffer Time Management**: 10-minute buffer between meetings with violation warnings
- **Excel/iCal Export**: Export calendar data in multiple formats
- **Excel Import**: Import meetings from Excel templates

### Mobile-First Design
- **iPhone 16 Pro Optimized**: Enhanced mobile interface with responsive design
- **Touch-Friendly Navigation**: Optimized for mobile interaction
- **Offline Capabilities**: Limited offline functionality for mobile users
- **Voice Input**: Mobile-optimized voice scheduling

### User Management
- **Authentication System**: Secure login with role-based permissions
- **DDFS Attendees**: Comprehensive attendee management system
- **Global Settings**: Configurable application settings
- **Password Management**: User password change functionality

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **React Query** for data management
- **Wouter** for routing
- **Framer Motion** for animations

### Backend
- **Express.js** with TypeScript
- **PostgreSQL** database with Drizzle ORM
- **Zod** for validation
- **Session-based authentication**

### Voice Recognition
- **Web Speech API** for voice input
- **Natural language processing** for command parsing
- **Real-time speech-to-text** conversion

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd calendar-scheduling-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Configure your database URL and other settings
   ```

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## Environment Variables

```env
DATABASE_URL=postgresql://username:password@localhost:5432/calendar_db
SESSION_SECRET=your-session-secret
OPENAI_API_KEY=your-openai-api-key (optional, for AI features)
```

## Usage

### Voice Commands
The application supports natural language voice commands:

- "Schedule meeting for project review tomorrow at 2 PM"
- "Create meeting with sales team on 29th of September from 9 AM to 10 AM"
- "Book meeting about quarterly planning next Monday in conference room"

### Meeting Categories
- **Liquor**: Meetings related to liquor products
- **Tobacco**: Tobacco product discussions
- **PNC**: Personal and cosmetic items
- **Confectionary**: Candy and sweet products
- **Fashion**: Fashion and apparel items

### User Roles
- **Admin**: Full access to all features and user management
- **Manager**: Meeting management and reporting access
- **Vendor**: Limited access to specific category meetings

## Mobile Interface

The application is optimized for mobile devices with:
- Responsive design that works on all screen sizes
- Touch-friendly controls and navigation
- Voice input for hands-free meeting scheduling
- Optimized forms and interfaces for mobile use

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/user` - Get current user

### Meetings
- `GET /api/meetings` - Get all meetings
- `POST /api/meetings` - Create new meeting
- `PUT /api/meetings/:id` - Update meeting
- `DELETE /api/meetings/:id` - Delete meeting

### Export/Import
- `GET /api/export/excel` - Export calendar as Excel
- `GET /api/export/ical` - Export calendar as iCal
- `POST /api/import/excel` - Import from Excel file

## Development

### Project Structure
```
calendar-scheduling-app/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utility functions
├── server/                # Express backend
│   ├── routes.ts          # API routes
│   ├── storage.ts         # Data access layer
│   └── index.ts           # Server entry point
├── shared/                # Shared types and schemas
│   └── schema.ts          # Database schema
└── package.json
```

### Building for Production
```bash
npm run build
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team.

---

**Version 11.0** - Latest features include voice-activated scheduling, enhanced mobile interface, and comprehensive meeting management system.