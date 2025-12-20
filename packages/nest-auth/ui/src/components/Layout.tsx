import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Shield, Building2, BookOpen, UserCog, LogOut, FileText, Key } from 'lucide-react';
import { api } from '../services/api';
import type { DashboardConfig, Admin } from '../types';

interface LayoutProps {
    children: React.ReactNode;
    config: DashboardConfig;
    onLogout: () => Promise<void>;
}

export const Layout: React.FC<LayoutProps> = ({ children, config, onLogout }) => {
    const navigate = useNavigate();
    const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);

    useEffect(() => {
        const loadCurrentAdmin = async () => {
            try {
                const admin = await api.get<Admin>('/me');
                setCurrentAdmin(admin);
            } catch (error) {
                console.error('Failed to load current admin:', error);
            }
        };
        loadCurrentAdmin();
    }, []);

    const handleLogout = async () => {
        await onLogout();
        navigate('/login', { replace: true });
    };

    const navItems = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/users', icon: Users, label: 'Users' },
        { to: '/roles', icon: Shield, label: 'Roles' },
        { to: '/permissions', icon: Key, label: 'Permissions' },
        { to: '/tenants', icon: Building2, label: 'Tenants' },
        { to: '/api', icon: FileText, label: 'API Docs' },
        ...(config.allowAdminManagement ? [{ to: '/admins', icon: UserCog, label: 'Admins' }] : []),
    ];

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-sidebar text-white flex flex-col shadow-xl">
                {/* Header */}
                <div className="p-6 border-b border-sidebar-light">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                        Nest Auth
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">Admin Dashboard</p>
                    {currentAdmin && (
                        <div className="mt-3 pt-3 border-t border-sidebar-light">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                    {currentAdmin.email.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-white truncate">{currentAdmin.email}</p>
                                    {currentAdmin.name && (
                                        <p className="text-xs text-gray-400 truncate">{currentAdmin.name}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                    ? 'bg-primary-600 text-white'
                                    : 'text-gray-300 hover:bg-sidebar-light hover:text-white'
                                }`
                            }
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-sidebar-light">
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Sign out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
};
