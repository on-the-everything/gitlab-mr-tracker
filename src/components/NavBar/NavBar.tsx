import { Link, NavLink } from 'react-router-dom';
import { formatTimeAgo } from '../../utils/timeFormatter';

interface NavBarProps {
    loading: boolean;
    lastUpdated: string | null;
    onRefresh: () => void;
    onOpenConfig: () => void;
}

const navItems = [
    {
        to: '/',
        label: 'Dashboard',
        icon: '📋',
        end: true,
        title: 'MR dashboard',
    },
    {
        to: '/merged-uat',
        label: 'Merged UAT',
        icon: '🎯',
        title: 'Show merged MRs waiting for UAT',
    },
    {
        to: '/release-checklist',
        label: 'Release Checklist',
        icon: '🚦',
        title: 'Check sprint MRs before UAT or PROD deploy',
    },
    {
        to: '/compare-develop-master',
        label: 'Compare Branches',
        icon: '🔀',
        title: 'Compare develop → master',
    },
    {
        to: '/monitor-master',
        label: 'Monitor Master',
        icon: '🛡️',
        title: 'Check if master has drifted from develop',
    },
    {
        to: '/feature',
        label: 'Feature',
        icon: '✨',
        title: 'Feature page',
    },
    {
        to: '/utils',
        label: 'Utils',
        icon: '🔧',
        title: 'Utils - format converter',
    },
];

export function NavBar({ loading, lastUpdated, onRefresh, onOpenConfig }: NavBarProps) {
    return (
        <header className="mb-8 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <Link
                        to="/"
                        className="block text-2xl font-bold text-gray-900 hover:text-blue-700"
                    >
                        GitLab MR Tracker
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                        <span>Merge request workspace</span>
                        {lastUpdated && (
                            <>
                                <span className="text-gray-300">•</span>
                                <span>Updated {formatTimeAgo(lastUpdated)}</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                        title="Refresh all merge requests"
                    >
                        <span aria-hidden="true">{loading ? '⏳' : '🔄'}</span>
                        <span>{loading ? 'Refreshing' : 'Refresh'}</span>
                    </button>
                    <button
                        onClick={onOpenConfig}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                        title="Configuration"
                    >
                        <span aria-hidden="true">⚙️</span>
                        <span>Config</span>
                    </button>
                </div>
            </div>

            <nav className="border-t border-gray-200 px-3 py-2" aria-label="Primary navigation">
                <div className="flex flex-wrap items-center gap-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            title={item.title}
                            className={({ isActive }) => [
                                'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                                isActive
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                            ].join(' ')}
                        >
                            <span aria-hidden="true">{item.icon}</span>
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>
        </header>
    );
}

export default NavBar;
