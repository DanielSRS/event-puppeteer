import { Elysia, t, type ElysiaAdapter } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import type { AppIO } from './io/index.ts';
import { healthCheck } from './handlers/health.ts';
import {
  createOrganizationHandler,
  getOrganizationHandler,
  listOrganizationsHandler,
  updateOrganizationHandler
} from './handlers/organization.ts';
import {
  CreateOrganizationBody,
  UpdateOrganizationBody,
  OrganizationSchema,
  OrganizationViewSchema
} from './types/organization.ts';
import { ImageViewSchema, ImageReviewItemSchema, ImageUploadBody, ScreeningPolicySchema } from './types/image.ts';
import {
  uploadEventBannerHandler,
  removeEventBannerHandler,
  uploadOrganizationLogoHandler,
  removeOrganizationLogoHandler,
  listImageReviewsHandler,
  listEscalatedImageReviewsHandler,
  approveImageHandler,
  rejectImageHandler,
  getScreeningPolicyHandler,
  setScreeningPolicyHandler
} from './handlers/images.ts';
import { UserSchema, RegisterBody, LoginBody, ChangeRoleBody, ResendVerificationBody, RequestPasswordResetBody, ResetPasswordBody } from './types/user.ts';
import { registerHandler, loginHandler, meHandler, verifyEmailHandler, resendVerificationHandler, requestPasswordResetHandler, resetPasswordHandler } from './handlers/auth.ts';
import { listOrgUsersHandler, assignRoleHandler, removeUserHandler } from './handlers/users.ts';
import { TagSchema, CreateTagBody, LinkLabelSchema, CreateLinkLabelBody } from './types/tag.ts';
import { EventSchema, EventViewSchema, CreateEventBody, FeedEventSchema, EventWithVotesSchema } from './types/event.ts';
import { connectDeviceHandler, getCurrentDeviceHandler, listPendingDevicesGlobalHandler, listPendingDevicesOrgHandler, listActiveDevicesOrgHandler, getDeviceHandler, approveDeviceHandler, rejectDeviceHandler } from './handlers/devices.ts';
import { PublicDeviceSchema, ConnectDeviceBody, ApproveDeviceBody } from './types/device.ts';
import { heartbeatHandler, postLogHandler, postTelemetryHandler, pullPendingCommandsHandler, ackCommandHandler, completeCommandHandler, getDeviceStatusHandler, getDeviceLogsHandler, getDetailedTelemetryHandler, sendCommandHandler, requestTelemetryHandler, listCommandsHandler, requestUpdateUploadHandler, downloadUpdateBinaryHandler } from './handlers/telemetry.ts';
import { PostLogBody, DeviceTelemetrySchema, DeviceLogSchema, HeartbeatSchema } from './types/telemetry.ts';
import { CreateCommandBody, CommandSchema, IssuedCommandSchema, RequestUpdateUploadBody, UpdateUploadGrantSchema } from './types/command.ts';
import { createTagHandler, listTagsHandler, createLinkLabelHandler, listLinkLabelsHandler } from './handlers/system.ts';
import { createEventHandler, listEventsHandler, listMyEventsHandler, getEventHandler, deleteEventHandler } from './handlers/events.ts';
import { voteHandler, getVoteStatusHandler } from './handlers/votes.ts';
import { eventFeedHandler } from './handlers/feed.ts';
import { ReportSchema, CreateReportBody, AuditEntrySchema } from './types/moderation.ts';
import { reportEventHandler, getReportStatusHandler, listReportsHandler, hideEventHandler, unhideEventHandler, listShadowBansHandler, liftShadowBanHandler, promoteTagHandler, listAuditTrailHandler } from './handlers/moderation.ts';

// Security requirements referenced by route docs (schemes declared in the openapi plugin below)
const asUser = [{ userToken: [] }];
const asDevice = [{ deviceToken: [] }];

const docs = openapi({
  documentation: {
    info: {
      title: 'Puppeteer API',
      version: '0.0.1',
      description: 'Central hub for the institutional event display system: organizations, users, events, moderation, and remote management of kiosk Devices running Puppet.'
    },
    tags: [
      { name: 'Health', description: 'Liveness probe' },
      { name: 'Auth', description: 'User registration, login, and session' },
      { name: 'Organizations', description: 'Organization CRUD and public event feed' },
      { name: 'Users', description: 'Organization users and role assignment' },
      { name: 'Events', description: 'Event creation, listing, and soft-delete' },
      { name: 'Votes', description: 'Votes that weight an event in the kiosk rotation' },
      { name: 'Moderation', description: 'Reports, hidden events, shadow bans, tag promotion, and the audit trail' },
      { name: 'Tags', description: 'System-wide Tags and Link Labels' },
      { name: 'Images', description: 'Event banners and Organization logos: upload, Screening Policy, and Image Review' },
      { name: 'Device', description: 'Endpoints called by Puppet from the Device itself (device token)' },
      { name: 'Device Management', description: 'Enrollment, telemetry, and Commands, operated by Admins and Superadmins' }
    ],
    components: {
      securitySchemes: {
        userToken: {
          type: 'http',
          scheme: 'bearer',
          description: 'Session token returned by POST /auth/register or POST /auth/login'
        },
        deviceToken: {
          type: 'http',
          scheme: 'bearer',
          description: 'Device token returned by POST /devices/connect'
        }
      }
    }
  }
});

