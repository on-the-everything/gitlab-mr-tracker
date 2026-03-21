import React, { useEffect, useMemo, useState } from 'react';
import { MergeRequest } from '../../types';
import { splitRepositoryPath } from '../../utils/repositoryFormatter';

interface ExportDialogProps {
    visible: boolean;
    onClose: () => void;
    mrList: MergeRequest[];
}

export function ExportDialog({ visible, onClose, mrList }: ExportDialogProps) {
    const groups = useMemo(() => {
        const map = new Map<string, { repoPath: string; mrs: MergeRequest[] }>();
        mrList.forEach((mr) => {
            const parts = splitRepositoryPath(mr.repository || '');
            const service = parts ? parts.projectName : (mr.repository || 'unknown');
            const key = service || 'unknown';
            if (!map.has(key)) map.set(key, { repoPath: mr.repository || '', mrs: [] });
            map.get(key)!.mrs.push(mr);
        });
        return map;
    }, [mrList]);

    const [texts, setTexts] = useState<Record<string, string>>({});

    useEffect(() => {
        const next: Record<string, string> = {};
        groups.forEach((value, key) => {
            const lines = value.mrs.map((mr) => `- ${mr.title} (!${mr.iid}) — ${mr.url}`);
            next[key] = `# ${key} — ${value.repoPath}\n\n${lines.join('\n')}`;
        });
        setTexts(next);
    }, [groups]);

    if (!visible) return null;

    const handleCopyAll = async () => {
        const all = Object.values(texts).join('\n\n');
        try {
            await navigator.clipboard.writeText(all);
        } catch (e) {
            console.warn('copy failed', e);
        }
    };

    const handleCopy = async (key: string) => {
        try {
            await navigator.clipboard.writeText(texts[key] || '');
        } catch (e) {
            console.warn('copy failed', e);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20">
            <div className="fixed inset-0 bg-black opacity-30" onClick={onClose} />
            <div className="relative max-w-3xl w-full bg-white rounded-lg shadow-lg overflow-auto max-h-[80vh] border border-gray-200">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">Export MRs</h2>
                    <div className="space-x-2">
                        <button onClick={handleCopyAll} className="px-3 py-1 bg-green-600 text-white rounded">Copy all</button>
                        <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">Close</button>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {Array.from(groups.entries()).map(([key, value]) => (
                        <div key={key} className="border rounded p-3 bg-gray-50">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="font-medium">{key}</div>
                                    <div className="text-sm text-gray-500">{value.repoPath}</div>
                                </div>
                                <div className="space-x-2">
                                    <button onClick={() => handleCopy(key)} className="px-2 py-1 bg-blue-600 text-white rounded text-sm">Copy</button>
                                </div>
                            </div>
                            <textarea
                                aria-label={`export-${key}`}
                                value={texts[key] || ''}
                                onChange={(e) => setTexts((s) => ({ ...s, [key]: e.target.value }))}
                                className="mt-3 w-full min-h-[120px] p-2 rounded border resize-vertical font-mono text-sm"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default ExportDialog;
