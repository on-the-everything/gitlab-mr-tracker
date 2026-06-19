import { useEffect, useMemo, useState } from 'react';
import { MRTable } from '../../components/MRTable/MRTable';
import { useConfig } from '../../hooks/useConfig';
import { fetchRepositoryCompare } from '../../services/gitlabApi';
import { MergeRequest, MRStatus, type RepositoryGroup } from '../../types';
import { extractJiraTickets } from '../../utils/jira';
import { filterMRsByRepositoryGroups } from '../../utils/repositoryGroups';

interface ReleaseChecklistPageProps {
  mrList: MergeRequest[];
  onMarkAsRead: (id: string) => void;
  onMarkAsUnread: (id: string) => void;
  hasNewComments: (mr: MergeRequest) => boolean;
  isRead: (id: string) => boolean;
  labelFilters?: string[];
  onLabelClick?: (label: string) => void;
  selectedRepository?: string;
  repositoryGroups?: RepositoryGroup[];
  selectedRepositoryGroups?: string[];
}

type ReadinessLevel = 'ready' | 'attention' | 'blocked';

function countByStatus(mrs: MergeRequest[]) {
  return {
    total: mrs.length,
    merged: mrs.filter((mr) => mr.status === MRStatus.MERGED).length,
    approved: mrs.filter((mr) => mr.status === MRStatus.APPROVED).length,
    commented: mrs.filter((mr) => mr.status === MRStatus.COMMENTED).length,
    new: mrs.filter((mr) => mr.status === MRStatus.NEW).length,
    rejected: mrs.filter((mr) => mr.status === MRStatus.REJECTED).length,
  };
}

function getJiraTickets(mr: MergeRequest) {
  return extractJiraTickets(mr.sourceBranch, mr.title, mr.description);
}

function getReadinessLevel(
  total: number,
  blockers: number,
  attentionItems: number,
): ReadinessLevel {
  if (total === 0 || blockers > 0) return 'blocked';
  if (attentionItems > 0) return 'attention';
  return 'ready';
}

const readinessStyles: Record<ReadinessLevel, string> = {
  ready: 'bg-green-50 text-green-800 border-green-200',
  attention: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  blocked: 'bg-red-50 text-red-800 border-red-200',
};

const readinessLabels: Record<ReadinessLevel, string> = {
  ready: 'Ready for deploy',
  attention: 'Needs review',
  blocked: 'Blocked',
};

