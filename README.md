# **RefCentral**  
*ZA Referee & Coaching Management System*  
[https://refcentral.netlify.app](https://refcentral.netlify.app)  

---

## Project Summary

**RefCentral** is a **real-time, role-based web platform** designed to streamline **match administration, referee assignments, performance reporting, and audit accountability** for sports organizations in South Africa.

Built for **executives, referees, and coaches**, it replaces paper-based workflows with a **secure, mobile-friendly digital system** that ensures:
- Transparent appointments
- Timely match reports
- Full audit trails
- Real-time updates

> **Live Demo:** [https://refcentral.netlify.app](https://refcentral.netlify.app)  
> **Status:** Production-Ready | Actively Maintained

---

## Core Features

| Feature | Description |
|-------|-----------|
| **Executive Dashboard** | Full control: appoint officials, view stats, mark reports as reviewed |
| **Referee Reporting** | Submit match reports with real-time sync |
| **Coaching Reports** | Unified form to assess referee performance |
| **Audit Trail** | Every action logged with user + timestamp |
| **Real-Time Sync** | Firebase-powered live updates across devices |
| **Mobile-First UI** | Fully responsive on phones, tablets, desktops |
| **Role-Based Access** | Executive, Referee, Coach (via Firebase Auth) |

---

## Tech Stack

```text
Frontend:     React 18 + TypeScript + Vite
UI:           Tailwind CSS + ShadCN UI
Backend:      Firebase Firestore (NoSQL)
Auth:         Firebase Authentication
Hosting:      Netlify (CI/CD from GitHub)
Icons:        Lucide React
Date:         date-fns
```

---

## Firestore Data Model

```ts
appointments/
  └─ {matchId}
     ├── homeTeam, awayTeam
     ├── date, time, venue
     ├── referee, ar, coachName
     ├── status: "pending"|"accepted"|"rejected"
     ├── reportSubmitted: boolean
     ├── reportReviewed: boolean
     ├── reportReviewedBy: "John Doe"
     └── auditTrail: [{ action, by, at }]

reports/           → Referee match reports
coachReports/      → Coaching feedback
results/           → Final scores
```

---

## Key Innovation: Report Review Flow

```mermaid
graph LR
  A[Referee Submits Report] --> B[Firestore: reports]
  B --> C[Auto-update appointment]
  C --> D[Show "Report" Badge]
  D --> E[Executive Clicks "Mark Reviewed"]
  E --> F[Update: reportReviewed = true]
  F --> G[Audit: "Reviewed by John"]
  G --> H[Badge: "Reviewed by John"]
```

> **No `serverTimestamp()` in `arrayUnion()`** – fixed with ISO string

---

## How to Use (Demo)

| Role | Email | Password |
|------|-------|----------|
| **Executive** | `exec@zaref.co.za` | `password123` |
| **Referee**   | `ref1@zaref.co.za` | `ref123` |
| **Coach**     | `coach@zaref.co.za` | `coach123` |

### Try This:
1. Login as **Executive**
2. Appoint a referee
3. Switch to **Referee** → submit report
4. Back to **Executive** → click *"Mark Reviewed"*
5. See **audit trail** and **reviewer name**

---

## Project Structure

```
src/
├── pages/
│   └── executive/ExecutiveDashboard.tsx
├── components/
│   ├── ui/ (ShadCN)
│   └── executive/CoachAppointmentForm.tsx
├── lib/firebase.ts
├── data/mockData.ts
└── App.tsx
```

---

## Setup & Local Development

```bash
# 1. Clone
git clone https://github.com/yourorg/refcentral.git
cd refcentral

# 2. Install
npm install

# 3. Add Firebase Config
cp .env.example .env
# → Fill in your Firebase project keys

# 4. Run
npm run dev
```

> Open [http://localhost:5173](http://localhost:5173)

---

## Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create project → Enable **Auth** + **Firestore**
3. Add web app → copy config
4. Paste into `.env`

```env
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxx
```

---

## Security Rules (Firestore)

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=쁩} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## Deployment

### Netlify (Live)
- Connected to GitHub
- Auto-deploy on `main`
- URL: [https://refcentral.netlify.app](https://refcentral.netlify.app)

```bash
npm run build
```

---

## How to Get Involved

We welcome **contributors**, **testers**, and **sports admins**!

### Ways to Contribute

| Role | How |
|------|-----|
| **Developer** | Fix bugs, add PDF export, dark mode |
| **Tester** | Report UX issues, test on mobile |
| **Sports Admin** | Suggest features (ratings, payments, etc.) |

### Steps:
1. **Fork** the repo
2. Create branch: `git checkout -b feature/pdf-viewer`
3. Commit & push
4. Open **Pull Request**

---

## Roadmap

| Status | Feature |
|--------|--------|
| Done | Report Review + Audit Trail |
| Done | Mobile Responsive |
| In Progress | View Report PDF |
| Planned | Export Reviewed List (CSV) |
| Planned | Email Notifications |
| Planned | Referee Performance Dashboard |

---

## License

```
MIT License
```

Free to use, modify, and distribute.

---

## Contact

| Role | Name | Email |
|------|------|-------|
| Lead Developer | Dev Team | abitonp@gmail.com |
| Support | Help Desk | abitonpadera@gmail.com |

---

## Live Demo

[https://refcentral.netlify.app](https://refcentral.netlify.app)

---

**RefCentral – Accountability. Transparency. Speed.**

*Built for South African sports. Powered by Firebase & React.*  
*Version: 2.1.0 | Updated: November 09, 2025*