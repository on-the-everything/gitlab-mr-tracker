import React from 'react';
import { MRStatus, MergeRequest } from '../../types';
import { MRTable } from '../MRTable/MRTable';

interface MergedUATPageProps {
    mrList: MergeRequest[];
    onMarkAsRead: (id: string) => void;
    onMarkAsUnread: (id: string) => void;
    hasNewComments: (mr: MergeRequest) => boolean;
    isRead: (id: string) => boolean;
    onBack: () => void;
}

const isWaitingUATLabel = (label: string) => {
    return /\b(uat)\b/i.test(label) || /waiting.*uat/i.test(label) || /wait.*uat/i.test(label);
};

export function MergedUATPage({ mrList, onMarkAsRead, onMarkAsUnread, hasNewComments, isRead, onBack }: MergedUATPageProps) {
    // Filter for merged MRs that are waiting for UAT (labels containing uat/waiting uat)
    const mergedWaiting = mrList.filter((mr) => {
        if (mr.status !== MRStatus.MERGED) return false;
        if (!mr.labels || mr.labels.length === 0) return false;
        return mr.labels.some((l) => isWaitingUATLabel(l));
    });

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Merged — Waiting UAT</h1>
                        <div className="text-sm text-gray-500">Showing merge requests merged and labelled for UAT.</div>
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
                        <p className="text-lg">No merged MRs waiting for UAT were found.</p>
                        <p className="text-sm mt-2">Make sure MRs have a label like "waiting UAT" or "UAT".</p>
                    </div>
                ) : (
                    <MRTable
                        title={`Merged — Waiting UAT (${mergedWaiting.length})`}
                        mrList={mergedWaiting}
                        onMarkAsRead={onMarkAsRead}
                        onMarkAsUnread={onMarkAsUnread}
                        hasNewComments={(mr) => hasNewComments(mr)}
                        isRead={(id) => isRead(id)}
                    />
                )}
            </div>
        </div>
    );
}

export default MergedUATPage;
