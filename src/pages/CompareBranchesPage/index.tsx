import { useEffect, useState } from 'react';
import { MRTable } from '../../components/MRTable/MRTable';
import { useConfig } from '../../hooks/useConfig';
import { fetchMergeRequestsByBranches, fetchRepositoryCompare } from '../../services/gitlabApi';
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
    const [compareDiffs, setCompareDiffs] = useState<any[]>([]);
    const [loadingCompare, setLoadingCompare] = useState(false);
    const [compareError, setCompareError] = useState<string | null>(null);

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

    // Fetch compare diffs for the selected repository (master -> develop)
    useEffect(() => {
        let mounted = true;
        const loadCompare = async () => {
            if (!repoFilter) {
                setCompareDiffs([]);
                setCompareError(null);
                setLoadingCompare(false);
                return;
            }

            setLoadingCompare(true);
            setCompareError(null);
            try {
                const diffs = await fetchRepositoryCompare(config, repoFilter, 'master', 'develop');
                if (!mounted) return;
                setCompareDiffs(diffs || []);
            } catch (err: any) {
                if (!mounted) return;
                setCompareError(err?.message || 'Failed to fetch compare diffs');
                setCompareDiffs([]);
            } finally {
                if (mounted) setLoadingCompare(false);
            }
        };

        loadCompare();
        return () => {
            mounted = false;
        };
    }, [config, repoFilter]);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <div className="flex items-center space-x-3">
                            <h1 className="text-2xl font-bold text-gray-900">Compare: develop → master</h1>
                            <div className="text-sm text-orange-600 font-medium">in-progress</div>
                        </div>
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

                {/* Compare diffs panel for selected repository */}
                {repoFilter && (
                    <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <h2 className="text-lg font-semibold text-gray-800">Changes (master → develop)</h2>
                        {loadingCompare && (
                            <div className="text-sm text-gray-500 py-2">Loading changes...</div>
                        )}
                        {compareError && (
                            <div className="text-sm text-red-600 py-2">{compareError}</div>
                        )}
                        {!loadingCompare && !compareError && compareDiffs.length === 0 && (
                            <div className="text-sm text-gray-500 py-2">No file changes found between branches.</div>
                        )}
                        {!loadingCompare && !compareError && compareDiffs.length > 0 && (
                            <div className="mt-3 grid gap-2 max-h-56 overflow-auto">
                                {compareDiffs.map((d: any, idx: number) => {
                                    const name = d.new_path || d.old_path || 'unknown';
                                    const type = d.new_file ? 'Added' : d.deleted_file ? 'Deleted' : d.renamed_file ? 'Renamed' : 'Modified';
                                    return (
                                        <div key={idx} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded">
                                            <div className="text-sm text-gray-800">{name}</div>
                                            <div className="text-xs text-gray-500">{type}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
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
