import { Injectable } from '@nestjs/common';
import { AppUser } from './user.entity';

type SignupMetadata = {
    firstName?: string;
    lastName?: string;
    gender?: string;
    dob?: string | Date | null;
};

@Injectable()
export class UserService {
    private parseDob(dob?: string | Date | null): Date | null | undefined {
        if (dob === undefined) return undefined;
        if (dob === null) return null;
        const d = dob instanceof Date ? dob : new Date(dob);
        if (Number.isNaN(d.getTime())) return undefined;
        return d;
    }

    /**
     * Upsert by `authUserId` using signup metadata (firstName/lastName/gender/dob).
     */
    async upsertFromSignup(authUserId: string, metadata?: SignupMetadata) {
        if (!authUserId) {
            return null;
        }

        const firstName = metadata?.firstName ? String(metadata.firstName) : undefined;
        const lastName = metadata?.lastName ? String(metadata.lastName) : undefined;
        const gender = metadata?.gender ? String(metadata.gender) : undefined;
        const dob = this.parseDob(metadata?.dob ?? null);

        const existing = await AppUser.findOne({ where: { authUserId } });
        if (!existing) {
            const created = AppUser.create({
                authUserId,
                firstName,
                lastName,
                gender,
                dob: dob ?? null,
            });
            // ManyToOne join will be set automatically by relation id
            // because we store authUserId; no need to load the relation here.
            return await created.save();
        }

        // Only overwrite if the field is present in metadata.
        if (metadata?.firstName !== undefined) existing.firstName = firstName;
        if (metadata?.lastName !== undefined) existing.lastName = lastName;
        if (metadata?.gender !== undefined) existing.gender = gender;
        if (metadata?.dob !== undefined) existing.dob = dob ?? null;

        return await existing.save();
    }

    async ensureFromAuthUserMetadata(authUserId: string, metadata?: SignupMetadata) {
        if (!authUserId) return null;
        const existing = await AppUser.findOne({ where: { authUserId } });
        if (existing) return existing;
        return await this.upsertFromSignup(authUserId, metadata);
    }

    async findByAuthUserId(authUserId: string): Promise<AppUser | null> {
        return await AppUser.findOne({ where: { authUserId } });
    }
}

