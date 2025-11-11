# Module 8: Performance & Goals

## Overview
Lightweight, continuous performance management system focused on goal setting, regular check-ins, and development conversations, moving away from dreaded annual reviews.

## 8.1 Goal Management

### Purpose
Enable transparent goal setting and tracking aligned with company objectives, fostering accountability and growth.

### Key Features

#### Goal Framework Support
- **OKRs (Objectives & Key Results)**
  - Objective: Qualitative, ambitious goal
  - 3-5 Key Results: Quantitative, measurable outcomes
  - Scoring: 0-100% achievement
  
- **SMART Goals**
  - Specific, Measurable, Achievable, Relevant, Time-bound
  - Simple checkbox-based tracking
  
- **Company-Wide Goals**
  - Leadership sets company objectives
  - Cascade to departments → teams → individuals
  - Alignment visibility

#### Goal Creation
- **Goal Fields**
  - Title
  - Description
  - Type (OKR, SMART, Custom)
  - Owner (employee setting the goal)
  - Timeframe (Q1, Q2, Annual, Custom dates)
  - Alignment (parent goal, if applicable)
  - Privacy (Public, Team, Private)
  
- **Key Results/Milestones**
  - Multiple measurable outcomes per goal
  - Initial value, target value, current value
  - Progress tracking (manual update or auto-calculated)
  
- **Collaborative Setting**
  - Employee drafts goals
  - Manager reviews and provides input
  - Both agree and finalize

#### Goal Tracking
- **Progress Updates**
  - Weekly/monthly check-in prompts
  - Quick update: % complete or metric value
  - Status: On Track, At Risk, Off Track
  - Notes/comments explaining progress
  
- **Visual Progress Bars**
  - Color-coded: Green (on track), Yellow (at risk), Red (off track)
  - Trend indicators (improving/declining)
  
- **Notifications**
  - Reminder to update progress
  - Manager notified of updates
  - Alert when goal goes off track

#### Goal Lifecycle
- **Draft → Active → Complete → Closed**
- **Mid-Cycle Adjustments**
  - Request to modify goal
  - Approval workflow
  - Track original vs adjusted
  
- **Goal Completion**
  - Self-assessment of achievement
  - Manager validation
  - Score/rating
  - Lessons learned

### UI/UX Design

#### Goal Board (Kanban View)
- **Columns**: To Do, In Progress, Completed
- **Goal Cards**: Draggable, showing title, progress bar, due date
- **Filters**: My Goals, Team Goals, Company Goals

#### Goal Detail Modal
- **Header**: Title, owner, status badge
- **Key Results**: List with individual progress
- **Activity Feed**: All updates chronologically
- **Actions**: Update Progress, Edit, Complete, Delete

---

## 8.2 Check-Ins & 1:1 Meetings

### Purpose
Facilitate regular, meaningful conversations between managers and employees, replacing infrequent formal reviews.

### Key Features

#### Check-In Types
- **Weekly Sync**
  - Quick touchpoint (15-30 min)
  - What's on your plate this week?
  - Any blockers?
  
- **Monthly Review**
  - Deeper discussion (30-45 min)
  - Goal progress
  - Feedback exchange
  - Development discussion
  
- **Quarterly Deep-Dive**
  - Strategic conversation (60 min)
  - Career aspirations
  - Skills assessment
  - Performance review

#### Shared Agenda
- **Pre-Meeting**
  - Both employee and manager add topics
  - System suggests topics (overdue goals, recent achievements)
  - Attach relevant documents
  
- **Meeting Template**
  - Wins/Accomplishments
  - Challenges/Roadblocks
  - Priorities for next period
  - Feedback (both directions)
  - Development opportunities
  - Action items
  
- **During Meeting**
  - Collaborative note-taking
  - Check off discussed topics
  - Add new action items
  - Rate mood/energy (optional)

#### Action Items
- **Capture To-Dos**
  - Assignee (employee or manager)
  - Due date
  - Description
  - Link to goal (if applicable)
  
- **Tracking**
  - Appears on both parties' dashboards
  - Reminder notifications
  - Status updates
  - Review in next check-in

#### Check-In History
- **Timeline View**
  - All past check-ins chronologically
  - Expand to see notes
  - Track recurring themes
  - Export for performance review

### UI/UX Design

#### Check-In Dashboard (Manager)
- **Upcoming 1:1s**: Calendar widget
- **My Team**: List of direct reports with "Schedule Check-In" button
- **Overdue Check-Ins**: Alert banner

