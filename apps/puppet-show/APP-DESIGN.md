# Puppet Show: Web Client Design

This document defines the screen topology and UI architecture for `puppet-show`, the frontend web application that connects to the Puppeteer backend.

## 1. Public Area & Authentication (White-label)
*Routes are scoped to organizations via domain/subdomain/path (e.g., `fga.puppet-show.com`). The interface inherits the organization's primary color and logo.*

- **Login (`/login`)**: Org-scoped login form (Email/Password).
- **Register (`/register`)**: Open registration. Automatically assigns the user to the current organization.
- **Forgot Password (`/forgot-password`)**: Standard password reset flow.
- **Public Feed (`/` or `/events`)**: The main event discovery page.
  - Lists all active, non-hidden events.
  - Interactive event cards (Vote/Like, Report).
  - Categorical and temporal filters (e.g., "Mais próximos", "Mais curtidos", Tag selection).
- **Event Details (`/events/:id`)**: Detailed view showing the rich summary, multi-day schedule, location map, and labeled external links.
- **Report Modal**: Triggered from an event card to submit a report (reason + optional comment).

## 2. Web TV Mode
*A fallback web-based display mode for generic Smart TVs that cannot run the native C `puppet` client.*

- **TV Display (`/display`)**: 
  - Left panel: Auto-scrolling list of active events.
  - Right panel: QR Code for the web app, current clock, and instructional text.
  - Zero-touch interaction, automatically rotates through events weighted by relevance and time.

## 3. Unified Dashboard (`/dashboard`)
*A single, cohesive private area that progressively discloses features based on the user's role hierarchy (Member < Moderator < Admin < Superadmin).*

### 3.1. Member Section
- **My Events (`/dashboard/events`)**: Table/list of events created by the logged-in user. Allows soft-deletion and viewing status.
- **Event Creation Wizard (Drawer)**: A multi-step side drawer to create/edit events.
  - **Steps**: Basic Info, Multi-day Schedule, Media (Banner), Links & Tags.
  - **Banner**: picked from the device and cropped to 16:9 in the browser, uploaded once the event exists. The creator changes or removes it on the event page. Until the banner is Approved, everyone else sees its blurred Placeholder (thumbhash).
  - **Validation**: Strict Zod validation on each step; users cannot proceed without resolving inline errors.

### 3.2. Moderator Section
- **Report Queue (`/dashboard/reports`)**: Review events flagged by users. Actions: Hide or Unhide.
- **Image Review (`/dashboard/images`)**: Banners and logos Screening had doubts about (or could not analyse). Pictures stay blurred until revealed; the suspected categories show first. Actions: Approve, or Reject (shadow-bans the uploader). Nobody sees their own Images here.
- **Shadow Bans (`/dashboard/bans`)**: List of shadow-banned users (triggered automatically by report threshold). Action: Lift ban.
- **Tags Management (`/dashboard/tags`)**: Review free-form tags submitted by users and promote them to the predefined public set.
- **Audit Trail (`/dashboard/audit`)**: Immutable log of all moderation actions (actor, timestamp, action type).

### 3.3. Admin Section (Org-scoped)
- **Users (`/dashboard/users`)**: Directory of organization users. Actions: Change roles, remove user.
- **Devices (`/dashboard/devices`)**:
  - View pending devices (awaiting approval) and enrolled devices.
  - Assign names and locations to pending devices.
- **Device Telemetry & Commands (`/dashboard/devices/:id`)**:
  - Dedicated rich visualization page for a specific device.
  - Features time-series charts (CPU, memory, temperature, network).
  - Remote command controls (restart, shutdown, update, SSH).
- **Org Settings (`/dashboard/settings`)**: Configure organization-specific parameters, such as the Shadow Ban report threshold.

## 4. Superadmin Global Area
*Accessed via the "Context Switcher" dropdown at the top of the Unified Dashboard. Allows system-wide management and impersonation of any organization's Admin dashboard.*

- **Context Switcher**: Dropdown to toggle between "Global System" and specific organizations.
- **Organizations (`/dashboard/global/orgs`)**: Create and configure tenants (name, acronym, primary color, domain/URL). The logo is uploaded (cropped square) in the organization's settings.
- **Escalated Images (`/dashboard/global/images`)**: Image Review for Images only Superadmins can decide (sent by Superadmins, or from organizations without another reviewer).
- **Screening Policy (`/dashboard/global/screening`)**: Per-category cut-offs, in percent, that decide whether Screening approves an Image, sends it to Image Review or rejects it.
- **Orphan Devices (`/dashboard/global/devices`)**: Queue of new kiosks that connected without an Organization ID. Action: Assign to a specific organization.
- **Global Tags (`/dashboard/global/tags`)**: Manage the master set of system-wide predefined tags.
- **Global Links (`/dashboard/global/links`)**: Manage the predefined labels for external event links (e.g., "Registration", "Social Media").
