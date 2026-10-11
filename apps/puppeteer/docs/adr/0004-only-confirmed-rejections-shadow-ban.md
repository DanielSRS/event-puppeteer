# Only a Confirmed Rejection shadow-bans the uploader

When Screening alone rejects an Image, the Image is hidden silently and nothing else happens to its uploader. The uploader is shadow-banned only by a Confirmed Rejection, meaning a Moderator, Admin, or Superadmin rejected the Image in Image Review. This adds a second trigger to the Shadow Ban from ADR 0001, but keeps that ADR's reasoning: a ban rests on human judgement, not on a single classifier score.

We chose this because legitimate events on a campus routinely score high on moderation models. Examples include a history lecture with archive photos containing Nazi symbols, a blood-donation campaign, an anatomy class, an art exhibition, and a protest sign that quotes a slur in order to condemn it. If every automatic rejection banned the uploader, the system would silently erase all of their content because of a false positive, and nothing would ever tell them.

## Considered Options

- **Every rejection shadow-bans**: strongest deterrent, but it turns classifier false positives into invisible bans.
- **Automatic rejection counts as a Report toward the organization's threshold**: softer, but it mixes machine signals with the human Reports that ADR 0001's threshold assumes.
- **Only Confirmed Rejections shadow-ban (chosen)**: the Image itself is always protected by Screening, and punishing the person needs a human.

## Consequences

- Rejection is always silent. Uploaders see every Image of theirs as published, whatever its state, which is the same viewer-dependent visibility the Shadow Ban already uses.
- No reviewer may judge their own Image. Otherwise an uploader could confirm or dismiss the rejection of their own content.
- A Confirmed Rejection of an Organization's logo shadow-bans the Admin who uploaded it, but does not affect the Organization. The logo stays at its last Approved version, or at the Placeholder.
