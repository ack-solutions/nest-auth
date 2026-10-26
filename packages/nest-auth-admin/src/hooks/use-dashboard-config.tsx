import { createContext, useContext } from 'react';
import type { DashboardConfig } from '../types';

/** Admin-console config from `GET /config` (`adminConsole.*` switches). */
export const DashboardConfigContext = createContext<DashboardConfig>({ allowAdminManagement: false });

export function useDashboardConfig(): DashboardConfig {
    return useContext(DashboardConfigContext);
}

/**
 * Whether the console may create platform users and grant, revoke or edit
 * them (`adminConsole.allowPlatformUserManagement`, default true).
 */
export function useAllowPlatformUserManagement(): boolean {
    return useDashboardConfig().allowPlatformUserManagement !== false;
}