#### Check-In Interface
- **Split Panel**
  - Left: Shared agenda (editable by both)
  - Right: Context (employee's active goals, recent work)
  
- **Agenda Sections**
  - Expandable accordions per topic
  - Rich text input for notes
  - Checkboxes for action items
  
- **Bottom Actions**
  - Save Draft
  - Complete Check-In (archives agenda)
  - Schedule Next Check-In

---

## 8.3 Feedback Exchange

### Purpose
Enable continuous, constructive feedback between colleagues, fostering growth and recognition.

### Key Features

#### Feedback Types
- **Praise/Recognition**
  - What went well
  - Specific behavior appreciated
  - Public or private
  
- **Constructive Feedback**
  - Observation (what happened)
  - Impact (how it affected you/team)
  - Suggestion (how to improve)
  - Always private initially
  
- **Peer Feedback**
  - Request feedback from colleagues
  - For specific project or skill
  - Anonymous option

#### Feedback Flow
- **Give Feedback**
  - Select recipient
  - Choose type
  - Write feedback (guided template)
  - Decide visibility (private, shared with manager, public)
  - Send
  
- **Receive Feedback**
  - Notification of new feedback
  - View in private inbox
  - Acknowledge receipt
  - Add to development plan
  - Thank sender (optional)

#### 360-Degree Feedback (Phase 2)
- Request feedback from multiple sources
- Manager, peers, direct reports (if applicable), self
- Anonymous aggregation
- Compiled report

### UI/UX Design

#### Feedback Inbox
- **Tabs**: Received, Given, Requested
- **Filter**: By type, date, person
- **Actions**: Reply, Archive, Add to Goals

---

## 8.4 Performance Reviews (Simplified)

### Purpose
Lightweight review process for formal evaluation periods, leveraging ongoing check-ins.

### Key Features

#### Review Cycle Setup (Admin)
- **Frequency**: Annual, Semi-annual, Quarterly
- **Review Template**: Questions/sections to complete
- **Timeline**: Deadlines for each step
- **Participants**: Self, Manager, Peers (optional)

#### Review Process
1. **Self-Assessment**
   - Employee reflects on goals achieved
   - Highlights accomplishments
   - Identifies areas for development
   
2. **Manager Assessment**
   - Review employee's self-assessment
   - Add own evaluation
   - Reference check-in notes
   - Provide rating (if applicable)
   
3. **Review Meeting**
   - Scheduled 1:1 to discuss
   - Agree on final rating
   - Set goals for next period
   
4. **Documentation**
   - Both sign off
   - Stored in employee profile
   - Accessible anytime

#### Review Dashboard
- **Active Reviews**: In progress
- **Overdue Reviews**: Past deadline
- **Completed Reviews**: Archived

### UI/UX Design

#### Review Form
- **Sections**
  - Goal Achievement Summary (pulled from goal module)
  - Competencies (predefined or custom)
  - Overall Rating
  - Comments
  - Development Plan
  
- **Navigation**: Previous/Next section, Save Draft, Submit

---

## Technical Requirements

### Database Schema
```sql
goals (id, employee_id, title, description, type, status, start_date, end_date, parent_goal_id, privacy_level)
key_results (id, goal_id, description, initial_value, target_value, current_value, unit)
goal_updates (id, goal_id, updated_by, progress_percent, status, notes, created_at)
check_ins (id, employee_id, manager_id, type, scheduled_date, completed_at, agenda_json, notes_json)
action_items (id, check_in_id, description, assignee_id, due_date, status)
feedback (id, giver_id, receiver_id, type, content, visibility, given_at)
reviews (id, employee_id, cycle_id, status, self_assessment, manager_assessment, final_rating)
```

### API Endpoints
```
POST /goals - Create goal
PUT /goals/:id/progress - Update progress
GET /goals/team - Get team goals
POST /check-ins - Schedule check-in
PUT /check-ins/:id - Update agenda
POST /check-ins/:id/complete - Complete check-in
POST /feedback - Give feedback
GET /feedback/received - Get my feedback
GET /reviews/me - Get my reviews
```

---

## Phase 1 Implementation

### Must-Have (MVP)
- ✅ Basic goal creation and tracking (OKR support)
- ✅ Goal board (Kanban view)
- ✅ Check-in scheduling
- ✅ Shared agenda with note-taking
- ✅ Action item tracking
- ✅ Simple feedback (praise and constructive)

### Should-Have
- ✅ Goal cascading (company → team → individual)
- ✅ Progress notifications
- ✅ Check-in history
- ✅ Feedback inbox
- ✅ Performance review cycle

### Phase 2
- ⏳ Advanced goal analytics
- ⏳ 360-degree feedback
- ⏳ AI-powered development suggestions
- ⏳ Competency frameworks
- ⏳ Calibration sessions for managers
- ⏳ Integration with compensation planning

---

## Success Metrics
- Goal completion rate: > 75%
- Check-in frequency: > 2 per month per manager-employee pair
- Employee satisfaction with performance process: > 4/5
- Feedback given per employee per quarter: > 3
- Managers trained on check-ins: 100%
- Time spent on annual review: Reduced by 60%