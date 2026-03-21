import React, { useEffect, useState } from 'react';
import { MRTable } from '../MRTable/MRTable';
import { useConfig } from '../../hooks/useConfig';
import { fetchMergeRequestsByBranches } from '../../services/gitlabApi';
import { MergeRequest } from '../../types';

interface Props {
    onMarkAsRead: (id: string) => void;
    onMarkAsUnread: (id: string) => void;
    hasNewComments: (mr: MergeRequest) => boolean;
    isRead: (id: string) => boolean;
    onBack?: () => void;
    selectedRepository?: string;
}

export function CompareBranchesPage({ onMarkAsRead, onMarkAsUnread, hasNewComments, isRead, onBack, selectedRepository }: Props) {
    const { config } = useConfig();
    const [list, setList] = useState<MergeRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const mrs = await fetchMergeRequestsByBranches(config, 'develop', 'master');
                if (!mounted) return;
                let filtered = mrs;
                if (selectedRepository) {
                    filtered = filtered.filter((mr) => mr.repository === selectedRepository);
                }
                setList(filtered);
            } catch (err: any) {
                setError(err?.message || 'Failed to load merge requests');
            } finally {
                setLoading(false);
            }
        };

        load();
        return () => {
            mounted = false;
        };
    }, [config, selectedRepository]);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Compare: develop → master</h1>
                        <div className="text-sm text-gray-500">Showing open merge requests whose source is <strong>develop</strong> and target is <strong>master</strong>.</div>
                    </div>
                    <div className="flex items-center space-x-3">
                        {onBack && (
                            <button onClick={onBack} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">← Back</button>
                        )}
                        <a
                            href={`${config.gitlabHost.replace(/\/$/, '')}/-/compare/master...develop`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Open GitLab Compare
                        </a>
                    </div>
                </div>

                {loading && (
                    <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow-sm border border-gray-200">Loading...</div>
                )}

                {error && (
                    <div className="text-center py-6 text-red-600 bg-white rounded-lg shadow-sm border border-red-100">{error}</div>
                )}

                {!loading && !error && list.length === 0 && (
                    <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow-sm border border-gray-200">
                        <p className="text-lg">No open merge requests found from develop → master.</p>
                    </div>
                )}

                {!loading && !error && list.length > 0 && (
                    <MRTable
                        title={`develop → master (${list.length})`}
                        mrList={list}
                        onMarkAsRead={onMarkAsRead}
                        onMarkAsUnread={onMarkAsUnread}
                        hasNewComments={hasNewComments}
                        isRead={isRead}
                    />
                )}
            </div>
        </div>
    );
}

export default CompareBranchesPage;