export function ReleaseChecklistPage({
  mrList,
  onMarkAsRead,
  onMarkAsUnread,
  hasNewComments,
  isRead,
  labelFilters,
  onLabelClick,
  selectedRepository,
  repositoryGroups,
  selectedRepositoryGroups,
}: ReleaseChecklistPageProps) {
  const { config } = useConfig();
  const [compareDiffs, setCompareDiffs] = useState<any[]>([]);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const scopedMRs = useMemo(() => {
    let next = [...mrList];

    if (labelFilters && labelFilters.length > 0) {
      const needles = labelFilters.map((label) => label.trim().toLowerCase()).filter(Boolean);
      if (needles.length > 0) {
        next = next.filter((mr) =>
          mr.labels?.some((label) =>
            needles.some((needle) => label.toLowerCase().includes(needle)),
          ),
        );
      }
    }

    if (selectedRepository) {
      next = next.filter((mr) => mr.repository === selectedRepository);
    }

    return filterMRsByRepositoryGroups(
      next,
      repositoryGroups ?? [],
      selectedRepositoryGroups ?? [],
    );
  }, [mrList, labelFilters, selectedRepository, repositoryGroups, selectedRepositoryGroups]);

  const summary = useMemo(() => countByStatus(scopedMRs), [scopedMRs]);

  const notMergedMRs = useMemo(
    () =>
      scopedMRs.filter(
        (mr) => mr.status !== MRStatus.MERGED && mr.status !== MRStatus.REJECTED,
      ),
    [scopedMRs],
  );

  const rejectedMRs = useMemo(
    () => scopedMRs.filter((mr) => mr.status === MRStatus.REJECTED),
    [scopedMRs],
  );

  const missingJiraMRs = useMemo(
    () => scopedMRs.filter((mr) => getJiraTickets(mr).length === 0),
    [scopedMRs],
  );

  const mergedMRs = useMemo(
    () => scopedMRs.filter((mr) => mr.status === MRStatus.MERGED),
    [scopedMRs],
  );

  const readinessLevel = getReadinessLevel(
    summary.total,
    rejectedMRs.length + notMergedMRs.length,
    missingJiraMRs.length,
  );

  useEffect(() => {
    let mounted = true;

    const loadCompare = async () => {
      if (!selectedRepository) {
        setCompareDiffs([]);
        setCompareError(null);
        setLoadingCompare(false);
        return;
      }

      setLoadingCompare(true);
      setCompareError(null);

      try {
        const diffs = await fetchRepositoryCompare(config, selectedRepository, 'master', 'develop');
        if (!mounted) return;
        setCompareDiffs(diffs || []);
      } catch (err) {
        if (!mounted) return;
        setCompareError(err instanceof Error ? err.message : 'Failed to fetch compare diffs');
        setCompareDiffs([]);
      } finally {
        if (mounted) setLoadingCompare(false);
      }
    };

    loadCompare();

    return () => {
      mounted = false;
    };
  }, [config, selectedRepository]);

  const scopeLabel =
    labelFilters && labelFilters.length > 0
      ? labelFilters.join(', ')
      : 'No sprint or release label selected';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Release Checklist</h1>
            <div className="text-sm text-gray-500">
              Scope: <span className="font-medium text-gray-700">{scopeLabel}</span>
            </div>
          </div>
          <div className={`inline-flex w-fit items-center rounded border px-3 py-2 text-sm font-semibold ${readinessStyles[readinessLevel]}`}>
            {readinessLabels[readinessLevel]}
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <SummaryTile label="Total" value={summary.total} />
          <SummaryTile label="Merged" value={summary.merged} tone="green" />
          <SummaryTile label="Not merged" value={notMergedMRs.length} tone={notMergedMRs.length > 0 ? 'yellow' : 'gray'} />
          <SummaryTile label="Rejected" value={summary.rejected} tone={summary.rejected > 0 ? 'red' : 'gray'} />
          <SummaryTile label="Missing Jira" value={missingJiraMRs.length} tone={missingJiraMRs.length > 0 ? 'yellow' : 'gray'} />
          <SummaryTile label="Branch diffs" value={selectedRepository ? compareDiffs.length : '-'} />
        </div>

        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Pre-deploy Checks</h2>
              <div className="text-sm text-gray-500">
                Uses current filters and compares <strong>master</strong> to <strong>develop</strong> when one repository is selected.
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Repository: {selectedRepository || 'All repositories'}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <CheckRow
              passed={summary.total > 0}
              title="Sprint scope has MRs"
              detail={summary.total > 0 ? `${summary.total} MRs in scope` : 'Add a sprint/release label filter or adjust repository filters'}
            />
            <CheckRow
              passed={notMergedMRs.length === 0}
              title="All scoped MRs are merged"
              detail={notMergedMRs.length === 0 ? 'No open MRs in scope' : `${notMergedMRs.length} MRs still need merge`}
            />
            <CheckRow
              passed={rejectedMRs.length === 0}
              title="No rejected MRs in scope"
              detail={rejectedMRs.length === 0 ? 'No rejected MRs found' : `${rejectedMRs.length} rejected MRs need review`}
            />
            <CheckRow
              passed={missingJiraMRs.length === 0}
              title="Every MR has a Jira ticket"
              detail={missingJiraMRs.length === 0 ? 'Jira keys found for all MRs' : `${missingJiraMRs.length} MRs missing Jira keys`}
            />
          </div>

          {selectedRepository && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Branch diff: master {'->'} develop</h3>
                {loadingCompare && <span className="text-sm text-gray-500">Loading changes...</span>}
              </div>
              {compareError && <div className="mt-2 text-sm text-red-600">{compareError}</div>}
              {!loadingCompare && !compareError && compareDiffs.length === 0 && (
                <div className="mt-2 text-sm text-gray-500">No file changes found between branches.</div>
              )}
              {!loadingCompare && !compareError && compareDiffs.length > 0 && (
                <div className="mt-3 max-h-48 overflow-auto rounded border border-gray-200">
                  {compareDiffs.slice(0, 30).map((diff: any, index) => {
                    const fileName = diff.new_path || diff.old_path || 'unknown';
                    const changeType = diff.new_file
                      ? 'Added'
                      : diff.deleted_file
                        ? 'Deleted'
                        : diff.renamed_file
                          ? 'Renamed'
                          : 'Modified';

                    return (
                      <div key={`${fileName}-${index}`} className="flex items-center justify-between border-b border-gray-100 px-3 py-2 last:border-b-0">
                        <span className="text-sm text-gray-800">{fileName}</span>
                        <span className="text-xs text-gray-500">{changeType}</span>
                      </div>
                    );
                  })}
                  {compareDiffs.length > 30 && (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      {compareDiffs.length - 30} more files not shown
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <MRTable
          title={`Blockers: not merged (${notMergedMRs.length})`}
          mrList={notMergedMRs}
          onMarkAsRead={onMarkAsRead}
          onMarkAsUnread={onMarkAsUnread}
          hasNewComments={hasNewComments}
          isRead={isRead}
          onLabelClick={onLabelClick}
        />

        <MRTable
          title={`Blockers: rejected (${rejectedMRs.length})`}
          mrList={rejectedMRs}
          onMarkAsRead={onMarkAsRead}
          onMarkAsUnread={onMarkAsUnread}
          hasNewComments={hasNewComments}
          isRead={isRead}
          onLabelClick={onLabelClick}
        />

        <MRTable
          title={`Needs Jira key (${missingJiraMRs.length})`}
          mrList={missingJiraMRs}
          onMarkAsRead={onMarkAsRead}
          onMarkAsUnread={onMarkAsUnread}
          hasNewComments={hasNewComments}
          isRead={isRead}
          onLabelClick={onLabelClick}
        />

        <MRTable
          title={`Merged and ready for UAT/PROD review (${mergedMRs.length})`}
          mrList={mergedMRs}
          onMarkAsRead={onMarkAsRead}
          onMarkAsUnread={onMarkAsUnread}
          hasNewComments={hasNewComments}
          isRead={isRead}
          onLabelClick={onLabelClick}
        />

        {scopedMRs.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow-sm border border-gray-200">
            <p className="text-lg">No merge requests in the release checklist scope.</p>
            <p className="text-sm mt-2">Use a sprint/release label filter or adjust repository filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface SummaryTileProps {
  label: string;
  value: number | string;
  tone?: 'gray' | 'green' | 'yellow' | 'red';
}

function SummaryTile({ label, value, tone = 'gray' }: SummaryTileProps) {
  const toneClass = {
    gray: 'border-gray-200 text-gray-900',
    green: 'border-green-200 text-green-800',
    yellow: 'border-yellow-200 text-yellow-800',
    red: 'border-red-200 text-red-800',
  }[tone];

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 ${toneClass}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

interface CheckRowProps {
  passed: boolean;
  title: string;
  detail: string;
}

function CheckRow({ passed, title, detail }: CheckRowProps) {
  return (
    <div className="flex gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-3">
      <div className={`mt-0.5 h-5 w-5 rounded-full text-center text-xs font-bold leading-5 ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {passed ? '✓' : '!'}
      </div>
      <div>
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-sm text-gray-500">{detail}</div>
      </div>
    </div>
  );
}

export default ReleaseChecklistPage;
