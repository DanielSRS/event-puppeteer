# Puppeteer

Server application that manages organizations, devices, events, and users. Acts as the central hub for an institutional event display system where kiosk devices show event information to passersby.

## Language

### Core Entities

**Organization**:
The multi-tenancy boundary. Groups users, devices, and events together. Each organization has its own branding (name, acronym, logo, color scheme), location, and public-facing URL.
_Avoid_: Tenant, company, institution

**Event**:
An institutional occasion (conference, workshop, lecture) created by a user within an organization. Displayed on kiosk devices in rotation weighted by votes and temporal relevance.
_Avoid_: Activity, session, post

**Device**:
A physical kiosk machine running the Puppet software. Belongs to an organization and displays that organization's events. Fully managed remotely via Puppeteer (telemetry, commands, updates).
_Avoid_: Terminal, screen, display, node

**Puppet**:
The C application running on a Device. Controls the device hardware, sends telemetry to Puppeteer, receives commands and event feeds. Separate codebase from Puppeteer.
_Avoid_: Agent, client, daemon

**User**:
A person registered within an organization. Can create events, vote, and report. Authenticated via email and password.
_Avoid_: Account, member (except when referring to the Member role)

### Roles

**Superadmin**:
System-wide role with full access to all organizations, devices, users, and configuration. Can do everything any other role can do.
_Avoid_: Root, system admin, global admin

**Admin**:
Organization-scoped role. Manages the organization's users, devices, and moderation. Inherits all Moderator and Member capabilities.
_Avoid_: Org owner, manager

**Moderator**:
Organization-scoped role. Reviews reports, manages shadow-banned users, promotes free-form tags to the known set. Inherits all Member capabilities.
_Avoid_: Reviewer, curator

**Member**:
Organization-scoped role. The default role. Can create events, vote/like, and report events.
_Avoid_: Regular user, basic user, participant

### Events & Content

**Day Entry**:
A single date within an Event's schedule. Date is required; start time and end time are optional. An Event has one or more Day Entries, allowing multi-day events with different times per day.
_Avoid_: Session, time slot, occurrence

**Tag**:
A system-wide label attached to events (e.g., "workshop", "lecture", "hackathon"). Managed by superadmins. A predefined set is displayed publicly; free-form tags added by users remain hidden until moderation promotes them to the known set.
_Avoid_: Category, type, topic

**Link Label**:
A system-wide predefined type for external links on events (e.g., "registration", "speaker profile", "social media"). Enables the UI to render appropriate buttons/icons per link type.
_Avoid_: Link type, URL category

**Vote**:
A like/upvote on an event by a user. Affects the event's display weight on kiosk devices — more votes means more display time in the rotation.
_Avoid_: Like, upvote, reaction

### Moderation

**Report**:
A complaint filed by a user against an event. Contains a predefined reason and optional free-text comment. One report per user per event. When the number of unique reporters reaches the organization's threshold, the event is hidden and its creator is shadow-banned.
_Avoid_: Flag, complaint, ticket

**Shadow Ban**:
A ban where the affected user is unaware — they can still create events and interact normally, but their content is invisible to everyone else. Triggered automatically when a report threshold is reached, or by a Confirmed Rejection of one of the user's Images. A moderator or admin can lift it. Applies to all current and future events of the banned user.
_Avoid_: Soft ban, mute, silent ban

**Image**:
A picture uploaded to Puppeteer and stored immutably — an Event's banner (always 16:9) or an Organization's logo (always 1:1). Users have no avatar. Images are never referenced by external URL. Every Image goes through Screening before anyone other than its uploader can see it. A User may upload at most 10 Images per day.
_Avoid_: Picture, media, asset, file

**Screening**:
The automatic analysis of an Image for inappropriate content (nudity, gore, violence, hate speech, extremist symbols, and similar). Ends in one of three verdicts: Approved, Rejected, or In Review. When Screening cannot conclude (service unavailable, quota exhausted), the Image goes to Image Review marked as not screened — it is never shown unscreened.
_Avoid_: Scan, check, filtering, moderation (moderation is the human side)

**Screening Policy**:
The system-wide, per-category score cut-offs that decide whether Screening ends Approved, In Review, or Rejected. Set by the Superadmin; the same for every Organization.
_Avoid_: Thresholds, sensitivity, filter settings

**Pending Image**:
An Image whose Screening has not concluded as Approved. Everyone except its uploader sees a Placeholder in its place; devices never receive it. The uploader sees it as published from the moment of upload, with no sign that it is being screened or reviewed. A Pending Image never replaces a previously Approved one until it is itself Approved.
_Avoid_: Unverified image, draft image

**Placeholder**:
The blurred preview of an Image, decoded from its thumbhash — a few dozen bytes that describe only colours and rough shapes. Shown in place of an Image that is not Approved, and while an Approved one loads. Available to everyone whatever the Image's state, since it carries too little detail to show content. An Event or Organization that never had an Image shows the default banner or logo instead.
_Avoid_: Fallback image, blank, thumbnail

**Rejected Image**:
An Image that Screening or Image Review decided must never be shown. Its uploader is never told: they keep seeing it as if it were published, while everyone else sees the Placeholder. A rejection by Screening alone does not affect the uploader in any other way.
_Avoid_: Blocked image, removed image, flagged image

**Confirmed Rejection**:
A rejection made by a human in Image Review. Unlike a rejection by Screening alone, it shadow-bans the uploader.
_Avoid_: Strike, violation

**Image Review**:
The human decision on an Image whose Screening ended In Review. Performed by the Organization's Moderators and Admins, or by a Superadmin — never by the Image's uploader. When no other eligible reviewer exists, the Image goes to the Superadmins; if none other than the uploader exists, it stays Pending. Previews are blurred until the reviewer chooses to reveal them. Every decision is recorded in the Audit Trail.
_Avoid_: Manual moderation, approval queue

**Audit Trail**:
A log of all moderation actions (hide/unhide event, lift shadow ban, etc.) recording who performed the action and when. Exists for accountability and review purposes.
_Avoid_: Changelog, history, activity log

### Device Management

**Enrollment**:
The process by which a new Device is registered into an organization. Uses auto-discovery: the Puppet connects to Puppeteer and appears in a pending queue. If it identifies an organization, the org Admin approves it; otherwise, the Superadmin assigns it to an organization. On approval, the device is given a name and location.
_Avoid_: Registration, pairing, provisioning

**Telemetry**:
Device health and status data sent from Puppet to Puppeteer. Includes continuous heartbeats/logs and on-demand detailed info (CPU, memory, disk, network, HDMI, screen state, OS details, process metrics, connection history, uptime, restarts, crashes).
_Avoid_: Metrics, diagnostics, monitoring data

**Command**:
An instruction sent from Puppeteer to a Puppet device (restart, shutdown, binary update, open SSH connection, etc.). Enables full remote device management.
_Avoid_: Action, instruction, directive
