import { useCallback, useEffect, useState } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { fetchRepositoryCompare } from '../../services/gitlabApi';

interface DiffFile {
    new_path: string;
    old_path: string;
    new_file: boolean;
    deleted_file: boolean;
    renamed_file: boolean;
}

interface RepoStatus {
    path: string;
    loading: boolean;
    error: string | null;
    diffs: DiffFile[];
    expanded: boolean;
}

function buildOpenMRUrl(gitlabHost: string, repoPath: string): string {
    const cleanHost = gitlabHost.replace(/\/$/, '');
    const encodedRepo = repoPath
        .split('/')
        .map((seg) => encodeURIComponent(seg))
        .join('/');
    return `${cleanHost}/${encodedRepo}/-/merge_requests/new?merge_request%5Bsource_branch%5D=master&merge_request%5Btarget_branch%5D=develop`;
}

function getUniqueRepositories(repositoryGroups: { name: string; repositories: string[] }[]): string[] {
    return Array.from(
        new Set(
            repositoryGroups
                .flatMap((g) => g.repositories)
                .map((r) => r.trim())
                .filter(Boolean),
        ),
    ).sort();
}

function DiffTypeBadge({ file }: { file: DiffFile }) {
    if (file.new_file) return <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">Added</span>;
    if (file.deleted_file) return <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700">Deleted</span>;
    if (file.renamed_file) return <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Renamed</span>;
    return <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Modified</span>;
}

