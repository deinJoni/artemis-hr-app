# Module 5: Recruiting & ATS (Applicant Tracking System)

## Overview
End-to-end recruiting solution from job requisition to hire, with AI-powered candidate matching, multi-channel distribution, and seamless communication.

## 5.1 Job Management

### Purpose
Streamline job creation, approval, and multi-channel distribution with intelligent optimization.

### Key Features

#### Job Creation & Templates
- **AI Job Description Generator**
  - Input: Role title, key requirements (bullet points)
  - Output: Complete, optimized job description
  - Tone adjustment (formal, casual, innovative)
  - Bias-free language checking
  - SEO optimization for job boards
  
- **Template Library**
  - Pre-built templates by role/industry
  - Company-specific template creation
  - Clone existing jobs
  - Version history

#### Job Details
- Job ID (auto-generated)
- Title, department, location
- Employment type (Full-time, Part-time, Contract, Freelance)
- Remote/Hybrid/On-site
- Salary range (optional, can be hidden)
- Required skills, experience level
- Benefits and perks
- Application deadline

#### Approval Workflow
- Submit for approval before posting
- Multi-level approval chain (Hiring Manager → HR → Finance)
- Budget verification
- Headcount authorization
- Approval/rejection with comments

#### Multi-Channel Distribution
- **One-Click Posting**
  - Select channels from pre-configured list
  - Checkbox interface: LinkedIn, Indeed, StepStone, Jobs.bg, Glassdoor
  - Social media: Instagram, Facebook, TikTok (with formatted posts)
  - Company career site (auto-published)
  
- **QR Code Generation**
  - Generate unique QR code linking to application
  - For offline recruiting (job fairs, posters)
  - Track applications by QR source
  
- **Budget Management**
  - Set budget per job
  - Track spend across channels
  - Cost-per-click and cost-per-application metrics
  - Auto-pause when budget reached

### UI/UX Design

#### Job List View
- Card-based grid or table view toggle
- Status badges: Draft, Pending Approval, Active, Paused, Filled, Closed
- Quick stats per job: Applications, Interviews, Offers
- Inline actions: Edit, Pause, Close, View Applications

#### Job Creation Wizard
**Step 1: Basic Info**
- Title, department, location, type
- AI suggestion: "Based on 'Sales Manager', we suggest these optimizations..."

**Step 2: Description**
- Rich text editor or AI generator toggle
- Preview panel showing candidate view
- Readability score and bias check

**Step 3: Requirements**
- Add skills with proficiency level
- Experience range slider
- Education requirements
- Optional/Required toggle per item

**Step 4: Distribution**
- Channel selector with checkboxes
- Recommended channels highlighted (based on role/location)
- Budget allocation per channel
- Scheduled publish date/time

**Step 5: Review & Submit**
- Summary card
- Submit for approval or Publish now (if authorized)

#### Job Dashboard
- Active jobs counter
- Total applications this month
- Funnel conversion rate
- Top performing channels

---

## 5.2 Candidate Pipeline

### Purpose
Visual, intuitive candidate tracking from application to hire with collaborative evaluation.

### Key Features

#### Pipeline Stages
- **Default Stages**
  1. Applied
  2. Screening
  3. Interview (can have multiple rounds)
  4. Offer
  5. Hired
  6. Rejected (at any stage)
  
- **Customizable Stages**
  - Add, remove, rename stages per job or globally
  - Define stage-specific actions (e.g., "Screening" → auto-send email)

#### Candidate Profile
- **Sourced Data**
  - Name, email, phone
  - Resume/CV (PDF, DOC)
  - Cover letter
  - LinkedIn profile link
  - Portfolio/website
  - Application answers
  
- **AI-Enhanced Data**
  - Parsed resume data (education, experience, skills)
  - Match score vs job requirements
  - Duplicate detection across jobs
  - Skills extracted and tagged
  
- **Activity Timeline**
  - All interactions (emails, SMS, calls)
  - Stage movements
  - Notes and evaluations
  - Document uploads
  - Interview feedback

#### Candidate Actions
- Move to next stage (drag-and-drop)
- Schedule interview
- Send email/SMS
- Add to talent pool
- Reject with template message
- Create offer

#### Bulk Actions
- Select multiple candidates
- Mass move to stage
- Mass email
- Mass reject
- Export to CSV

### UI/UX Design

#### Kanban Pipeline View
- **Layout**: Full-width board with columns (stages)
- **Candidate Cards**:
  - Avatar (initials if no photo)
  - Name and current job title
  - Match score (e.g., 87%)
  - Days in current stage
  - Quick actions on hover: View, Email, Move, Reject
  
- **Drag-and-Drop**:
  - Smooth card movement between columns
  - Confirmation modal for "Reject" stage
  - Auto-save on drop
  - Undo option for 5 seconds
  
- **Filters & Search**:
  - Search by name, email, skills
  - Filter by source, date applied, match score
  - Sort by: Match score, Date applied, Last activity

