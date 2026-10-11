# Image Screening via free external moderation APIs

Every Image (Event banner or Organization logo) is screened by calling external moderation APIs instead of running moderation models ourselves. Sightengine is the primary engine; OpenAI `omni-moderation` gives a second opinion on the categories it supports. The most severe verdict of the two wins. The scores are compared against the Screening Policy to reach Approved, In Review, or Rejected.

We chose this because:

1. **Hosting**: Puppeteer runs on Vercel functions. They have no GPU, a limited bundle size, and short execution times. Models like NudeNet, CLIP/OpenCLIP, and PaddleOCR do not fit there.
2. **Cost**: this is a small project, and every dependency must be free. Both APIs have free tiers. A dedicated server for self-hosted models would not be free.
3. **Coverage**: Sightengine covers nudity, gore and blood, weapons, hate and extremist symbols (it tells Nazi symbols apart from religious ones), offensive gestures, and text in images. That is close to the whole list of content we must block. With a self-hosted setup we would have to assemble that coverage from several models, and zero-shot CLIP is unreliable for gore and for small symbols.

## Considered Options

- **Self-hosted model stack (NudeNet + CLIP + OCR + text classifier)**: no third party sees the Images, but it cannot run on Vercel and needs paid compute. Text classifiers are also weak in Portuguese, and they miss meaning that comes from the text and the picture together.
- **Single vision-language model on a free tier (e.g., Gemini)**: very flexible, driven by a policy prompt. Rejected because free-tier inputs are used to improve the provider's products.
- **OpenAI `omni-moderation` alone**: free with no quota, but in images it does not detect hate or extremist symbols.
- **Sightengine + OpenAI second opinion (chosen)**: wide coverage, free, no models to host.

## Consequences

- Every uploaded Image is sent to two third parties. This includes Images that are later rejected.
- The Sightengine free tier has a daily and a monthly operation quota. To protect it, a User may upload at most 10 Images per day.
- When Screening cannot conclude (service unavailable, quota exhausted), the Image goes to Image Review marked as not screened. It is never shown unscreened, and it never falls back to Approved.
- The categories and score scales of both providers have to be mapped onto the Screening Policy's categories. If either provider changes its taxonomy, that mapping must be revisited.
