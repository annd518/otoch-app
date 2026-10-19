# PariwarCare - Healthcare Management System Documentation

## Локалд ажиллуулах (Windows)

Нэг командаар: сервер, админ вэб, Expo тус бүр өөрийн цонхонд нээгдэнэ. Аль ч хавтаснаас ажиллана, эсвэл Explorer-оос `dev.cmd`-ийг давхар товшино.

```
D:\hulgai\Pariwar-Care-\dev.cmd          # API + админ вэб + Expo
D:\hulgai\Pariwar-Care-\dev.cmd web      # API + админ вэб (http://localhost:3000)
D:\hulgai\Pariwar-Care-\dev.cmd app      # API + Expo
D:\hulgai\Pariwar-Care-\dev.cmd api      # зөвхөн API (http://localhost:8000)
```

Зогсоохдоо тухайн цонхыг хаана. Анх удаа `server`, `wclient`, `App` хавтас бүрт `npm install` хийсэн байх шаардлагатай.

## 🏥 Project Overview

**PariwarCare** is a comprehensive healthcare management platform designed to bridge the gap between Nepalese diaspora and their parents' healthcare needs back home. The system enables remote monitoring, professional nursing care, and real-time health tracking through a multi-platform ecosystem.

### Vision Statement
*"Your parents won't say they're sick. Our nurse will."*

### Mission
To provide professional healthcare monitoring for parents in Nepal, managed remotely by their children living abroad, creating a sustainable healthcare model that prevents emergencies through regular monitoring.

---

## 🏗️ System Architecture

### Multi-Platform Architecture
The system consists of three main applications:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Web Client    │    │   Backend API   │
│   (React Native)│    │   (Next.js)     │    │   (Node.js)     │
│                 │    │                 │    │                 │
│ • Child Users   │    │ • Admin Panel   │    │ • Authentication│
│ • Appointments  │    │ • Nurse Portal  │    │ • Visit Mgmt    │
│ • Notifications │    │ • Medical Admin │    │ • Data Storage  │
│ • Parent Mgmt   │    │ • Analytics     │    │ • Email Service │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   Database      │
                    │                 │
                    │ • User Data     │
                    │ • Visit Records │
                    │ • Health Vitals │
                    │ • Relationships │
                    └─────────────────┘
```

### Technology Stack

#### Backend (Server)
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT tokens with bcrypt
- **File Upload**: Express-fileupload
- **Email**: Nodemailer
- **API Documentation**: Swagger UI
- **Validation**: Zod schemas

#### Web Client (wclient)
- **Framework**: Next.js 16 with React 19
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Lucide icons
- **Charts**: Recharts for analytics
- **Animations**: Framer Motion
- **State Management**: React Context API
- **Notifications**: React Hot Toast

#### Mobile App (App)
- **Framework**: React Native with Expo
- **Navigation**: Expo Router
- **Storage**: AsyncStorage
- **HTTP Client**: Axios
- **Maps**: React Native Maps
- **UI**: Custom styled components

---

## 🎯 Core Features & Use Cases

### 1. User Management System
**Roles & Permissions:**
- **CHILD**: Schedule visits, manage parents, view approved health reports
- **NURSE**: Conduct visits, record vitals, submit reports
- **MEDICAL_ADMIN**: Review and approve/reject health reports
- **ADMIN**: System administration, user management, nurse assignment

### 2. Parent Health Monitoring
**Key Features:**
- Parent profile management (demographics, medical history)
- Monthly home visit scheduling
- Real-time health vital tracking
- Emergency contact management
- Medication adherence monitoring

### 3. Visit Management Workflow
```
Visit Lifecycle:
PENDING → ASSIGNED → STARTED → WAITING_APPROVAL → APPROVED
                                      ↓
                               REVISION_REQUIRED