#### Candidate Detail Panel
- **Slide-over from right (60% width)**
- **Header**: Name, match score, status badge, star rating
- **Tabs**:
  1. **Overview**: Key info, contact, resume preview
  2. **Timeline**: All activities chronologically
  3. **Evaluations**: Interview scorecards and feedback
  4. **Documents**: Resume, cover letter, certificates
  5. **Communication**: Email/SMS thread

- **Quick Actions Bar**:
  - Send Email, Schedule Interview, Move Stage, Reject
  - All actions stay in context without leaving detail view

---

## 5.3 Interview Management

### Purpose
Seamless interview coordination with automated scheduling and structured evaluation.

### Key Features

#### Smart Scheduling
- **Calendar Integration**:
  - Connect Google Calendar, Outlook
  - View interviewer availability in real-time
  - Automatic conflict detection
  - Time zone conversion
  
- **Self-Service Booking**:
  - Send candidate link to choose from available slots
  - No back-and-forth emails
  - Instant calendar invite upon selection
  - Automated reminders (24h, 1h before)

#### Interview Types
- Phone screen
- Video interview (integrated or external link)
- In-person
- Panel interview (multiple interviewers)
- Technical assessment

#### Interview Scorecards
- **Template-Based Evaluation**:
  - Predefined competencies per role
  - Rating scales (1-5 stars or 1-10 numeric)
  - Required vs optional criteria
  - Weighted scoring
  
- **Evaluation Areas**:
  - Technical skills
  - Communication
  - Culture fit
  - Problem-solving
  - Leadership (if applicable)
  
- **Bias Detection**:
  - AI flags potentially biased language in notes
  - Prompts evaluator to focus on observable behaviors
  - Aggregate scores hide individual evaluator names to reduce groupthink

#### Video Interview Platform
- **Integrated Video**:
  - One-click join from candidate email
  - No app download required (WebRTC)
  - Recording option (with consent)
  - Automated transcription
  
- **Asynchronous Video**:
  - Pre-recorded questions sent to candidate
  - Candidate records responses at their convenience
  - Reviewers watch and score independently
  - AI analysis of speech patterns, sentiment (Phase 3)

### UI/UX Design

#### Interview Scheduling Interface
- **Calendar View**:
  - Week view showing interviewer availability
  - Drag-to-select time slots
  - Multi-interviewer coordination (finds common slots)
  
- **Candidate Self-Schedule**:
  - Clean, branded page
  - Available slots displayed as buttons
  - Click to confirm
  - Instant confirmation email

#### Scorecard Form
- **Clean, focused interface**:
  - One competency per screen (or expandable sections)
  - Star rating or slider for each
  - Text area for notes (with AI suggestions)
  - "Save Draft" and "Submit" buttons
  
- **Aggregated View**:
  - All evaluators' scores in table
  - Average score highlighted
  - Outliers flagged for review
  - Export to PDF for hiring committee

---

## 5.4 Communication Hub

### Purpose
Unified, multi-channel communication with candidates, all logged and tracked.

### Key Features

#### Omni-Channel Messaging
- **Email**:
  - Built-in email composer
  - Template library with variables ({{candidate_name}}, {{job_title}})
  - Scheduled send
  - Open and click tracking
  
- **SMS**:
  - Quick text for urgent updates
  - Template library
  - Character count and cost preview
  - Opt-out management
  
- **WhatsApp**:
  - Two-way messaging
  - Read receipts
  - File sharing
  - Compliant with GDPR (logged conversations)

#### Email Templates
- Welcome/Acknowledgment
- Interview invitation
- Rejection (with talent pool opt-in)
- Offer letter
- Onboarding instructions
- Feedback request

#### Automated Sequences
- **Trigger-Based**:
  - Application received → Send acknowledgment (2 min delay)
  - Moved to Interview → Send scheduling link (immediate)
  - Rejected → Send template (1 hour delay)
  
- **Drip Campaigns**:
  - Talent pool nurture (monthly newsletter)
  - Re-engagement for old applicants

#### AI Response Suggestions
- Analyze incoming candidate emails
- Suggest responses based on context
- One-click to use suggestion or edit

### UI/UX Design

#### Inbox View
- **Conversation Threads**:
  - Grouped by candidate
  - Unread indicator
  - Last message preview
  - Quick reply inline
  
- **Compose Panel**:
  - Recipient auto-populated (candidate email)
  - Subject line (pre-filled based on context)
  - Rich text editor
  - Template dropdown
  - Attach files
  - Schedule send option

---

## 5.5 Talent Pool & CRM

### Purpose
Long-term relationship management with passive and previous candidates.

### Key Features

#### Intelligent Talent Pool
- **Automatic Saving**:
  - All qualified but not hired candidates saved
  - Opt-in during rejection flow
  - Manual add from any stage
  
- **AI Rediscovery**:
  - When new job posted, AI suggests matching candidates from pool
  - "You have 12 candidates in your talent pool who match this role"
  - One-click to move to pipeline

#### Engagement Scoring
- Track candidate interactions (email opens, link clicks, profile views)
- Score: Hot (high engagement), Warm, Cold
- Prioritize re-engagement efforts