/**
 * Image upload, Image Review and Screening Policy errors. Several share a status, so the
 * answer also carries the error code for clients to tell them apart.
 */
const IMAGE_ERRORS: Partial<Record<string, { status: number; error: string }>> = {
  IMAGE_TOO_LARGE: { status: 413, error: 'Image file too large' },
  IMAGE_UNSUPPORTED_FORMAT: { status: 415, error: 'Image must be a still JPEG, PNG or WebP' },
  IMAGE_UNREADABLE: { status: 400, error: 'File is not a readable image' },
  IMAGE_WRONG_PROPORTION: { status: 400, error: 'Image is not in the required proportion' },
  IMAGE_TOO_SMALL: { status: 400, error: 'Image is smaller than the minimum size' },
  IMAGE_DAILY_LIMIT: { status: 429, error: 'Daily image upload limit reached' },
  IMAGE_STORAGE_FAILED: { status: 502, error: 'Image could not be stored; try again' },
  IMAGE_ALREADY_DECIDED: { status: 409, error: 'Image was already decided' },
  IMAGE_NO_LONGER_CURRENT: { status: 409, error: 'Image was replaced or removed by its uploader' },
  SCREENING_POLICY_INVALID: { status: 400, error: 'Every cut-off must be within 0–1, the lower one not above the upper one' }
};

// Wire the imperative shell: the HTTP layer assembles real IO and passes it to handlers
interface ServerOptions {
  // Defaults to Web Standard (what Vercel runs); local Node passes node()
  adapter?: ElysiaAdapter;
  // Public URL of the frontend, where the email verification link redirects to
  appUrl?: string;
}

