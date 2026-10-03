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
A ban where the affected user is unaware — they can still create events and interact normally, but their content is invisible to everyone else. Triggered automatically when a report threshold is reached. A moderator or admin can lift it. Applies to all current and future events of the banned user.
_Avoid_: Soft ban, mute, silent ban

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
