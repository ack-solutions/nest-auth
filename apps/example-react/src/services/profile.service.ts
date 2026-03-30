import { instanceApi } from '../api/axios-instance';

export type ProfileResponse = {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    displayName?: string;
    avatarUrl?: string;
    phone?: string;
    gender?: string;
    dob?: string | null;
    isVerified: boolean;
    isMfaEnabled: boolean;
    createdAt: string | Date;
    updatedAt?: string | Date;
};

export type UpdateProfileResponse = {
    message: string;
    profile: ProfileResponse;
};

type UpdateProfilePayload = {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    phone?: string;
};

class ProfileService {
    async getProfile(): Promise<ProfileResponse> {
        const { data } = await instanceApi.get<ProfileResponse>('profile');
        return data;
    }

    async updateProfile(payload: UpdateProfilePayload): Promise<UpdateProfileResponse> {
        const { data } = await instanceApi.patch<UpdateProfileResponse>('profile', payload);
        return data;
    }
}

export const profileService = new ProfileService();

