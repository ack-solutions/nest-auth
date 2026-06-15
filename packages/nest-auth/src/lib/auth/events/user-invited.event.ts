import { NestAuthUser } from '../../user/entities/user.entity';

export interface UserInvitedEventPayload {
    /** The invited (created-or-linked) user. */
    user: NestAuthUser;
    /** The tenant the invite is scoped to (ISOLATED/SHARED), if any. */
    tenantId?: string;
    /**
     * The single-use set-password token for the invite link (plaintext, for your
     * email template). It is a tenant-scoped password-reset token — the member
     * sets their password via `POST /auth/reset-password { token, newPassword }`.
     * SECURITY: it is intentionally NEVER returned in the HTTP response — only
     * carried on this event. Don't log it.
     */
    token: string;
    /** `true` if a brand-new user was created; `false` if an existing one was re-invited/linked. */
    isNewUser: boolean;
    /** Optional id of the admin/user who issued the invite (if you pass it). */
    invitedBy?: string;
    /** Anything extra you passed on the invite (e.g. a display name) for the email template. */
    metadata?: Record<string, any>;
}

/**
 * Emitted when an admin invites a member. Listen to it to send the invitation
 * email — mirrors `PASSWORD_RESET_REQUESTED` / signup events.
 */
export class UserInvitedEvent {
    constructor(public readonly payload: UserInvitedEventPayload) { }
}
