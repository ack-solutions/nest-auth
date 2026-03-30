import axios, { AxiosError } from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';

export type ApiError = {
    message: string;
    status?: number;
    code?: string;
    data?: unknown;
    url?: string;
    method?: string;
};

const getApiBaseUrl = (): string => {
    return import.meta.env.VITE_API_BASE_URL || '';
};

const normalizeAxiosError = (err: unknown): ApiError => {
    const axiosErr = err as AxiosError;

    const status = axiosErr.response?.status;
    const data = axiosErr.response?.data as unknown;

    const dataObj = data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined;
    const messageFromData = typeof dataObj?.message === 'string' ? dataObj.message : undefined;
    const codeFromData = typeof dataObj?.code === 'string' ? dataObj.code : undefined;

    const message =
        (typeof data === 'string' && data) ||
        messageFromData ||
        axiosErr.message ||
        'Something went wrong';

    return {
        message,
        status,
        code: codeFromData,
        data,
        url: axiosErr.config?.url,
        method: axiosErr.config?.method?.toUpperCase(),
    };
};

export const instanceApi: AxiosInstance = axios.create({
    baseURL: getApiBaseUrl(),
    withCredentials: false,
    timeout: 30000,
} as AxiosRequestConfig);

instanceApi.interceptors.response.use(
    (res) => res,
    (error) => Promise.reject(normalizeAxiosError(error)),
);

