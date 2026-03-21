import { MRStatus, MergeRequest } from '../../types';
import { MRTable } from '../MRTable/MRTable';
import { useConfig } from '../../hooks/useConfig';
import { useState } from 'react';
import ExportDialog from '../ExportDialog/ExportDialog';

interface MergedUATPageProps {
    mrList: MergeRequest[];
    onMarkAsRead: (id: string) => void;
    onMarkAsUnread: (id: string) => void;
    hasNewComments: (mr: MergeRequest) => boolean;
    isRead: (id: string) => boolean;
    onBack: () => void;
    labelFilters?: string[];
    onLabelClick?: (label: string) => void;
    selectedRepository?: string;
}

const isWaitingUATLabel = (label: string) => {
    return /\b(uat)\b/i.test(label) || /waiting.*uat/i.test(label) || /wait.*uat/i.test(label);
};

export function MergedUATPage({ mrList, onMarkAsRead, onMarkAsUnread, hasNewComments, isRead, onBack, labelFilters, onLabelClick, selectedRepository }: MergedUATPageProps) {
    const { config } = useConfig();
    const [exportVisible, setExportVisible] = useState(false);
    // Default: show all merged MRs. If `labelFilters` are provided, apply them.
    let mergedWaiting = mrList.filter((mr) => mr.status === MRStatus.MERGED);

    // Repository filter
    if (selectedRepository) {
        mergedWaiting = mergedWaiting.filter((mr) => mr.repository === selectedRepository);
    }

    // If label filters are provided, further filter the list using local data (OR semantics)
    if (labelFilters && labelFilters.length > 0) {
        const needles = labelFilters.map((f) => f.trim().toLowerCase()).filter(Boolean);
        if (needles.length > 0) {
            mergedWaiting = mergedWaiting.filter((mr) => {
                if (!mr.labels || mr.labels.length === 0) return false;
                return mr.labels.some((l) => needles.some((n) => l.toLowerCase().includes(n)));
            });
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Merged — Waiting UAT</h1>
                        <div className="text-sm text-gray-500">Showing merged merge requests.</div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={onBack}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            ← Back
                        </button>

                        <button
                            onClick={() => setExportVisible(true)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            Export
                        </button>

                        {/* Compare develop -> master on GitLab for the selected repository */}
                        {(() => {
                            // Only enable compare when a repository is explicitly selected
                            const repoPathRaw = (selectedRepository && selectedRepository !== 'select') ? selectedRepository : '';
                            const repoPath = repoPathRaw.replace(/^\/+|\/+$/g, '');
                            const encodedRepoPath = repoPath
                                ? repoPath.split('/').map((seg) => encodeURIComponent(seg)).join('/')
                                : '';
                            const compareUrl = repoPath ? `${config.gitlabHost.replace(/\/$/, '')}/${encodedRepoPath}/-/compare/master...develop` : '';
                            return (
                                <button
                                    onClick={() => compareUrl && window.open(compareUrl, '_blank', 'noopener')}
                                    disabled={!compareUrl}
                                    title={compareUrl ? 'Open GitLab compare: develop → master' : 'No repository selected'}
                                    className={`px-4 py-2 rounded-lg transition-colors ${compareUrl ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                                >
                                    Compare develop → master
                                </button>
                            );
                        })()}
                        <ExportDialog visible={exportVisible} onClose={() => setExportVisible(false)} mrList={mergedWaiting} />
                    </div>
                </div>

                {mergedWaiting.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow-sm border border-gray-200">
                        <p className="text-lg">No merged MRs were found.</p>
                    </div>
                ) : (
                    <MRTable
                        title={`Merged — Waiting UAT (${mergedWaiting.length})`}
                        mrList={mergedWaiting}
                        onMarkAsRead={onMarkAsRead}
                        onMarkAsUnread={onMarkAsUnread}
                        hasNewComments={(mr) => hasNewComments(mr)}
                        isRead={(id) => isRead(id)}
                        onLabelClick={onLabelClick}
                    />
                )}
            </div>
        </div>
    );
}

export default MergedUATPage;
