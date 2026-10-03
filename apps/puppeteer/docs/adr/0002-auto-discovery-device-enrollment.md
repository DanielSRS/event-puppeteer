# Auto-discovery with approval for device enrollment

Devices running Puppet connect to Puppeteer on their own and appear in a pending queue. An admin reviews the pending device and approves it, assigning a name and location. Two paths exist depending on whether the device identifies an organization upfront:

- **Without org identification**: the device appears in the Superadmin's pending list. The Superadmin assigns it to an organization, gives it a name and location.
- **With org identification**: the device appears in that organization's Admin pending list. The org Admin approves it, gives it a name and location.

We chose this over pairing codes, pre-configuration, or fully automatic registration because:

1. **Zero-touch device setup**: the device just needs network access and the Puppeteer server address — no tokens, QR codes, or manual configuration at the device itself. This matters when deploying dozens of kiosk devices across buildings.
2. **Admin control**: the approval step prevents rogue or misconfigured devices from joining an organization's event feed. Every device is explicitly accepted.
3. **Flexibility**: devices that know their target org go through the org admin (faster, decentralized). Devices that don't are caught by the superadmin as a fallback.

## Considered Options

- **Admin generates a pairing code/token**: secure, but requires someone to physically enter the code on each device or pre-flash it. Doesn't scale well for bulk deployments.
- **Device generates a code on screen, admin enters in Puppeteer**: requires the device to have a UI for the pairing flow, adding complexity to the Puppet software.
- **Pre-configured with org token**: requires a provisioning step before deployment. Ties device identity to a specific org before it's even physically placed.
- **Auto-discovery with approval (chosen)**: simplest device-side setup, admin retains control, supports both org-aware and org-unaware devices.

## Consequences

- Puppeteer must handle unknown/unapproved device connections gracefully — they exist in a pending state with limited access (no event feed, no commands until approved).
- The Superadmin and org Admin UIs need a "pending devices" queue with the ability to assign org, name, and location.
- Puppet must tolerate being in a "not yet approved" state — it should keep retrying or maintain a persistent connection waiting for approval, without crashing or flooding the server.
