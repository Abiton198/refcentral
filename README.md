

# **RefCentral** *EPRRS Referee & Coaching Management System* [https://refcentral.netlify.app](https://refcentral.netlify.app)


## Project Summary

**RefCentral** is a **real-time, role-based web platform** designed to streamline **match administration, player registration, referee assignments, and audit accountability** for Eastern Province Rugby Union Referees society in South Africa.

Built for **executives, referees, and coaches**, it replaces paper-based workflows with a **secure, mobile-friendly digital system**.

---

## Core Features

| Feature | Description |
| --- | --- |
| **Executive Dashboard** | Full control: appoint officials, view stats, mark reports as reviewed. |
| **Player Registration** | Referees can register players with **Unique Per-Team IDs** (e.g., KWA10001). |
| **Live Duplicate Check** | Real-time "as-you-type" detection to prevent dual registrations across clubs. |
| **Referee Reporting** | Submit match reports with real-time sync. |
| **Audit Trail** | Every player registration and report logged with Ref name + timestamp. |
| **Mobile-First UI** | Fully responsive on phones for on-field administration. |

---

## Firestore Data Model (Updated)

```ts
teams/
  └─ {teamId}
     ├── name: "Motherwell"
     ├── league: "Grand Challenge"
     └── homeGround: "NU 1 Stadium"

players/           → Player Database
  └─ {playerId}
     ├── firstName, lastName
     ├── dob: string | null (Optional)
     ├── position: "Fly-half (10)" | etc.
     ├── teamId: "031gAD..." 
     ├── teamName: "Motherwell"
     ├── displayId: "MOT10001" // Unique Per-Team ID
     ├── regNumber: 10001      // Incrementing integer
     ├── registeredBy: "John Doe" (Ref Name)
     ├── refereeUid: "auth_uid"
     └── registrationTime: "Jan 1, 2026, 4:58 PM"

appointments/      → Match assignments & Review flow
reports/           → Referee match reports

```

---

## Key Innovation: Unique Per-Team Registration

To maintain league integrity, the system uses a custom ID generation logic:

1. **Prefix:** Takes first 3 letters of Team Name (e.g., **KWA**ru).
2. **Incremental:** Queries Firestore for the highest `regNumber` within that specific `teamId`.
3. **Start Point:** Defaults to `10001` for new teams.
4. **Live Prevention:** As a referee types a player's name, the system queries the entire database. If a match is found, it displays a warning showing the player's current club and position, blocking the new registration.

---

## Updated Security Rules (Firestore)

Referees are permitted to register and read player data but are strictly prohibited from deleting records to maintain the audit trail.

```js
match /players/{playerId} {
  // Referees can check for duplicates and list players for matchcards
  allow read: if request.auth != null;
  
  // Referees can register players but cannot delete them
  allow create: if request.auth != null;
  
  // Only Executives can modify/delete player records
  allow update, delete: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'executive';
}

```

---

## Roadmap

| Status | Feature |
| --- | --- |
| Done | Report Review + Audit Trail |
| Done | **Unique Team-Based Player ID Generation** |
| Done | **Live Duplicate Registration Prevention** |
| In Progress | **Match Day Checklist (Selecting players from registered list)** |
| Planned | Export Team Lists to PDF |
| Planned | Player Transfer Request System |

---

## Contact

| Role | Name | Email |
| --- | --- | --- |
| Lead Developer | Dev Team | abitonp@gmail.com |
| Support | Help Desk | abitonpadera@gmail.com |

---

**RefCentral – Accountability. Transparency. Speed.**

*Built for South African sports. Powered by Firebase & React.* *Version: 2.2.0 | Updated: January 01, 2026*

---

