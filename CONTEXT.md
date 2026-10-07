# Event Puppeteer

Puppeteer serves as the central hub managing organizations, devices, events, and users for institutional kiosk displays.

## Language

**Puppeteer**:
The server application (API) that manages the core domain logic, devices, and events.
_Avoid_: Backend, API server

**Puppet**:
The C application running on physical kiosk devices that connects to Puppeteer to display events.
_Avoid_: Device app, Kiosk software

**puppet-show**:
The frontend web application where users browse events and administrators manage the system.
_Avoid_: Web UI, Frontend

**Unified Dashboard**:
The private application area (`/dashboard`) that progressively discloses management tools based on the user's role (Member, Moderator, Admin, Superadmin).
_Avoid_: Member panel, Admin panel, Backoffice

**Context Switcher**:
The dropdown in the Unified Dashboard that allows Superadmins to switch between managing the global system and acting as an Admin within a specific organization.
_Avoid_: Organization selector, tenant picker

**Public Feed**:
The main discovery area in puppet-show displaying all non-hidden events for an organization.
_Avoid_: Event list, Homepage

**Shadow Ban**:
A moderation state where a user's content is invisible to others but remains visible to the creator.
_Avoid_: Ghost ban, Silent ban
