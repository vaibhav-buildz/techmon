# Techmon

> The network for people who build — a social platform for tech students and professionals.

![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.0-38BDF8?style=flat-square&logo=tailwind-css&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployment-000000?style=flat-square&logo=vercel&logoColor=white)

---

## Overview

Techmon is a full-stack social platform created specifically for developers, tech students, open-source contributors, and software professionals. It combines core social networking dynamics with portfolio tools and career discovery—allowing builders to post updates and code snippets, capture ephemeral stories, showcase completed projects, communicate in real time, build professional connections, and apply for tech opportunities.

---

## Features

### Authentication
- [x] Email and password authentication
- [x] GitHub OAuth integration
- [x] Google OAuth integration
- [x] Password reset workflow
- [x] Multi-account quick switching
- [x] Login activity tracking and security alerts (IP, geolocation, device, and browser detection)

### Profiles
- [x] Customizable user profiles (bio, avatar, headline, tech skills)
- [x] Unique handle / username validation
- [x] Follow/unfollow social network graph with follower and following counters

### Content
- [x] Notes with custom background themes and syntax highlighting for code snippets
- [x] Photo and Video posts with media uploads
- [x] Stories feature with webcam camera capture, filters, overlays, text editor, and 24-hour expiration
- [x] Story Highlights saved to user profiles
- [x] Reposting & post sharing system
- [x] Hashtag indexing (#hashtag) for topic discovery and feed filtering

### Engagement
- [x] Post likes with real-time counters
- [x] Nested comment threads with replies and comment likes
- [x] Saved posts organized into custom collections
- [x] Real-time notification system for likes, comments, follows, job applications, and security alerts

### Networking
- [x] Direct Messages (DM) with real-time updates and media attachments
- [x] Search modal across profiles, posts, projects, and hashtags
- [x] Suggested users recommendation algorithm based on activity and connections

### Career
- [x] Project portfolio showcase with repository links, live demos, and tech stack tags
- [x] Job & Internship board with filters (Remote, Hybrid, Onsite, Full-time, Internship)
- [x] Job application workflow with applicant tracking for job posters

### Safety
- [x] Reporting system for flagging inappropriate posts, comments, and profiles
- [x] Admin panel for platform metrics, user moderation (banning/unbanning), content deletion, and report review

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database & Auth**: Supabase (PostgreSQL, Supabase Auth, Supabase Storage, Supabase Realtime)
- **Deployment**: Vercel

---

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm, pnpm, or yarn
- A Supabase account and project

### Setup Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/techmon.git
   cd techmon
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Run SQL Migrations:**
   The database setup is consolidated into a single migration file located at [`supabase/migrations.sql`](supabase/migrations.sql).
   - Open your project dashboard in [Supabase](https://supabase.com/).
   - Navigate to the **SQL Editor**.
   - Copy the contents of [`supabase/migrations.sql`](supabase/migrations.sql) and run the script. This creates all 22 database tables, trigger functions, RLS security policies, storage buckets (`avatars`, `posts`, `stories`, `messages`, `projects`), and Realtime publications.

5. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | The HTTPS URL endpoint for your Supabase project instance. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The public anonymous API key for client-side requests governed by RLS policies. |

---

## Screenshots

![Home Feed](https://via.placeholder.com/1200x675.png?text=Home+Feed+Screenshot)
*Home Feed — Post timeline, stories bar, and trending topics*

![Profile Page](https://via.placeholder.com/1200x675.png?text=Profile+Page+Screenshot)
*Profile Page — Bio, portfolio projects showcase, highlights, and posts*

![Stories Camera & Editor](https://via.placeholder.com/1200x675.png?text=Stories+Screenshot)
*Stories Editor — Live camera capture, canvas overlays, and story creation*

![Direct Messages](https://via.placeholder.com/1200x675.png?text=Messages+Screenshot)
*Direct Messaging — Real-time conversations and media attachments*

---

## License

Distributed under the MIT License. See `LICENSE` for details.

---

## Built By

Developed by **[Your Name]**

- GitHub: [@yourusername](https://github.com/yourusername)
- LinkedIn: [in/yourusername](https://linkedin.com/in/yourusername)
- Portfolio: [yourportfolio.com](https://yourportfolio.com)
