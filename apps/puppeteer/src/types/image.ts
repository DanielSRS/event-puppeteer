import { t, type Static } from 'elysia';

/** What an Image depicts: an Event's banner (always 16:9) or an Organization's logo (always 1:1). */
export const ImageKindSchema = t.Union([t.Literal('event_banner'), t.Literal('organization_logo')]);
export type ImageKind = Static<typeof ImageKindSchema>;

/** The kinds of inappropriate content Screening looks for. */
export const SCREENING_CATEGORIES = [
  'nudity',
  'gore',
  'violence',
  'weapons',
  'hate',
  'offensive_gesture',
  'offensive_text'
] as const;
export type ScreeningCategory = typeof SCREENING_CATEGORIES[number];

/**
 * Per-category scores from 0 to 1. A category no engine covers is absent, never zero:
 * an absent score is "not measured", not "clean".
 */
export const ScreeningScoresSchema = t.Partial(t.Object(
  Object.fromEntries(SCREENING_CATEGORIES.map(c => [c, t.Number({ minimum: 0, maximum: 1 })])) as Record<ScreeningCategory, ReturnType<typeof t.Number>>
));
export type ScreeningScores = Partial<Record<ScreeningCategory, number>>;

/** The cut-offs of one category: below `lower` is Approved, from `upper` on is Rejected, in between is In Review. */
export const CategoryCutOffsSchema = t.Object({
  lower: t.Number({ minimum: 0, maximum: 1 }),
  upper: t.Number({ minimum: 0, maximum: 1 })
});
export type CategoryCutOffs = Static<typeof CategoryCutOffsSchema>;

/** The Screening Policy: cut-offs for every Screening category. System-wide, set by the Superadmin. */
export const ScreeningPolicySchema = t.Object(
  Object.fromEntries(SCREENING_CATEGORIES.map(c => [c, CategoryCutOffsSchema])) as Record<ScreeningCategory, typeof CategoryCutOffsSchema>
);
export type ScreeningPolicy = Record<ScreeningCategory, CategoryCutOffs>;

/** Where an Image stands. An Image that is not Approved is a Pending Image. */
export type ImageState = 'approved' | 'in_review' | 'rejected';

/** An Image as Puppeteer stores it. The bytes live in the ImageStore under the Image's id. */
export interface Image {
  id: string;
  kind: ImageKind;
  /** The Event (banner) or Organization (logo) the Image belongs to. */
  ownerId: string;
  /** The Organization whose Moderators and Admins review the Image. */
  organizationId: string;
  uploaderId: string;
  uploadedAt: string;
  thumbhash: string;
  width: number;
  height: number;
  state: ImageState;
  /**
   * True when Screening could not conclude (an engine failed, or no Screening Policy was set)
   * and the Image went to Image Review unscreened. Any scores obtained are kept.
   */
  notScreened: boolean;
  /** The Screening scores; empty when an engine failed. */
  scores: ScreeningScores;
  /** Who decided the Image in Image Review, and when. Absent for Screening's own verdicts. */
  decidedBy?: string;
  decidedAt?: string;
  /** Set when the owner's Image was removed: a detached Image is never shown again. */
  detachedAt?: string;
}

/**
 * An Image as one viewer sees it. `thumbhash` decodes to the Placeholder and is always
 * present; `url` is absent when the viewer may only see the Placeholder.
 */
export const ImageViewSchema = t.Object({
  url: t.Optional(t.String()),
  thumbhash: t.String()
});
export type ImageView = Static<typeof ImageViewSchema>;

/** An Image awaiting Image Review, with what a reviewer needs to judge it in context. */
export const ImageReviewItemSchema = t.Object({
  id: t.String(),
  kind: ImageKindSchema,
  ownerId: t.String(),
  /** The Event's title or the Organization's name. */
  ownerName: t.String(),
  organizationId: t.String(),
  uploaderId: t.String(),
  uploaderName: t.String(),
  uploadedAt: t.String({ format: 'date-time' }),
  notScreened: t.Boolean(),
  scores: ScreeningScoresSchema,
  /** A short-lived URL of the restricted Image, for the reviewer to reveal. */
  previewUrl: t.String(),
  thumbhash: t.String()
});
export type ImageReviewItem = Static<typeof ImageReviewItemSchema>;

/** A file received in a multipart upload. */
export const ImageUploadBody = t.Object({ file: t.File() });