export function createServer(io: AppIO, { adapter, appUrl = 'http://localhost:3000' }: ServerOptions = {}) {
  return new Elysia(adapter ? { adapter } : {})
    .use(docs)
    // Not .decorate(): Elysia deep-merges decorators into every group, and walking the
    // Drizzle/better-auth instances inside io never terminates (heap OOM at startup)
    .derive({ as: 'global' }, () => ({ io }))
    .onError(({ error, set }) => {
      if (!(error instanceof Error)) return;
      const message = error.message;
      if (message === 'UNAUTHORIZED') {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      if (message === 'FORBIDDEN') {
        set.status = 403;
        return { error: 'Forbidden' };
      }
      if (message === 'NOT_FOUND' || message === 'USER_NOT_FOUND') {
        set.status = 404;
        return { error: 'Not Found' };
      }
      if (message === 'INVALID_CREDENTIALS') {
        set.status = 401;
        return { error: 'Invalid email or password' };
      }
      if (message === 'EMAIL_NOT_VERIFIED') {
        set.status = 403;
        return { error: 'Email not verified' };
      }
      if (message.startsWith('SIGNUP_FAILED')) {
        set.status = 400;
        return { error: 'Sign-up failed' };
      }
      if (message.startsWith('UPDATE_STORE_FAILED')) {
        set.status = 502;
        return { error: 'The update binary store could not issue an upload; try again' };
      }
      if (message.startsWith('EMAIL_DELIVERY_FAILED')) {
        set.status = 502;
        return { error: 'Verification email could not be sent; request a new one' };
      }
      if (message === 'ORGANIZATION_NOT_FOUND') {
        set.status = 400;
        return { error: 'Organization not found' };
      }
      if (message === 'EMAIL_EXISTS') {
        set.status = 400;
        return { error: 'Email already exists' };
      }
      if (message === 'BAD_REQUEST') {
        set.status = 400;
        return { error: 'Bad Request' };
      }
      if (message === 'INVALID_RESET_TOKEN') {
        set.status = 400;
        return { error: 'Invalid or expired reset link' };
      }
      if (message === 'ORGANIZATION_SLUG_EXISTS') {
        set.status = 409;
        return { error: 'Organization slug already exists' };
      }
      if (message === 'TAG_EXISTS') {
        set.status = 409;
        return { error: 'Tag already exists' };
      }
      if (message === 'LINK_LABEL_EXISTS') {
        set.status = 409;
        return { error: 'Link label already exists' };
      }
      const imageError = IMAGE_ERRORS[message];
      if (imageError) {
        set.status = imageError.status;
        return { error: imageError.error, code: message };
      }
      if (message.startsWith('IMAGE_OWNER_MISSING')) {
        console.error(`❌ ${message}`);
        set.status = 500;
        return { error: 'An Image belongs to an Event or Organization that no longer exists', code: 'IMAGE_OWNER_MISSING' };
      }
    })
    .get(
      '/health',
      ({ request, io }) => healthCheck(request, io),
      {
        response: t.Object({
          status: t.Literal('ok')
        }),
        detail: { tags: ['Health'], summary: 'Health check' }
      }
    )

    .group('/devices', (app) =>
      app
        .post('/connect', async ({ body, io }) => {
          return await connectDeviceHandler(body, io);
        }, {
          body: ConnectDeviceBody,
          response: t.Object({ device: PublicDeviceSchema, token: t.String() }),
          detail: {
            tags: ['Device'],
            summary: 'Connect a Device',
            description: 'Enters the pending enrollment queue and returns the device token. Reconnecting with the identifier of a still-pending Device reuses that entry and rotates its token.'
          }
        })
        .get('/me', async ({ request, io }) => {
          return await getCurrentDeviceHandler(request, io);
        }, {
          response: PublicDeviceSchema,
          detail: {
            tags: ['Device'],
            summary: 'Get the calling Device',
            description: 'Answers for pending and rejected Devices too, so Puppet can wait for approval or stop retrying.',
            security: asDevice
          }
        })
        .get('/pending', async ({ request, io }) => {
          return await listPendingDevicesGlobalHandler(request, io);
        }, {
          response: t.Array(PublicDeviceSchema),
          detail: {
            tags: ['Device Management'],
            summary: 'List pending Devices without an Organization',
            description: 'Superadmin only.',
            security: asUser
          }
        })
        .post('/:deviceId/approve', async ({ request, params: { deviceId }, body, io }) => {
          return await approveDeviceHandler(request, deviceId, body, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          body: ApproveDeviceBody,
          response: PublicDeviceSchema,
          detail: {
            tags: ['Device Management'],
            summary: 'Approve a pending Device',
            description: 'Assigns name, location, and Organization. Superadmin may pick any Organization; an Admin only their own.',
            security: asUser
          }
        })
        .post('/:deviceId/reject', async ({ request, params: { deviceId }, io }) => {
          return await rejectDeviceHandler(request, deviceId, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          response: PublicDeviceSchema,
          detail: { tags: ['Device Management'], summary: 'Reject a pending Device', security: asUser }
        })

        .post('/:deviceId/heartbeat', async ({ request, params: { deviceId }, body, io }) => {
          return await heartbeatHandler(request, deviceId, body.status, body.errors, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          body: t.Object({ status: t.String(), errors: t.Optional(t.Array(t.String())) }),
          response: t.Object({
            success: t.Boolean(),
            commandsWaiting: t.Boolean({
              description: 'True while the Device has at least one Command in `pending` or `sent`, and stays true until the Command is acknowledged (at-least-once delivery). The Puppet fetches its pending Commands when this is true.'
            })
          }),
          detail: {
            tags: ['Device'],
            summary: 'Send a heartbeat',
            description: 'Records the heartbeat. The answer reports whether any Command of the calling Device is waiting (`commandsWaiting`).',
            security: asDevice
          }
        })
        .post('/:deviceId/logs', async ({ request, params: { deviceId }, body, io }) => {
          return await postLogHandler(request, deviceId, body, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          body: PostLogBody,
          response: t.Object({ success: t.Boolean() }),
          detail: { tags: ['Device'], summary: 'Send a log entry', security: asDevice }
        })
        .post('/:deviceId/telemetry', async ({ request, params: { deviceId }, body, io }) => {
          return await postTelemetryHandler(request, deviceId, body, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          body: DeviceTelemetrySchema,
          response: t.Object({ success: t.Boolean() }),
          detail: {
            tags: ['Device'],
            summary: 'Send detailed Telemetry',
            description: 'Also completes any outstanding request_telemetry Command.',
            security: asDevice
          }
        })
        .get('/:deviceId/commands/pending', async ({ request, params: { deviceId }, io }) => {
          return await pullPendingCommandsHandler(request, deviceId, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          response: t.Array(CommandSchema),
          detail: {
            tags: ['Device'],
            summary: 'Pull pending Commands',
            description: 'Returns Commands not yet acknowledged, oldest first, marking pending ones as sent. A Command is redelivered on every poll until the Device acknowledges it (at-least-once). Returns an empty list while the Device is not active.',
            security: asDevice
          }
        })
        .get('/:deviceId/commands/:commandId/binary', async ({ request, params: { deviceId, commandId }, io, redirect }) => {
          return redirect(await downloadUpdateBinaryHandler(request, deviceId, commandId, io));
        }, {
          params: t.Object({ deviceId: t.String(), commandId: t.String() }),
          detail: {
            tags: ['Device'],
            summary: 'Download the binary of an uploaded update',
            description: 'Answers 302 to a URL signed for a few minutes. Only the Device the update Command was sent to, while the Command is sent or acknowledged. Puppet reaches this through the short `url` it receives in the Command.',
            security: asDevice
          }
        })
        .post('/:deviceId/commands/:commandId/ack', async ({ request, params: { deviceId, commandId }, io }) => {
          return await ackCommandHandler(request, deviceId, commandId, io);
        }, {
          params: t.Object({ deviceId: t.String(), commandId: t.String() }),
          response: CommandSchema,
          detail: { tags: ['Device'], summary: 'Acknowledge a Command', security: asDevice }
        })
        .post('/:deviceId/commands/:commandId/complete', async ({ request, params: { deviceId, commandId }, body, io }) => {
          return await completeCommandHandler(request, deviceId, commandId, body.success, io);
        }, {
          params: t.Object({ deviceId: t.String(), commandId: t.String() }),
          body: t.Object({ success: t.Boolean() }),
          response: CommandSchema,
          detail: { tags: ['Device'], summary: 'Report a Command as completed or failed', security: asDevice }
        })
    )
    .group('/tags', (app) =>
      app
        .post('/', async ({ request, body, io }) => createTagHandler(request, body, io), {
          body: CreateTagBody,
          response: TagSchema,
          detail: {
            tags: ['Tags'],
            summary: 'Create a Tag',
            description: 'Any logged-in User may create a free-form Tag (isSystemDefined: false); only a Superadmin may create a system-defined one (403 otherwise). The name is trimmed; 400 when blank, 409 when a Tag with the same name exists (case-insensitive).',
            security: asUser
          }
        })
        .get('/', async ({ io }) => listTagsHandler(io), {
          response: t.Array(TagSchema),
          detail: { tags: ['Tags'], summary: 'List Tags' }
        })
        .post('/:tagId/promote', async ({ request, params: { tagId }, io }) => {
          return await promoteTagHandler(request, tagId, io);
        }, {
          params: t.Object({ tagId: t.String() }),
          response: TagSchema,
          detail: {
            tags: ['Moderation'],
            summary: 'Promote a free-form Tag to the known set',
            security: asUser
          }
        })
    )
    .group('/link-labels', (app) =>
      app
        .post('/', async ({ request, body, io }) => createLinkLabelHandler(request, body, io), {
          body: CreateLinkLabelBody,
          response: LinkLabelSchema,
          detail: {
            tags: ['Tags'],
            summary: 'Create a Link Label',
            description: 'Superadmin only. The name is trimmed; 400 when blank, 409 when a Link Label with the same name exists (case-insensitive).',
            security: asUser
          }
        })
        .get('/', async ({ io }) => listLinkLabelsHandler(io), {
          response: t.Array(LinkLabelSchema),
          detail: { tags: ['Tags'], summary: 'List Link Labels' }
        })
    )
    .group('/auth', (app) =>
      app
        .post(
          '/register',
          async ({ body, query: { orgId }, io }) => {
            return await registerHandler(body, orgId, io);
          },
          {
            body: RegisterBody,
            query: t.Object({ orgId: t.String({ description: 'Organization the new Member joins' }) }),
            response: t.Object({ user: UserSchema }),
            detail: {
              tags: ['Auth'],
              summary: 'Register a User as Member of an Organization',
              description: 'Sends a verification email. No session is returned: login is refused (403) until the link in the email is opened. 400 when the Organization does not exist.'
            }
          }
        )
        .get(
          '/verify-email',
          async ({ query: { token }, io, redirect }) => {
            const { verified } = await verifyEmailHandler(token, io);
            return redirect(`${appUrl.replace(/\/$/, '')}/login?emailVerified=${verified ? 1 : 0}`);
          },
          {
            query: t.Object({ token: t.String() }),
            detail: {
              tags: ['Auth'],
              summary: 'Verify an email (link sent by email)',
              description: 'Redirects to the frontend login page with emailVerified=1, or emailVerified=0 when the token is invalid or expired.'
            }
          }
        )
        .post(
          '/resend-verification',
          async ({ body, io }) => {
            return await resendVerificationHandler(body, io);
          },
          {
            body: ResendVerificationBody,
            response: t.Object({ success: t.Literal(true) }),
            detail: {
              tags: ['Auth'],
              summary: 'Send a new verification email',
              description: 'Always answers success, whether or not the email exists or is already verified.'
            }
          }
        )
        .post(
          '/request-password-reset',
          async ({ body, io }) => {
            return await requestPasswordResetHandler(body, io);
          },
          {
            body: RequestPasswordResetBody,
            response: t.Object({ success: t.Literal(true) }),
            detail: {
              tags: ['Auth'],
              summary: 'Email a link to choose a new password',
              description: 'Always answers success, whether or not the email belongs to an account. The link opens $APP_URL/redefinir-senha?token=… and is valid for 60 minutes.'
            }
          }
        )
        .post(
          '/reset-password',
          async ({ body, io }) => {
            return await resetPasswordHandler(body, io);
          },
          {
            body: ResetPasswordBody,
            response: t.Object({ success: t.Literal(true) }),
            detail: {
              tags: ['Auth'],
              summary: 'Set a new password with the emailed token',
              description: 'Ends every session of the account. 400 when the link is invalid, expired or already used.'
            }
          }
        )
        .post(
          '/login',
          async ({ body, io }) => {
            return await loginHandler(body, io);
          },
          {
            body: LoginBody,
            response: t.Object({
              userId: t.String(),
              token: t.String()
            }),
            detail: { tags: ['Auth'], summary: 'Log in with email and password', description: '401 for wrong credentials, 403 while the email is not verified.' }
          }
        )
        .get(
          '/me',
          async ({ request, io }) => {
            return await meHandler(request, io);
          },
          {
            response: UserSchema,
            detail: { tags: ['Auth'], summary: 'Get the logged-in User', security: asUser }
          }
        )
    )
    .group('/image-reviews', (app) =>
      app
        .get('/escalated', async ({ request, io }) => {
          return await listEscalatedImageReviewsHandler(request, io);
        }, {
          response: t.Array(ImageReviewItemSchema),
          detail: {
            tags: ['Images'],
            summary: 'List Images only Superadmins can review',
            description: "Superadmin only. Superadmins' Images, and Images whose Organization has no Moderator or Admin other than their uploader. The caller's own Images are left out.",
            security: asUser
          }
        })
        .post('/:imageId/approve', async ({ request, params: { imageId }, io }) => {
          return await approveImageHandler(request, imageId, io);
        }, {
          params: t.Object({ imageId: t.String() }),
          response: t.Object({ state: t.Literal('approved') }),
          detail: { tags: ['Images'], summary: 'Approve an Image in Image Review', description: '403 for the Image\'s own uploader or a caller who may not review it; 409 when it was already decided, or replaced or removed by its uploader.', security: asUser }
        })
        .post('/:imageId/reject', async ({ request, params: { imageId }, io }) => {
          return await rejectImageHandler(request, imageId, io);
        }, {
          params: t.Object({ imageId: t.String() }),
          response: t.Object({ state: t.Literal('rejected') }),
          detail: { tags: ['Images'], summary: 'Reject an Image in Image Review', description: 'A Confirmed Rejection: the uploader is shadow-banned. 403 for the Image\'s own uploader or a caller who may not review it; 409 when it was already decided, or replaced or removed by its uploader.', security: asUser }
        })
    )
    .get('/screening-policy', async ({ request, io }) => {
      return { policy: await getScreeningPolicyHandler(request, io) };
    }, {
      response: t.Object({ policy: t.Union([ScreeningPolicySchema, t.Null()]) }),
      detail: { tags: ['Images'], summary: 'Get the Screening Policy', description: 'Superadmin only. null until first set: meanwhile every Image waits in Image Review.', security: asUser }
    })
    .put('/screening-policy', async ({ request, body, io }) => {
      return await setScreeningPolicyHandler(request, body, io);
    }, {
      body: ScreeningPolicySchema,
      response: ScreeningPolicySchema,
      detail: { tags: ['Images'], summary: 'Replace the Screening Policy', description: 'Superadmin only. Per category, scores below `lower` are Approved, from `upper` on Rejected, in between In Review. Audited; Images already screened keep their state.', security: asUser }
    })
    .group('/organizations', (app) =>
      app
        .post(
          '/',
          async ({ request, body, io }) => {
            return await createOrganizationHandler(request, body, io);
          },
          {
            body: CreateOrganizationBody,
            response: OrganizationSchema,
            detail: { tags: ['Organizations'], summary: 'Create an Organization', description: 'Superadmin only. 409 when the slug is already used.', security: asUser }
          }
        )
        .get(
          '/',
          async ({ request, io }) => {
            return await listOrganizationsHandler(request, io);
          },
          {
            response: t.Array(OrganizationViewSchema),
            detail: { tags: ['Organizations'], summary: 'List Organizations', description: 'Superadmin only.', security: asUser }
          }
        )
        .get(
          '/:id',
          async ({ request, params: { id }, io, set }) => {
            const org = await getOrganizationHandler(request, id, io);
            if (!org) {
              set.status = 404;
              return { error: 'Not Found' };
            }
            return org;
          },
          {
            params: t.Object({ id: t.String() }),
            response: {
              200: OrganizationViewSchema,
              404: t.Object({ error: t.String() })
            },
            detail: { tags: ['Organizations'], summary: 'Get an Organization', description: 'Public: the kiosk TV display reads the branding. The logo is resolved for the viewer: its uploader sees their latest logo, everyone else the Approved one, or only its Placeholder (thumbhash).' }
          }
        )
        .patch(
          '/:id',
          async ({ request, params: { id }, body, io, set }) => {
            const org = await updateOrganizationHandler(request, id, body, io);
            if (!org) {
              set.status = 404;
              return { error: 'Not Found' };
            }
            return org;
          },
          {
            params: t.Object({ id: t.String() }),
            body: UpdateOrganizationBody,
            response: {
              200: OrganizationViewSchema,
              404: t.Object({ error: t.String() })
            },
            detail: { tags: ['Organizations'], summary: 'Update an Organization', description: 'Admin of the Organization, or Superadmin. 409 when the new slug belongs to another Organization.', security: asUser }
          }
        )
        .get(
          '/:id/feed',
          async ({ params: { id }, io }) => {
            return await eventFeedHandler(id, io);
          },
          {
            params: t.Object({ id: t.String() }),
            response: t.Array(FeedEventSchema),
            detail: {
              tags: ['Organizations'],
              summary: 'Get the weighted event feed shown on kiosks',
              description: 'Events weighted by Votes and temporal relevance. Hidden events and events by shadow-banned Users are excluded.'
            }
          }
        )
        .put('/:id/logo', async ({ request, params: { id }, body, io }) => {
          return await uploadOrganizationLogoHandler(request, id, body.file, io);
        }, {
          params: t.Object({ id: t.String() }),
          body: ImageUploadBody,
          response: ImageViewSchema,
          detail: {
            tags: ['Images'],
            summary: "Upload the Organization's logo",
            description: 'Admin of the Organization, or Superadmin. Multipart `file`: a still JPEG, PNG or WebP of at most 4 MB, square (±1 px) and at least 256×256. It is normalized (WebP, no metadata, at most 512×512), screened, and answered as its uploader sees it. 400/413/415 with a `code` when the file is refused, 429 after 10 Images in 24 hours.',
            security: asUser
          }
        })
        .delete('/:id/logo', async ({ request, params: { id }, io }) => {
          await removeOrganizationLogoHandler(request, id, io);
          return { success: true };
        }, {
          params: t.Object({ id: t.String() }),
          response: t.Object({ success: t.Literal(true) }),
          detail: { tags: ['Images'], summary: "Remove the Organization's logo", description: 'Admin of the Organization, or Superadmin.', security: asUser }
        })
        .get('/:id/image-reviews', async ({ request, params: { id }, io }) => {
          return await listImageReviewsHandler(request, id, io);
        }, {
          params: t.Object({ id: t.String() }),
          response: t.Array(ImageReviewItemSchema),
          detail: {
            tags: ['Images'],
            summary: 'List Images awaiting Image Review',
            description: "Moderators and Admins of the Organization, or Superadmins. Oldest first. The caller's own Images and Superadmins' Images are left out.",
            security: asUser
          }
        })
        .get('/:id/reports', async ({ request, params: { id }, io }) => {
          return await listReportsHandler(request, id, io);
        }, {
          params: t.Object({ id: t.String() }),
          response: t.Array(ReportSchema),
          detail: { tags: ['Moderation'], summary: 'List Reports', security: asUser }
        })
        .get('/:id/shadow-bans', async ({ request, params: { id }, io }) => {
          return await listShadowBansHandler(request, id, io);
        }, {
          params: t.Object({ id: t.String() }),
          response: t.Array(UserSchema),
          detail: { tags: ['Moderation'], summary: 'List shadow-banned Users', security: asUser }
        })
        .delete('/:id/shadow-bans/:userId', async ({ request, params: { id, userId }, io }) => {
          return await liftShadowBanHandler(request, id, userId, io);
        }, {
          params: t.Object({ id: t.String(), userId: t.String() }),
          response: UserSchema,
          detail: { tags: ['Moderation'], summary: 'Lift a shadow ban', security: asUser }
        })
        .get('/:id/audit', async ({ request, params: { id }, io }) => {
          return await listAuditTrailHandler(request, id, io);
        }, {
          params: t.Object({ id: t.String() }),
          response: t.Array(AuditEntrySchema),
          detail: { tags: ['Moderation'], summary: 'Get the Audit Trail', security: asUser }
        })
        .group('/:id/users', (usersApp) =>
          usersApp
            .get(
              '/',
              async ({ request, params: { id }, io }) => {
                return await listOrgUsersHandler(request, id, io);
              },
              {
                params: t.Object({ id: t.String() }),
                query: t.Object({ search: t.Optional(t.String({ description: 'Filter by name' })) }),
                response: t.Array(UserSchema),
                detail: { tags: ['Users'], summary: 'List Users of an Organization', security: asUser }
              }
            )
            .patch(
              '/:userId/role',
              async ({ request, params: { id, userId }, body, io }) => {
                return await assignRoleHandler(request, id, userId, body, io);
              },
              {
                params: t.Object({ id: t.String(), userId: t.String() }),
                body: ChangeRoleBody,
                response: UserSchema,
                detail: { tags: ['Users'], summary: 'Change a User role', description: 'Admin of the Organization, or Superadmin. Only a Superadmin may assign Superadmin; the User then leaves the Organization. Changes are recorded in the audit trail (change_role).', security: asUser }
              }
            )
            .delete(
              '/:userId',
              async ({ request, params: { id, userId }, io }) => {
                await removeUserHandler(request, id, userId, io);
                return { success: true };
              },
              {
                params: t.Object({ id: t.String(), userId: t.String() }),
                response: t.Object({ success: t.Literal(true) }),
                detail: {
                  tags: ['Users'],
                  summary: 'Remove a User from an Organization',
                  description: 'Admin of the Organization, or Superadmin. Deactivates the User: their sessions and credentials are revoked (existing tokens answer 401, login fails), their Events are soft-deleted, they disappear from user listings, and a remove_user entry is added to the Audit Trail. 400 when removing yourself, 404 for an unknown or already removed User.',
                  security: asUser
                }
              }
            )
        )
        .group('/:id/devices', (devicesApp) =>
          devicesApp
            .get('/', async ({ request, params: { id }, io }) => {
              return await listActiveDevicesOrgHandler(request, id, io);
            }, {
              params: t.Object({ id: t.String() }),
              response: t.Array(PublicDeviceSchema),
              detail: { tags: ['Device Management'], summary: 'List active Devices', security: asUser }
            })
            .get('/pending', async ({ request, params: { id }, io }) => {
              return await listPendingDevicesOrgHandler(request, id, io);
            }, {
              params: t.Object({ id: t.String() }),
              response: t.Array(PublicDeviceSchema),
              detail: { tags: ['Device Management'], summary: 'List pending Devices that identified this Organization', security: asUser }
            })
            .get('/:deviceId', async ({ request, params: { id, deviceId }, io }) => {
              return await getDeviceHandler(request, id, deviceId, io);
            }, {
              params: t.Object({ id: t.String(), deviceId: t.String() }),
              response: PublicDeviceSchema,
              detail: { tags: ['Device Management'], summary: 'Get a Device', security: asUser }
            })
            .get('/:deviceId/status', async ({ request, params: { id, deviceId }, io }) => {
              return await getDeviceStatusHandler(request, id, deviceId, io);
            }, {
              params: t.Object({ id: t.String(), deviceId: t.String() }),
              response: t.Object({ isOnline: t.Boolean(), latestHeartbeat: t.Nullable(HeartbeatSchema) }),
              detail: {
                tags: ['Device Management'],
                summary: 'Get Device online status',
                description: 'Online means a heartbeat arrived in the last 60 seconds.',
                security: asUser
              }
            })
            .post('/update-uploads', async ({ request, params: { id }, body, io }) => {
              return await requestUpdateUploadHandler(request, id, body, io);
            }, {
              params: t.Object({ id: t.String() }),
              body: RequestUpdateUploadBody,
              response: UpdateUploadGrantSchema,
              detail: {
                tags: ['Device Management'],
                summary: 'Authorize the upload of a Puppet update binary',
                description: 'Admin of the Organization, or Superadmin. Answers a credential the browser uses to upload one binary of at most 64 MiB straight to the private store (Vercel Blob), under the returned `pathname` and `contentType`. Then send an update Command with payload { blobPathname, sha256, version? }: the Device receives { url, sha256, version? } with a freshly signed URL valid for one hour each time it pulls the Command.',
                security: asUser
              }
            })
            .get('/:deviceId/logs', async ({ request, params: { id, deviceId }, io }) => {
              return await getDeviceLogsHandler(request, id, deviceId, io);
            }, {
              params: t.Object({ id: t.String(), deviceId: t.String() }),
              response: t.Array(DeviceLogSchema),
              detail: { tags: ['Device Management'], summary: 'List Device logs', security: asUser }
            })
            .get('/:deviceId/telemetry', async ({ request, params: { id, deviceId }, io }) => {
              return { telemetry: await getDetailedTelemetryHandler(request, id, deviceId, io) };
            }, {
              params: t.Object({ id: t.String(), deviceId: t.String() }),
              response: t.Object({ telemetry: t.Nullable(DeviceTelemetrySchema) }),
              detail: {
                tags: ['Device Management'],
                summary: 'Get the latest detailed Telemetry',
                description: '`telemetry` is null until the Device has sent detailed Telemetry at least once. Wrapped in an object because a bare null response body is sent empty, which is not JSON.',
                security: asUser
              }
            })
            .post('/:deviceId/telemetry/request', async ({ request, params: { id, deviceId }, io }) => {
              return await requestTelemetryHandler(request, id, deviceId, io);
            }, {
              params: t.Object({ id: t.String(), deviceId: t.String() }),
              response: IssuedCommandSchema,
              detail: {
                tags: ['Device Management'],
                summary: 'Request detailed Telemetry',
                description: 'Queues a request_telemetry Command for the Device to pick up and sends its Wake-up. The answer carries the outcome in `wakeup`.',
                security: asUser
              }
            })
            .get('/:deviceId/commands', async ({ request, params: { id, deviceId }, io }) => {
              return await listCommandsHandler(request, id, deviceId, io);
            }, {
              params: t.Object({ id: t.String(), deviceId: t.String() }),
              response: t.Array(CommandSchema),
              detail: { tags: ['Device Management'], summary: 'List Commands sent to a Device', security: asUser }
            })
            .post('/:deviceId/commands', async ({ request, params: { id, deviceId }, body, io }) => {
              return await sendCommandHandler(request, id, deviceId, body, io);
            }, {
              params: t.Object({ id: t.String(), deviceId: t.String() }),
              body: CreateCommandBody,
              response: IssuedCommandSchema,
              detail: {
                tags: ['Device Management'],
                summary: 'Send a Command to a Device',
                description: 'An update Command requires payload { url, sha256, version? } or, for a binary uploaded through update-uploads, { blobPathname, sha256, version? }; Puppet verifies the digest and architecture before installing. Other types take an optional free-form payload. The Command is stored first, then its Wake-up is published to the broker; the answer carries the outcome in `wakeup` (`{ sent: true }` or `{ sent: false, reason }`). A failed Wake-up never fails the request: the Device receives the Command on its next heartbeat (up to 20 s).',
                security: asUser
              }
            })
        )
        .group('/:id/events', (eventsApp) =>
          eventsApp
            .post('/', async ({ request, params: { id }, body, io }) => {
              return await createEventHandler(request, id, body, io);
            }, {
              params: t.Object({ id: t.String() }),
              body: CreateEventBody,
              response: EventSchema,
              detail: { tags: ['Events'], summary: 'Create an Event', security: asUser }
            })
            .get('/', async ({ request, params: { id }, io }) => {
              return await listEventsHandler(request, id, io);
            }, {
              params: t.Object({ id: t.String() }),
              response: t.Array(EventViewSchema),
              detail: { tags: ['Events'], summary: 'List Events', security: asUser }
            })
            .get('/mine', async ({ request, params: { id }, io }) => {
              return await listMyEventsHandler(request, id, io);
            }, {
              params: t.Object({ id: t.String() }),
              response: t.Array(EventViewSchema),
              detail: {
                tags: ['Events'],
                summary: 'List my Events',
                description: 'The logged-in User\'s own Events in the Organization, newest first, including hidden and expired ones and free-form Tags; deleted Events are left out. 401 without a session, 403 for a User of another Organization (a Superadmin may use any Organization).',
                security: asUser
              }
            })
            .get('/:eventId', async ({ request, params: { id, eventId }, io }) => {
              return await getEventHandler(request, id, eventId, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: EventWithVotesSchema,
              detail: { tags: ['Events'], summary: 'Get an Event with its Vote count', description: 'Hidden Events and Events by shadow-banned Users answer 404, except to their creator and to Moderators+ of the Organization or Superadmins.', security: asUser }
            })
            .delete('/:eventId', async ({ request, params: { id, eventId }, io }) => {
              await deleteEventHandler(request, id, eventId, io);
              return { success: true };
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: t.Object({ success: t.Literal(true) }),
              detail: { tags: ['Events'], summary: 'Delete an Event (soft delete)', security: asUser }
            })
            .put('/:eventId/banner', async ({ request, params: { id, eventId }, body, io }) => {
              return await uploadEventBannerHandler(request, id, eventId, body.file, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              body: ImageUploadBody,
              response: ImageViewSchema,
              detail: {
                tags: ['Images'],
                summary: "Upload an Event's banner",
                description: 'Event creator only. Multipart `file`: a still JPEG, PNG or WebP of at most 4 MB, 16:9 (±1 px) and at least 960×540. It is normalized (WebP, no metadata, at most 1920×1080), screened, and answered as its uploader sees it. 400/413/415 with a `code` when the file is refused, 429 after 10 Images in 24 hours.',
                security: asUser
              }
            })
            .delete('/:eventId/banner', async ({ request, params: { id, eventId }, io }) => {
              await removeEventBannerHandler(request, id, eventId, io);
              return { success: true };
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: t.Object({ success: t.Literal(true) }),
              detail: { tags: ['Images'], summary: "Remove an Event's banner", description: 'Event creator only.', security: asUser }
            })
            .post('/:eventId/vote', async ({ request, params: { id, eventId }, io }) => {
              return await voteHandler(request, id, eventId, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: t.Object({ status: t.Union([t.Literal('voted'), t.Literal('unvoted')]) }),
              detail: { tags: ['Votes'], summary: 'Toggle a Vote on an Event', security: asUser }
            })
            .get('/:eventId/vote', async ({ request, params: { id, eventId }, io }) => {
              return await getVoteStatusHandler(request, id, eventId, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: t.Object({ voted: t.Boolean() }),
              detail: { tags: ['Votes'], summary: 'Check whether the logged-in User voted', security: asUser }
            })
            .get('/:eventId/report', async ({ request, params: { id, eventId }, io }) => {
              return await getReportStatusHandler(request, id, eventId, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: t.Object({ reported: t.Boolean() }),
              detail: { tags: ['Moderation'], summary: 'Whether the logged-in User already reported an Event', security: asUser }
            })
            .post('/:eventId/report', async ({ request, params: { id, eventId }, body, io }) => {
              return await reportEventHandler(request, id, eventId, body, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              body: CreateReportBody,
              response: ReportSchema,
              detail: {
                tags: ['Moderation'],
                summary: 'Report an Event',
                description: 'One Report per User per Event. Reaching the Organization threshold hides the Event and shadow-bans its creator.',
                security: asUser
              }
            })
            .post('/:eventId/hide', async ({ request, params: { id, eventId }, io }) => {
              return await hideEventHandler(request, id, eventId, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: EventSchema,
              detail: { tags: ['Moderation'], summary: 'Hide an Event', security: asUser }
            })
            .post('/:eventId/unhide', async ({ request, params: { id, eventId }, io }) => {
              return await unhideEventHandler(request, id, eventId, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: EventSchema,
              detail: { tags: ['Moderation'], summary: 'Unhide an Event', security: asUser }
            })
        )
    );
}
