import { Link } from 'react-router-dom';
import { AddMRInput } from '../AddMRInput/AddMRInput';
import { formatTimeAgo } from '../../utils/timeFormatter';

interface NavBarProps {
    addMR: (url: string) => Promise<void>;
    loading: boolean;
    error: string | null;
    onErrorClear: () => void;
    lastUpdated: string | null;
    onRefresh: () => void;
    onOpenConfig: () => void;
}

export function NavBar({ addMR, loading, error, onErrorClear, lastUpdated, onRefresh, onOpenConfig }: NavBarProps) {
    return (
        <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold text-gray-900">
                    <Link to="/" className="hover:underline">GitLab MR Tracker</Link>
                </h1>
                <div className="flex items-center gap-4">
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                        title="Refresh all merge requests"
                    >
                        🔄 Refresh
                    </button>
                    <Link
                        to="/merged-uat"
                        className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors"
                        title="Show merged MRs waiting for UAT"
                    >
                        🎯 Merged → UAT
                    </Link>
                    <Link
                        to="/compare-develop-master"
                        className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors"
                        title="Compare develop → master"
                    >
                        🔀 Compare develop → master
                    </Link>
                    <Link
                        to="/feature"
                        className="px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors"
                        title="Feature page"
                    >
                        ✨ Feature
                    </Link>
                    <button
                        onClick={onOpenConfig}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Configuration"
                    >
                        ⚙️
                    </button>
                </div>
            </div>

            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add Custom MR
                </label>
                <AddMRInput
                    onAdd={addMR}
                    loading={loading}
                    error={error}
                    onErrorClear={onErrorClear}
                />
            </div>

            {lastUpdated && (
                <div className="text-sm text-gray-500">
                    Last updated: {formatTimeAgo(lastUpdated)}
                </div>
            )}
        </div>
    );
}

export default NavBar;