function RepoCard({
    repo,
    gitlabHost,
    onToggle,
}: {
    repo: RepoStatus;
    gitlabHost: string;
    onToggle: (path: string) => void;
}) {
    const hasDrift = !repo.loading && !repo.error && repo.diffs.length > 0;
    const inSync = !repo.loading && !repo.error && repo.diffs.length === 0;
    const openMRUrl = buildOpenMRUrl(gitlabHost, repo.path);

    let borderColor = 'border-gray-200';
    let bgColor = 'bg-white';
    if (hasDrift) { borderColor = 'border-amber-300'; bgColor = 'bg-amber-50'; }
    if (inSync) { borderColor = 'border-green-200'; bgColor = 'bg-green-50'; }
    if (repo.error) { borderColor = 'border-red-200'; bgColor = 'bg-red-50'; }

    return (
        <div className={`rounded-xl border ${borderColor} ${bgColor} shadow-sm transition-all duration-200`}>
            <div className="flex items-center justify-between gap-4 px-5 py-4">
                {/* Status icon + repo name */}
                <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl flex-shrink-0" aria-hidden="true">
                        {repo.loading && '⏳'}
                        {hasDrift && '⚠️'}
                        {inSync && '✅'}
                        {repo.error && '❌'}
                    </span>
                    <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate" title={repo.path}>
                            {repo.path}
                        </p>
                        <p className="text-sm mt-0.5">
                            {repo.loading && <span className="text-gray-500">Checking…</span>}
                            {inSync && <span className="text-green-700 font-medium">In sync — master has no extra commits over develop</span>}
                            {hasDrift && (
                                <span className="text-amber-800 font-medium">
                                    {repo.diffs.length} file{repo.diffs.length !== 1 ? 's' : ''} in master not yet in develop
                                </span>
                            )}
                            {repo.error && <span className="text-red-700">{repo.error}</span>}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {hasDrift && (
                        <>
                            <button
                                type="button"
                                onClick={() => onToggle(repo.path)}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 transition-colors"
                                title={repo.expanded ? 'Collapse diff' : 'Show changed files'}
                            >
                                {repo.expanded ? '▲ Hide files' : '▼ Show files'}
                            </button>
                            <a
                                href={openMRUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                id={`open-mr-${repo.path.replace(/\//g, '-')}`}
                                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 active:scale-95 transition-all duration-150"
                                title="Open a new GitLab MR: master → develop"
                            >
                                <span aria-hidden="true">🔀</span>
                                Open MR
                            </a>
                        </>
                    )}
                </div>
            </div>

            {/* Expanded diff list */}
            {hasDrift && repo.expanded && (
                <div className="border-t border-amber-200 px-5 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">
                        Changed files (master → develop)
                    </p>
                    <div className="grid gap-1 max-h-60 overflow-y-auto pr-1">
                        {repo.diffs.map((d, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-amber-100 hover:border-amber-200 transition-colors"
                            >
                                <span className="text-sm text-gray-800 font-mono truncate mr-3" title={d.new_path || d.old_path}>
                                    {d.new_path || d.old_path}
                                </span>
                                <DiffTypeBadge file={d} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export function MonitorMasterPage() {
    const { config } = useConfig();
    const repos = getUniqueRepositories(config.repositoryGroups);

    const [statuses, setStatuses] = useState<RepoStatus[]>(() =>
        repos.map((path) => ({ path, loading: true, error: null, diffs: [], expanded: false })),
    );
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    const fetchAll = useCallback(
        async (repoPaths: string[]) => {
            // Reset to loading
            setStatuses(repoPaths.map((path) => ({ path, loading: true, error: null, diffs: [], expanded: false })));

            const results = await Promise.allSettled(
                repoPaths.map((path) => fetchRepositoryCompare(config, path, 'develop', 'master')),
            );

            setStatuses(
                repoPaths.map((path, i) => {
                    const result = results[i];
                    if (result.status === 'fulfilled') {
                        return { path, loading: false, error: null, diffs: result.value as DiffFile[], expanded: false };
                    }
                    const err = result.reason as Error;
                    return { path, loading: false, error: err?.message || 'Unknown error', diffs: [], expanded: false };
                }),
            );
            setLastRefreshed(new Date());
        },
        [config],
    );

    // Initial fetch
    useEffect(() => {
        if (repos.length > 0) {
            fetchAll(repos);
        } else {
            setStatuses([]);
            setLastRefreshed(new Date());
        }
    }, [config.repositoryGroups]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleToggle = (path: string) => {
        setStatuses((prev) =>
            prev.map((s) => (s.path === path ? { ...s, expanded: !s.expanded } : s)),
        );
    };

    const driftCount = statuses.filter((s) => !s.loading && !s.error && s.diffs.length > 0).length;
    const loadingCount = statuses.filter((s) => s.loading).length;
    const inSyncCount = statuses.filter((s) => !s.loading && !s.error && s.diffs.length === 0).length;
    const errorCount = statuses.filter((s) => s.error).length;

    return (
        <div>
            {/* Page header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-900">Monitor Master</h1>
                        {driftCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-0.5 text-sm font-semibold text-amber-800 border border-amber-300">
                                ⚠️ {driftCount} repo{driftCount !== 1 ? 's' : ''} drifted
                            </span>
                        )}
                        {driftCount === 0 && loadingCount === 0 && repos.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-0.5 text-sm font-semibold text-green-800 border border-green-300">
                                ✅ All in sync
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                        Checks if <strong>master</strong> has commits that haven't been merged back into <strong>develop</strong>.
                        {lastRefreshed && (
                            <span className="ml-2 text-gray-400">
                                Last checked: {lastRefreshed.toLocaleTimeString()}
                            </span>
                        )}
                    </p>
                </div>

                {/* Summary badges + Refresh */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    {repos.length > 0 && (
                        <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
                            {loadingCount > 0 && <span>⏳ {loadingCount} checking</span>}
                            {inSyncCount > 0 && <span className="text-green-700">✅ {inSyncCount} ok</span>}
                            {driftCount > 0 && <span className="text-amber-700">⚠️ {driftCount} drifted</span>}
                            {errorCount > 0 && <span className="text-red-600">❌ {errorCount} error</span>}
                        </div>
                    )}
                    <button
                        id="monitor-master-refresh"
                        type="button"
                        onClick={() => fetchAll(repos)}
                        disabled={loadingCount > 0 || repos.length === 0}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <span aria-hidden="true">{loadingCount > 0 ? '⏳' : '🔄'}</span>
                        {loadingCount > 0 ? 'Checking…' : 'Refresh All'}
                    </button>
                </div>
            </div>

            {/* Empty state — no repositories configured */}
            {repos.length === 0 && (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-4xl mb-4">📦</p>
                    <p className="text-lg font-semibold text-gray-700">No repositories configured</p>
                    <p className="text-sm text-gray-500 mt-1">
                        Add repositories under <strong>Repository Groups</strong> in the Config settings to start monitoring.
                    </p>
                </div>
            )}

            {/* Drift warning banner (global) */}
            {driftCount > 0 && loadingCount === 0 && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
                    <span className="text-xl flex-shrink-0" aria-hidden="true">⚠️</span>
                    <div>
                        <p className="font-semibold text-amber-900">
                            {driftCount} repositor{driftCount !== 1 ? 'ies have' : 'y has'} commits in <code className="font-mono bg-amber-100 px-1 rounded">master</code> that are not yet in <code className="font-mono bg-amber-100 px-1 rounded">develop</code>.
                        </p>
                        <p className="text-sm text-amber-800 mt-0.5">
                            Use the <strong>Open MR</strong> button on each repository to create a merge request from master → develop.
                        </p>
                    </div>
                </div>
            )}

            {/* Repo cards */}
            {statuses.length > 0 && (
                <div className="grid gap-3">
                    {/* Drifted repos first */}
                    {statuses
                        .slice()
                        .sort((a, b) => {
                            // Sort: drifted > loading > error > in-sync
                            const rank = (s: RepoStatus) => {
                                if (s.diffs.length > 0) return 0;
                                if (s.loading) return 1;
                                if (s.error) return 2;
                                return 3;
                            };
                            return rank(a) - rank(b);
                        })
                        .map((repo) => (
                            <RepoCard
                                key={repo.path}
                                repo={repo}
                                gitlabHost={config.gitlabHost}
                                onToggle={handleToggle}
                            />
                        ))}
                </div>
            )}
        </div>
    );
}

export default MonitorMasterPage;