#### Nurture Campaigns
- Monthly newsletter with company updates and new jobs
- Personalized job alerts based on skills/interests
- Event invitations (virtual career fairs, open houses)

### UI/UX Design

#### Talent Pool View
- **Searchable Database**:
  - Filters: Skills, location, availability, last contact
  - Match score to current open jobs
  - Bulk actions: Tag, Email, Add to campaign
  
- **Candidate Card**:
  - Name, title, skills tags
  - Engagement score indicator
  - Last contact date
  - Quick action: Reach out, Add to job

---

## 5.6 Source Tracking & Analytics

### Purpose
Data-driven recruiting optimization with ROI analysis.

### Key Features

#### Source Attribution
- Track where each candidate came from
- Sources: Direct apply, LinkedIn, Indeed, Referral, Job board, Social media, Event
- UTM parameter support for campaign tracking
- QR code tracking

#### Performance Metrics
- **Funnel Analysis**:
  - Applications → Screenings → Interviews → Offers → Hires
  - Conversion rates per stage
  - Bottleneck identification
  
- **Time Metrics**:
  - Time-to-hire (average days from post to hire)
  - Time-in-stage (identify slow stages)
  
- **Cost Metrics**:
  - Cost-per-application
  - Cost-per-hire
  - ROI per source channel
  
- **Quality Metrics**:
  - Offer acceptance rate
  - 90-day retention of hires
  - Performance rating of hires (if integrated with performance module)

#### Reports
- Pre-built dashboards
- Custom report builder
- Export to PDF, Excel, Google Sheets
- Scheduled email reports

### UI/UX Design

#### Analytics Dashboard
- **Key Metrics Cards**:
  - Total applications (this month vs last)
  - Active jobs
  - Average time-to-hire
  - Best performing source
  
- **Funnel Visualization**:
  - Sankey diagram showing flow
  - Color-coded by source
  - Click to drill down
  
- **Source Performance Table**:
  - Columns: Source, Applications, Hires, Cost, ROI
  - Sortable
  - Trend arrows (up/down vs previous period)

---

## Technical Requirements

### Database Schema
```
jobs (id, title, department_id, location_id, status, description, requirements, salary_min, salary_max, created_by, approved_by, published_at)
job_postings (job_id, channel, posted_at, budget, spent, status)
candidates (id, name, email, phone, resume_url, linkedin_url, source, applied_at)
applications (id, job_id, candidate_id, status, current_stage, match_score)
pipeline_stages (id, job_id, name, order, stage_type)
interviews (id, application_id, type, scheduled_at, interviewer_ids, location, meeting_link)
evaluations (id, interview_id, evaluator_id, scores, notes, submitted_at)
communications (id, candidate_id, type, direction, content, sent_at, delivered_at, opened_at)
talent_pool (candidate_id, added_at, engagement_score, tags, notes)
```

### API Endpoints
```
POST /jobs - Create job
GET /jobs - List jobs with filters
POST /jobs/:id/publish - Publish to channels
POST /candidates - Create candidate (application)
GET /candidates/:job_id - List candidates for job
PUT /candidates/:id/stage - Move candidate stage
POST /interviews - Schedule interview
POST /interviews/:id/evaluate - Submit evaluation
POST /communications/email - Send email
POST /communications/sms - Send SMS
GET /analytics/funnel?job_id= - Get funnel data
GET /analytics/sources - Get source performance
```

### Integrations
- Job board APIs (Indeed, LinkedIn, StepStone)
- Calendar APIs (Google, Outlook)
- Video platforms (Zoom, Teams, native WebRTC)
- SMS gateway (Twilio, Vonage)
- Email service (SendGrid, Amazon SES)
- E-signature for offer letters (DocuSeal, DocuSign)

---

## Phase 1 Implementation

### Must-Have (MVP)
- ✅ Job creation with templates
- ✅ AI job description generator (basic)
- ✅ Manual posting to top 5 job boards
- ✅ Kanban pipeline with drag-and-drop
- ✅ Candidate profiles with resume upload
- ✅ Email communication with templates
- ✅ Interview scheduling (manual calendar)
- ✅ Basic scorecards
- ✅ Simple analytics dashboard

### Should-Have
- ✅ Automated multi-channel posting
- ✅ AI candidate matching and ranking
- ✅ Self-service interview scheduling
- ✅ SMS and WhatsApp integration
- ✅ Talent pool with tagging
- ✅ Source tracking
- ✅ Advanced analytics

### Phase 2
- ⏳ Chatbot screening
- ⏳ Video interview platform (integrated)
- ⏳ AI video analysis
- ⏳ Predictive analytics (candidate success, pipeline forecasting)
- ⏳ CRM campaigns
- ⏳ Mobile recruiter app

---

## Success Metrics
- Time-to-fill: < 30 days (industry average: 42 days)
- Recruiter productivity: 50+ candidates managed per recruiter
- Candidate experience score: > 4.5/5
- Offer acceptance rate: > 85%
- Source ROI visibility: 100% of applications tracked