import { Injectable, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserService } from '../../user/services/user.service';
import { TenantService } from '../../tenant/services/tenant.service';
import { JwtService } from '../../core/services/jwt.service';
import { NestAuthUser } from '../../user/entities/user.entity';
import { NestAuthEvents, ERROR_CODES } from '../../auth.constants';
import { UserInvitedEvent } from '../events/user-invited.event';
import { normalizedEmail, normalizedPhone } from '../../utils';

export interface InviteUserInput {
    email?: string;
    phone?: string;
    /** Tenant to invite into (ISOLATED: the same email is a distinct account per tenant). */
    tenantId?: string;
    /** Arbitrary data stored on a newly-created user and echoed on the event for your email template. */
    metadata?: Record<string, any>;
    /** Optional id of the admin issuing the invite (echoed on the event). */
    invitedBy?: string;
}

/**
 * First-class member-invite flow.
 *
 * `inviteUser` creates-or-links the user in the tenant, mints a tenant-scoped
 * single-use set-password token, and emits {@link UserInvitedEvent} carrying that
 * token so your listener can send the invitation email — exactly like the
 * password-reset / signup events. The token is **never** returned to the caller
 * (returning it would leak a working credential into logs / the network tab).
 *
 * The member opens the email link and sets their password via
 * `POST /auth/reset-password { token, newPassword }`, then signs in normally.
 */
@Injectable()
export class InviteService {
    constructor(
        private readonly userService: UserService,
        private readonly tenantService: TenantService,
        private readonly jwtService: JwtService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    async inviteUser(input: InviteUserInput): Promise<{ user: NestAuthUser; isNewUser: boolean }> {
        const email = input.email ? normalizedEmail(input.email) : undefined;
        const phone = input.phone ? normalizedPhone(input.phone) : undefined;
        if (!email && !phone) {
            throw new BadRequestException({
                message: 'Either email or phone is required',
                code: ERROR_CODES.EMAIL_OR_PHONE_REQUIRED,
            });
        }

        const tenantId = (await this.tenantService.resolveTenantId(input.tenantId ?? null)) ?? undefined;

        // Create-or-link within this tenant.
        let user: NestAuthUser | null = email
            ? await this.userService.getUserByEmail(email, tenantId)
            : null;
        if (!user && phone) {
            user = await this.userService.getUserByPhone(phone, tenantId);
        }

        let isNewUser = false;
        if (!user) {
            // createUser is transactional and also creates the email/phone identity
            // + default access, so the member can sign in once they set a password.
            user = await this.userService.createUser(
                { email, phone, isActive: true } as Partial<NestAuthUser>,
                tenantId,
                input.metadata,
            );
            isNewUser = true;
        }

        // Tenant-scoped, single-use set-password token. passwordHashPrefix is ''
        // because an invited user has no password yet — once they set one, the
        // token can't be replayed (the prefix no longer matches the new hash).
        const token = await this.jwtService.generatePasswordResetToken({
            userId: user.id!,
            passwordHashPrefix: '',
            type: 'password-reset',
            tenantId,
        });

        await this.eventEmitter.emitAsync(
            NestAuthEvents.USER_INVITED,
            new UserInvitedEvent({
                user,
                tenantId,
                token,
                isNewUser,
                invitedBy: input.invitedBy,
                metadata: input.metadata,
            }),
        );

        return { user, isNewUser };
    }
}
