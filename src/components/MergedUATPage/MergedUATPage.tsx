import { MRStatus, MergeRequest } from '../../types';
import { MRTable } from '../MRTable/MRTable';

interface MergedUATPageProps {
    mrList: MergeRequest[];
    onMarkAsRead: (id: string) => void;
    onMarkAsUnread: (id: string) => void;
    hasNewComments: (mr: MergeRequest) => boolean;
    isRead: (id: string) => boolean;
    onBack: () => void;
    labelFilters?: string[];
    onLabelClick?: (label: string) => void;
}

const isWaitingUATLabel = (label: string) => {
    return /\b(uat)\b/i.test(label) || /waiting.*uat/i.test(label) || /wait.*uat/i.test(label);
};

export function MergedUATPage({ mrList, onMarkAsRead, onMarkAsUnread, hasNewComments, isRead, onBack, labelFilters, onLabelClick }: MergedUATPageProps) {
    // Default: show all merged MRs. If `labelFilters` are provided, apply them.
    let mergedWaiting = mrList.filter((mr) => mr.status === MRStatus.MERGED);

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
                    <div>
                        <button
                            onClick={onBack}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            ← Back
                        </button>
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
