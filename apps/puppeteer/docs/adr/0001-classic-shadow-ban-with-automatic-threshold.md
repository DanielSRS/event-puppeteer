# Classic shadow ban with automatic threshold trigger

Users who receive enough reports are shadow-banned automatically — they can still create events and interact normally, but their content becomes invisible to everyone else. The threshold is configurable per organization (default: 5 unique reporters).

We chose this over explicit moderator-initiated bans because:

1. **Scale**: moderation doesn't need to be online 24/7 for the system to self-protect. Problematic content gets hidden before a moderator even sees it.
2. **Shadow over explicit**: an explicitly banned user knows they're banned and can create a new account or escalate. A shadow-banned user has no signal that anything changed, reducing adversarial behavior.
3. **Reversibility**: moderators can review and lift any shadow ban, so false positives are recoverable.

## Considered Options

- **Moderator-only bans**: safer against false positives, but requires active moderation to prevent harmful content from staying visible. Doesn't scale for organizations without dedicated moderators.
- **Automatic explicit ban**: same scale benefit, but the user knows they're banned and can react (new accounts, complaints). Introduces friction.
- **Automatic shadow ban (chosen)**: scales without moderators, minimizes adversarial response, and moderators can still intervene to lift false positives.

## Consequences

- The shadow ban threshold must be tuned carefully per organization size — too low causes false positives, too high defeats the purpose.
- Moderators need a clear UI to review shadow-banned users and their reported events, since the system acts before they do.
- The creator's view of their own events must always show them as visible, even when shadow-banned. This adds a "viewer-dependent visibility" layer to event queries.
