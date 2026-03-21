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
    const [allMRs, setAllMRs] = useState<MergeRequest[]>([]);
    const [list, setList] = useState<MergeRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [repoFilter, setRepoFilter] = useState<string>(selectedRepository || '');

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const mrs = await fetchMergeRequestsByBranches(config, 'develop', 'master');
                if (!mounted) return;
                setAllMRs(mrs);
                const initialFiltered = selectedRepository
                    ? mrs.filter((mr) => mr.repository === selectedRepository)
                    : mrs;
                setList(initialFiltered);
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

    // Keep local repo filter in sync when parent prop changes
    useEffect(() => {
        setRepoFilter(selectedRepository || '');
    }, [selectedRepository]);

    // Recompute visible list when allMRs or repoFilter changes
    useEffect(() => {
        if (!repoFilter) {
            setList(allMRs);
        } else {
            setList(allMRs.filter((mr) => mr.repository === repoFilter));
        }
    }, [allMRs, repoFilter]);

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
                        {(() => {
                            const repoPathRaw = repoFilter ? repoFilter : '';
                            const repoPath = repoPathRaw.replace(/^\/+|\/+$/g, '');
                            const encodedRepoPath = repoPath
                                ? repoPath.split('/').map((seg) => encodeURIComponent(seg)).join('/')
                                : '';
                            const compareUrl = encodedRepoPath
                                ? `${config.gitlabHost.replace(/\/$/, '')}/${encodedRepoPath}/-/compare/master...develop`
                                : '';

                            return (
                                <button
                                    onClick={() => compareUrl && window.open(compareUrl, '_blank', 'noopener')}
                                    disabled={!compareUrl}
                                    title={compareUrl ? 'Open GitLab compare: develop → master' : 'No repository selected'}
                                    className={`px-4 py-2 rounded-lg transition-colors ${compareUrl ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                                >
                                    Open GitLab Compare
                                </button>
                            );
                        })()}
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