```

**Visit Types:**
- **BASIC**: Standard health checkup (45 minutes)
- **FULL**: Comprehensive health assessment with additional tests

### 4. Health Data Collection
**Vital Signs Monitored:**
- Blood Pressure (BP)
- Blood Sugar levels
- Pulse rate
- Oxygen saturation
- Body temperature
- General health notes
- Medication recommendations

### 5. Medical Review System
- Medical professionals review all health reports
- Quality assurance before family notification
- Revision requests for incomplete/unclear reports
- Approval workflow with detailed notes

### 6. Real-time Communication
- Instant notifications for health alerts
- Email notifications for visit completions
- Dashboard updates for family members
- Emergency contact protocols

---

## 🔄 Workflow Documentation

### Child User Workflow
1. **Registration & Setup**
   - Create account with CHILD role
   - Add parent profiles with medical history
   - Set up emergency contacts

2. **Visit Scheduling**
   - Schedule monthly visits for parents
   - Choose visit type (BASIC/FULL)
   - Receive confirmation and nurse assignment

3. **Monitoring & Updates**
   - Receive real-time health updates
   - View approved health reports
   - Track health trends over time
   - Get emergency notifications

### Nurse Workflow
1. **Assignment Reception**
   - Receive visit assignments from admin
   - View parent medical history and location
   - Prepare for scheduled visits

2. **Visit Execution**
   - Start visit session
   - Conduct health assessment
   - Record vital signs and observations
   - Submit comprehensive report

3. **Follow-up**
   - Await medical review approval
   - Address revision requests if needed
   - Maintain visit documentation

### Medical Admin Workflow
1. **Report Review**
   - Review submitted health reports
   - Verify vital signs accuracy
   - Check completeness of documentation

2. **Decision Making**
   - Approve reports for family viewing
   - Request revisions for incomplete reports
   - Add medical recommendations

3. **Quality Assurance**
   - Ensure medical standards compliance
   - Maintain review documentation
   - Monitor nurse performance

### System Admin Workflow
1. **User Management**
   - Create and manage user accounts
   - Assign roles and permissions
   - Monitor system usage

2. **Nurse Assignment**
   - Assign nurses to pending visits
   - Balance workload distribution
   - Manage nurse availability

3. **System Monitoring**
   - Monitor system performance
   - Manage data backups
   - Handle technical issues

---

## 📊 Database Schema

### Core Entities

#### User Table
```sql
User {
  id: String (Primary Key)
  name: String
  email: String (Unique)
  password: String (Hashed)
  role: Enum (CHILD, NURSE, MEDICAL_ADMIN, ADMIN)
  createdAt: DateTime
}
```

#### Parent Table
```sql
Parent {
  id: String (Primary Key)
  name: String
  age: Integer
  gender: String
  address: String
  diseases: String (Optional)
  medications: String (Optional)
  emergencyContact: String
  children: User[] (Many-to-Many)
}
```

#### Visit Table
```sql
Visit {
  id: String (Primary Key)
  parentId: String (Foreign Key)
  nurseId: String (Foreign Key, Optional)
  scheduledFor: DateTime
  visitType: Enum (BASIC, FULL)
  status: Enum (PENDING, ASSIGNED, STARTED, WAITING_APPROVAL, REVISION_REQUIRED, APPROVED)
  notes: String (Optional)
  completedAt: DateTime (Optional)
  approvedById: String (Foreign Key, Optional)
  approvalNote: String (Optional)
  rejectionNote: String (Optional)
  approvedAt: DateTime (Optional)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### Vitals Table
```sql
Vitals {
  id: String (Primary Key)
  visitId: String (Foreign Key, Unique)
  bp: String (Optional)
  sugar: String (Optional)
  pulse: String (Optional)
  oxygen: String (Optional)
  temperature: String (Optional)
  notes: String (Optional)
  medicines: String (Optional)
  createdAt: DateTime
}
```

---

## 🔌 API Documentation

### Base Configuration
- **Base URL**: `http://localhost:8000/api`
- **Authentication**: JWT Bearer tokens
- **Content Type**: `application/json`

### Key Endpoints

#### Authentication
- `POST /auth/signup` - User registration
- `POST /auth/login` - User authentication

#### Parent Management
- `GET /parents` - List user's parents
- `POST /parents` - Add new parent
- `PUT /parents/:id` - Update parent info
- `DELETE /parents/:id` - Remove parent

#### Visit Management
- `POST /visits` - Schedule new visit
- `GET /visits/child` - Get child's visits
- `GET /visits/nurse` - Get nurse's visits
- `POST /visits/:id/assign` - Assign nurse (Admin)
- `POST /visits/:id/start` - Start visit (Nurse)
- `POST /visits/:id/vitals` - Submit vitals (Nurse)

#### Medical Review
- `GET /review/visits/review` - Pending reviews
- `POST /review/visits/:id/approve` - Approve report
- `POST /review/visits/:id/reject` - Request revision

#### Analytics
- `GET /analytics/parent/:id/trends` - Health trends

---

## 🚀 Deployment & Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm/yarn package manager

### Environment Variables
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/nepathon"

# Authentication
JWT_SECRET="your-jwt-secret-key"

# Email Service
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"

# Server
PORT=8000
NODE_ENV="development"
```

### Installation Steps

#### 1. Backend Setup
```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

#### 2. Web Client Setup
```bash
cd wclient
npm install
npm run dev
```

#### 3. Mobile App Setup
```bash
cd App
npm install
npx expo start
```

### Database Migration
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Reset database (if needed)
npx prisma migrate reset
```

---

## 🔒 Security Features

### Authentication & Authorization
- JWT token-based authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Session management with HTTP-only cookies

### Data Protection
- Input validation with Zod schemas
- SQL injection prevention via Prisma ORM
- XSS protection with sanitized inputs
- CORS configuration for cross-origin requests

### Medical Data Privacy
- Health data only visible after medical approval
- Encrypted data transmission
- Audit trails for all medical actions
- Secure file upload handling

### API Security
- Rate limiting implementation
- Request validation middleware
- Error handling without data exposure
- Secure headers configuration

---

## 📈 Analytics & Monitoring

### Health Trends Tracking
- Weekly/monthly vital sign trends
- Comparative health analysis
- Early warning system for anomalies
- Medication adherence tracking

### System Analytics
- User engagement metrics
- Visit completion rates
- Nurse performance tracking
- System usage statistics

### Reporting Features
- Automated health reports
- Family notification system
- Medical review summaries
- Emergency alert protocols

---

## 🎨 User Interface Design

### Design Principles
- **Accessibility First**: Large fonts, clear contrasts, intuitive navigation
- **Mobile Responsive**: Optimized for all device sizes
- **Cultural Sensitivity**: Nepali language support, cultural considerations
- **Simplicity**: Easy-to-use interface for elderly users

### Key UI Components
- **Dashboard**: Real-time health status overview
- **Visit Scheduler**: Calendar-based appointment booking
- **Health Reports**: Visual charts and trend analysis
- **Notification Center**: Alert management system
- **Profile Management**: User and parent information

### Color Scheme & Branding
- **Primary**: Blue (#2f80ed) - Trust and healthcare
- **Secondary**: Green (#27ae60) - Health and wellness
- **Accent**: Purple (#8e44ad) - Premium care
- **Neutral**: Gray scale for text and backgrounds

---

## 🌍 Impact & Social Value

### Problem Addressed
- **2M+ Nepalese abroad** with elderly parents in Nepal
- **75% hide illness** from children to avoid worry
- **40% diseases found too late** due to delayed detection
- **₹800K average emergency cost** vs **₹5K monthly prevention**

### Solution Benefits
- **Early Detection**: Regular monitoring prevents emergencies
- **Peace of Mind**: Real-time health updates for families
- **Professional Care**: Trained nurses provide quality healthcare
- **Cost Effective**: Prevention costs 160x less than emergency treatment

### Economic Impact
- **1000+ Nurse Jobs**: Reduces brain drain, creates employment
- **₹2B Healthcare Savings**: Reduces emergency healthcare burden
- **New Care Model**: Diaspora-funded healthcare innovation
- **Scalable Solution**: Replicable across South Asian communities

---

## 🔮 Future Roadmap

### Phase 1 (Current)
- ✅ Core platform development
- ✅ Basic visit management
- ✅ Health data collection
- ✅ Medical review system

### Phase 2 (Next 6 months)
- 🔄 AI-powered health insights
- 🔄 Telemedicine integration
- 🔄 Medication delivery system
- 🔄 Multi-language support

### Phase 3 (Next 12 months)
- 📋 IoT device integration
- 📋 Predictive health analytics
- 📋 Insurance partnerships
- 📋 Regional expansion

### Phase 4 (Long-term)
- 📋 Government healthcare integration
- 📋 Research data contribution
- 📋 International scaling
- 📋 Chronic disease management

---

## 🤝 Contributing Guidelines

### Development Standards
- **Code Style**: ESLint + Prettier configuration
- **Testing**: Unit tests for critical functions
- **Documentation**: Inline comments and API docs
- **Version Control**: Git flow with feature branches

### Pull Request Process
1. Fork the repository
2. Create feature branch
3. Implement changes with tests
4. Update documentation
5. Submit pull request with description

### Code Review Criteria
- Functionality correctness
- Security considerations
- Performance optimization
- Code maintainability
- Documentation completeness

---

## 📞 Support & Contact

### Technical Support
- **Email**: tech@pariwarcare.com
- **Documentation**: Internal API docs at `/api-docs`
- **Issue Tracking**: GitHub Issues

### Business Inquiries
- **Email**: hello@pariwarcare.com
- **Website**: www.pariwarcare.com

### Emergency Protocols
- **24/7 Hotline**: For medical emergencies
- **Escalation Matrix**: Defined response procedures
- **Backup Systems**: Redundancy for critical operations

---

## 📄 License & Legal

### Software License
- **Type**: Proprietary Software
- **Usage**: Internal development and deployment
- **Restrictions**: No redistribution without permission

### Data Privacy
- **Compliance**: GDPR-inspired data protection
- **Medical Data**: HIPAA-equivalent security standards
- **User Consent**: Explicit consent for data collection
- **Data Retention**: Defined retention policies

### Terms of Service
- **User Responsibilities**: Defined usage guidelines
- **Service Availability**: SLA commitments
- **Liability Limitations**: Legal protections
- **Dispute Resolution**: Arbitration procedures

---

*This documentation serves as the comprehensive guide for the PariwarCare healthcare management system. For technical implementation details, refer to the individual component documentation and API specifications.*

