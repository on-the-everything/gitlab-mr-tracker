import { useEffect, useMemo, useState } from 'react';
import { MRTable } from '../../components/MRTable/MRTable';
import { fetchRepositoryCompare } from '../../services/gitlabApi';
import { fetchJiraIssuesByVersion, fetchJiraProjectVersions } from '../../services/jiraApi';
import { storage } from '../../services/storage';
import { AppConfig, JiraIssue, JiraVersion, MergeRequest, MRStatus, type RepositoryGroup } from '../../types';
import { buildJiraTicketUrl, extractJiraTickets } from '../../utils/jira';
import { filterMRsByRepositoryGroups } from '../../utils/repositoryGroups';
import { splitRepositoryPath } from '../../utils/repositoryFormatter';

interface ReleaseChecklistPageProps {
  config: AppConfig;
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
  teamScopeFilters?: Record<'myTeam' | 'partnerTeam', boolean>;
}

type ReadinessLevel = 'ready' | 'attention' | 'blocked';

interface ReleaseExportGroup {
  repository: string;
  displayName: string;
  items: ReleaseExportItem[];
}

interface ReleaseExportItem {
  jiraTickets: string[];
  featureName: string;
  mr: MergeRequest;
}

interface CardDeployScope {
  scopeName: string;
  cards: string[];
  relatedMRs: MergeRequest[];
  groups: ReleaseExportGroup[];
  unmatchedCards: string[];
}

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

function getShortFeatureName(mr: MergeRequest) {
  const jiraPattern = /[A-Z][A-Z0-9]+-\d+/gi;
  const mergePrefixPattern = /^(draft:\s*)?(\[.*?\]\s*)?(feat|fix|chore|refactor|hotfix|release|merge|revert)(\(.+?\))?:\s*/i;
  const branchFallback = mr.sourceBranch
    ?.replace(jiraPattern, '')
    .replace(/[-_/]+/g, ' ')
    .trim();

  const cleaned = mr.title
    .replace(jiraPattern, '')
    .replace(mergePrefixPattern, '')
    .replace(/\s*[-:|]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  const featureName = cleaned || branchFallback || `MR !${mr.iid}`;

  return featureName.length > 90 ? `${featureName.slice(0, 87).trim()}...` : featureName;
}

function normalizeUsername(username: string): string {
  return username.startsWith('@')
    ? username.slice(1).toLowerCase()
    : username.toLowerCase();
}

function buildReleaseExportGroups(mrs: MergeRequest[]): ReleaseExportGroup[] {
  const groups = new Map<string, { displayName: string; items: ReleaseExportItem[]; repository: string }>();

  mrs.forEach((mr) => {
    const repository = mr.repository || 'unknown';
    const repositoryParts = splitRepositoryPath(repository);
    const displayName = repositoryParts?.projectName || repository;
    const item = {
      jiraTickets: getJiraTickets(mr),
      featureName: getShortFeatureName(mr),
      mr,
    };

    if (!groups.has(repository)) {
      groups.set(repository, { displayName, items: [], repository });
    }

    groups.get(repository)!.items.push(item);
  });

  return Array.from(groups.values())
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((group) => {
      const items = [...group.items].sort((a, b) => {
        const aTicket = a.jiraTickets[0] || 'No Jira';
        const bTicket = b.jiraTickets[0] || 'No Jira';
        return `${aTicket} ${a.featureName}`.localeCompare(`${bTicket} ${b.featureName}`);
      });
      return {
        ...group,
        items,
      };
    });
}

function buildCardDeployScope(
  scopeName: string,
  cards: string[],
  mrs: MergeRequest[],
): CardDeployScope {
  const cardSet = new Set(cards);
  const relatedMRs = mrs.filter((mr) =>
    getJiraTickets(mr).some((ticket) => cardSet.has(ticket)),
  );
  const matchedCards = new Set<string>();

  relatedMRs.forEach((mr) => {
    getJiraTickets(mr).forEach((ticket) => {
      if (cardSet.has(ticket)) matchedCards.add(ticket);
    });
  });

  return {
    scopeName,
    cards,
    relatedMRs,
    groups: buildReleaseExportGroups(relatedMRs),
    unmatchedCards: cards.filter((card) => !matchedCards.has(card)),
  };
}

function formatTicketList(
  tickets: string[],
  options: { jiraHost?: string; useFullJiraUrl: boolean },
) {
  if (tickets.length === 0) return 'No Jira';

  return tickets
    .map((ticket) => {
      if (!options.useFullJiraUrl) return ticket;
      return buildJiraTicketUrl(ticket, options.jiraHost) || ticket;
    })
    .join(', ');
}

function formatMRLine(
  mr: MergeRequest,
  options: { jiraHost?: string; useFullJiraUrl: boolean },
) {
  const tickets = getJiraTickets(mr).filter((ticket, index, all) => all.indexOf(ticket) === index);
  const ticketText = formatTicketList(tickets, options);
  return `- ${ticketText}: ${mr.repository} !${mr.iid} [${mr.status}] ${getShortFeatureName(mr)} (${mr.url})`;
}

function getDeployScopeLine(group: ReleaseExportGroup) {
  const total = group.items.length;
  const statusCounts = countByStatus(group.items.map((item) => item.mr));
  const openCount = statusCounts.total - statusCounts.merged;

  if (openCount > 0) {
    return `${total} MRs, ${openCount} not merged yet`;
  }

  return `${total} merged MR${total === 1 ? '' : 's'}, ready to deploy`;
}

function formatCardDeployReport(
  scope: CardDeployScope,
  options: { jiraHost?: string; useFullJiraUrl: boolean },
) {
  const cardLines =
    scope.cards.length > 0
      ? scope.cards.map((card) => {
          const cardText = options.useFullJiraUrl
            ? buildJiraTicketUrl(card, options.jiraHost) || card
            : card;
          return `- ${cardText}`;
        })
      : ['- No cards provided'];

  const relatedMRLines =
    scope.relatedMRs.length > 0
      ? scope.relatedMRs.map((mr) => formatMRLine(mr, options))
      : ['- No related MRs found in the current Release Checklist scope'];

  const groupedMRLines =
    scope.groups.length > 0
      ? scope.groups.flatMap((group) => [
          `# ${group.displayName}`,
          ...group.items.map((item) => {
            const ticketText = formatTicketList(item.jiraTickets, options);
            return `- ${ticketText}: !${item.mr.iid} [${item.mr.status}] ${item.featureName}`;
          }),
          '',
        ])
      : ['- No deploy service groups found', ''];

  const deployScopeLines =
    scope.groups.length > 0
      ? scope.groups.flatMap((group) => {
          const cards = Array.from(
            new Set(group.items.flatMap((item) => item.jiraTickets)),
          ).filter((ticket) => scope.cards.includes(ticket));

          return [
            `# ${group.displayName}`,
            `- Service: ${group.repository}`,
            `- Cards: ${formatTicketList(cards, options)}`,
            `- Scope: ${getDeployScopeLine(group)}`,
            '',
          ];
        })
      : ['- No deploy scope available', ''];

  const unmatchedLines =
    scope.unmatchedCards.length > 0
      ? [
          '',
          'Unmatched Cards',
          ...scope.unmatchedCards.map((card) => `- ${card}`),
        ]
      : [];

  return [
    `1. Cards that will be shown in ${scope.scopeName}`,
    ...cardLines,
    ...unmatchedLines,
    '',
    '2. All related MRs',
    ...relatedMRLines,
    '',
    '3. MRs grouped by deploy Service',
    ...groupedMRLines,
    '4. Clear deploy scope for each Service',
    ...deployScopeLines,
  ].join('\n');
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
  config,
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
  teamScopeFilters,
}: ReleaseChecklistPageProps) {
  const [compareDiffs, setCompareDiffs] = useState<any[]>([]);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [exportVisible, setExportVisible] = useState(false);
  const [selectedJiraVersion, setSelectedJiraVersion] = useState(() =>
    storage.getSelectedJiraVersion(config.jiraProjectKey || ''),
  );
  const [jiraVersions, setJiraVersions] = useState<JiraVersion[]>([]);
  const [jiraVersionSearchFocused, setJiraVersionSearchFocused] = useState(false);
  const [loadingJiraVersions, setLoadingJiraVersions] = useState(false);
  const [jiraVersionError, setJiraVersionError] = useState<string | null>(null);
  const [jiraIssues, setJiraIssues] = useState<JiraIssue[]>([]);
  const [loadingJiraIssues, setLoadingJiraIssues] = useState(false);
  const [jiraError, setJiraError] = useState<string | null>(null);

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

    if (teamScopeFilters) {
      const myTeamUsernames = new Set(config.myTeamAccounts.map(normalizeUsername));
      const partnerTeamUsernames = new Set(config.partnerTeamAccounts.map(normalizeUsername));

      next = next.filter((mr) => {
        const authorUsername = normalizeUsername(mr.author.username);

        if (!teamScopeFilters.myTeam && myTeamUsernames.has(authorUsername)) {
          return false;
        }

        if (!teamScopeFilters.partnerTeam && partnerTeamUsernames.has(authorUsername)) {
          return false;
        }

        return true;
      });
    }

    return filterMRsByRepositoryGroups(
      next,
      repositoryGroups ?? [],
      selectedRepositoryGroups ?? [],
    );
  }, [
    mrList,
    labelFilters,
    selectedRepository,
    teamScopeFilters,
    config.myTeamAccounts,
    config.partnerTeamAccounts,
    repositoryGroups,
    selectedRepositoryGroups,
  ]);

  const deployScopeMRs = useMemo(
    () => scopedMRs.filter((mr) => mr.status !== MRStatus.REJECTED),
    [scopedMRs],
  );

  const summary = useMemo(() => countByStatus(deployScopeMRs), [deployScopeMRs]);

  const notMergedMRs = useMemo(
    () =>
      deployScopeMRs.filter(
        (mr) => mr.status !== MRStatus.MERGED,
      ),
    [deployScopeMRs],
  );

  const missingJiraMRs = useMemo(
    () => deployScopeMRs.filter((mr) => getJiraTickets(mr).length === 0),
    [deployScopeMRs],
  );

  const mergedMRs = useMemo(
    () => deployScopeMRs.filter((mr) => mr.status === MRStatus.MERGED),
    [deployScopeMRs],
  );

  const selectedJiraScope = useMemo(
    () =>
      config.jiraVersionScopes.find(
        (scope) => scope.version === selectedJiraVersion || scope.name === selectedJiraVersion,
      ),
    [config.jiraVersionScopes, selectedJiraVersion],
  );

  const selectedComponentFilters = useMemo(
    () => selectedJiraScope?.components || [],
    [selectedJiraScope],
  );

  const hasMatchingJiraVersion = useMemo(
    () => jiraVersions.some((version) => version.name === selectedJiraVersion),
    [jiraVersions, selectedJiraVersion],
  );

  const filteredJiraVersions = useMemo(() => {
    const query = selectedJiraVersion.trim().toLowerCase();
    if (!query) return jiraVersions.slice(0, 20);

    return jiraVersions
      .filter((version) => version.name.toLowerCase().includes(query))
      .slice(0, 20);
  }, [jiraVersions, selectedJiraVersion]);

  const filteredJiraIssues = useMemo(() => {
    const components = selectedComponentFilters.map((component) => component.toLowerCase());
    if (components.length === 0) return jiraIssues;

    return jiraIssues.filter((issue) =>
      issue.components.some((component) => components.includes(component.toLowerCase())),
    );
  }, [jiraIssues, selectedComponentFilters]);

  const jiraCards = useMemo(
    () => filteredJiraIssues.map((issue) => issue.key),
    [filteredJiraIssues],
  );

  const cardDeployScope = useMemo(
    () => buildCardDeployScope(selectedJiraVersion || 'Jira Version', jiraCards, deployScopeMRs),
    [selectedJiraVersion, jiraCards, deployScopeMRs],
  );

  const readinessLevel = getReadinessLevel(
    summary.total,
    notMergedMRs.length,
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
  }, [config.gitlabHost, config.accessToken, selectedRepository]);

  useEffect(() => {
    setJiraIssues([]);
    setJiraError(null);
  }, [selectedJiraVersion]);

  useEffect(() => {
    setSelectedJiraVersion(storage.getSelectedJiraVersion(config.jiraProjectKey || ''));
    setJiraVersions([]);
    setJiraIssues([]);
    setJiraError(null);
    setJiraVersionError(null);
  }, [config.jiraProjectKey]);

  useEffect(() => {
    if (hasMatchingJiraVersion) {
      storage.saveSelectedJiraVersion(config.jiraProjectKey || '', selectedJiraVersion);
    }
  }, [config.jiraProjectKey, hasMatchingJiraVersion, selectedJiraVersion]);

  const handleFetchJiraVersions = async () => {
    setLoadingJiraVersions(true);
    setJiraVersionError(null);

    try {
      const versions = await fetchJiraProjectVersions(config);
      const savedVersion = storage.getSelectedJiraVersion(config.jiraProjectKey || '');
      setJiraVersions(versions);
      const preferredVersion =
        versions.find((version) => version.name === savedVersion) ||
        versions.find((version) => version.name === selectedJiraVersion) ||
        versions[0];
      if (preferredVersion) {
        setSelectedJiraVersion(preferredVersion.name);
      } else {
        setSelectedJiraVersion('');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch Jira versions';
      const projectHint =
        message.toLowerCase().includes('project') ||
        message.toLowerCase().includes('not found') ||
        message.includes('404');
      setJiraVersionError(
        projectHint
          ? `${message}. Check Jira project key "${config.jiraProjectKey || '-'}".`
          : message,
      );
    } finally {
      setLoadingJiraVersions(false);
    }
  };

  const handleFetchJiraCards = async () => {
    if (!selectedJiraVersion) return;

    setLoadingJiraIssues(true);
    setJiraError(null);

    try {
      const issues = await fetchJiraIssuesByVersion(config, selectedJiraVersion);
      setJiraIssues(issues);
    } catch (err) {
      setJiraError(err instanceof Error ? err.message : 'Failed to fetch Jira cards');
    } finally {
      setLoadingJiraIssues(false);
    }
  };

  const scopeLabel =
    labelFilters && labelFilters.length > 0
      ? labelFilters.join(', ')
      : 'No release label selected';

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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setExportVisible(true)}
              disabled={jiraCards.length === 0}
              className="inline-flex w-fit items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Export Result
            </button>
            <div className={`inline-flex w-fit items-center rounded border px-3 py-2 text-sm font-semibold ${readinessStyles[readinessLevel]}`}>
              {readinessLabels[readinessLevel]}
            </div>
          </div>
        </div>

        <ReleaseChecklistExportDialog
          visible={exportVisible}
          onClose={() => setExportVisible(false)}
          scope={cardDeployScope}
          jiraHost={config.jiraHost}
        />

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryTile label="Total" value={summary.total} />
          <SummaryTile label="Merged" value={summary.merged} tone="green" />
          <SummaryTile label="Not merged" value={notMergedMRs.length} tone={notMergedMRs.length > 0 ? 'yellow' : 'gray'} />
          <SummaryTile label="Missing Jira" value={missingJiraMRs.length} tone={missingJiraMRs.length > 0 ? 'yellow' : 'gray'} />
          <SummaryTile label="Branch diffs" value={selectedRepository ? compareDiffs.length : '-'} />
        </div>

        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Jira Card Scope</h2>
              <div className="text-sm text-gray-500">
                Fetches Jira cards by version and filters by configured components.
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-right text-sm">
              <div>
                <div className="font-semibold text-gray-900">{jiraCards.length}</div>
                <div className="text-gray-500">Cards</div>
              </div>
              <div>
                <div className="font-semibold text-gray-900">{cardDeployScope.relatedMRs.length}</div>
                <div className="text-gray-500">MRs</div>
              </div>
              <div>
                <div className="font-semibold text-gray-900">{cardDeployScope.groups.length}</div>
                <div className="text-gray-500">Services</div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="relative">
                <label htmlFor="release-jira-version-input" className="block text-sm font-medium text-gray-700">
                  Jira Version
                </label>
                <input
                  id="release-jira-version-input"
                  type="text"
                  value={selectedJiraVersion}
                  onChange={(event) => setSelectedJiraVersion(event.target.value)}
                  onFocus={() => setJiraVersionSearchFocused(true)}
                  onBlur={() => {
                    window.setTimeout(() => setJiraVersionSearchFocused(false), 150);
                  }}
                  disabled={jiraVersions.length === 0}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-56"
                  placeholder={jiraVersions.length === 0 ? 'Fetch versions first' : 'Type to search version'}
                />
                {jiraVersionSearchFocused && jiraVersions.length > 0 ? (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border border-gray-200 bg-white py-1 text-sm shadow-lg sm:w-56">
                    {filteredJiraVersions.length > 0 ? (
                      filteredJiraVersions.map((version) => (
                        <button
                          key={version.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setSelectedJiraVersion(version.name);
                            setJiraVersionSearchFocused(false);
                          }}
                          className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                        >
                          {version.name}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-gray-500">No matching versions</div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="text-sm text-gray-600">
                <div className="font-medium text-gray-800">Project</div>
                <div>{config.jiraProjectKey || '-'}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleFetchJiraVersions}
                disabled={
                  loadingJiraVersions ||
                  !config.jiraHost ||
                  !config.jiraProjectKey ||
                  !config.jiraEmail ||
                  !config.jiraAccessToken
                }
                className="inline-flex w-fit items-center rounded bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {loadingJiraVersions ? 'Fetching versions...' : 'Fetch Versions'}
              </button>
              <button
                type="button"
                onClick={handleFetchJiraCards}
                disabled={
                  loadingJiraIssues ||
                  jiraVersions.length === 0 ||
                  !selectedJiraVersion ||
                  !hasMatchingJiraVersion ||
                  !config.jiraHost ||
                  !config.jiraEmail ||
                  !config.jiraAccessToken
                }
                className="inline-flex w-fit items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {loadingJiraIssues ? 'Fetching cards...' : 'Fetch Jira Cards'}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
            <div className="text-sm font-semibold text-gray-900">Component filter</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedComponentFilters.length ? (
                selectedComponentFilters.map((component) => (
                  <span key={component} className="rounded bg-white px-2 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                    {component}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-500">All components</span>
              )}
            </div>
          </div>

          {jiraVersionError && (
            <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {jiraVersionError}
            </div>
          )}

          {jiraError && (
            <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {jiraError}
            </div>
          )}

          {!config.jiraHost || !config.jiraEmail || !config.jiraAccessToken ? (
            <div className="mt-3 rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              Configure Jira host, email, and API token before fetching Jira cards.
            </div>
          ) : null}

          {config.jiraHost && !config.jiraProjectKey ? (
            <div className="mt-3 rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              Configure Jira project key before fetching Jira versions.
            </div>
          ) : null}

          {config.jiraHost && config.jiraProjectKey && jiraVersions.length === 0 && !loadingJiraVersions ? (
            <div className="mt-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              Fetch Jira versions first, then fetch cards for the selected version.
            </div>
          ) : null}

          {jiraVersions.length > 0 && selectedJiraVersion && !hasMatchingJiraVersion ? (
            <div className="mt-3 rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              Select a Jira version from the fetched results before fetching cards.
            </div>
          ) : null}

          {jiraIssues.length > 0 && (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded border border-gray-200 bg-gray-50 p-3">
                <div className="text-sm font-semibold text-gray-900">
                  Cards that will be shown in {selectedJiraVersion}
                </div>
                <div className="mt-2 space-y-2">
                  {filteredJiraIssues.length === 0 ? (
                    <div className="text-sm text-gray-500">No cards match the configured component filter.</div>
                  ) : (
                    filteredJiraIssues.map((issue) => (
                      <a
                        key={issue.key}
                        href={issue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded bg-white px-3 py-2 text-sm text-gray-800 ring-1 ring-gray-200 hover:text-blue-700"
                      >
                        <div className="font-semibold">{issue.key}: {issue.summary}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {issue.status} · {issue.components.length > 0 ? issue.components.join(', ') : 'No component'}
                        </div>
                      </a>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded border border-gray-200 bg-gray-50 p-3">
                <div className="text-sm font-semibold text-gray-900">Deploy services</div>
                <div className="mt-2 space-y-1 text-sm text-gray-700">
                  {cardDeployScope.groups.length === 0 ? (
                    <div>No services found for these cards in the current scope.</div>
                  ) : (
                    cardDeployScope.groups.map((group) => (
                      <div key={group.repository} className="flex items-center justify-between gap-3">
                        <span>{group.displayName}</span>
                        <span className="text-gray-500">{getDeployScopeLine(group)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {cardDeployScope.unmatchedCards.length > 0 && (
            <div className="mt-3 rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              No related MR found for: {cardDeployScope.unmatchedCards.join(', ')}
            </div>
          )}
        </div>

        {jiraCards.length > 0 && (
          <MRTable
            title={`All related MRs from Jira cards (${cardDeployScope.relatedMRs.length})`}
            mrList={cardDeployScope.relatedMRs}
            onMarkAsRead={onMarkAsRead}
            onMarkAsUnread={onMarkAsUnread}
            hasNewComments={hasNewComments}
            isRead={isRead}
            onLabelClick={onLabelClick}
          />
        )}

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
              title="Release scope has MRs"
              detail={summary.total > 0 ? `${summary.total} MRs in scope` : 'Add a release label filter or adjust repository filters'}
            />
            <CheckRow
              passed={notMergedMRs.length === 0}
              title="All scoped MRs are merged"
              detail={notMergedMRs.length === 0 ? 'No open MRs in scope' : `${notMergedMRs.length} MRs still need merge`}
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

        {deployScopeMRs.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow-sm border border-gray-200">
            <p className="text-lg">No merge requests in the release checklist scope.</p>
            <p className="text-sm mt-2">Use a release label filter or adjust repository filters.</p>
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

interface ReleaseChecklistExportDialogProps {
  visible: boolean;
  onClose: () => void;
  scope: CardDeployScope;
  jiraHost?: string;
}

function ReleaseChecklistExportDialog({
  visible,
  onClose,
  scope,
  jiraHost,
}: ReleaseChecklistExportDialogProps) {
  const [text, setText] = useState('');
  const [useFullJiraUrl, setUseFullJiraUrl] = useState(false);

  useEffect(() => {
    if (!visible) return;

    setText(formatCardDeployReport(scope, { jiraHost, useFullJiraUrl }));
  }, [scope, jiraHost, useFullJiraUrl, visible]);

  if (!visible) return null;

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.warn('copy failed', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20">
      <div className="fixed inset-0 bg-black opacity-30" onClick={onClose} />
      <div className="relative max-h-[80vh] w-full max-w-4xl overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Export Release Checklist</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={useFullJiraUrl}
                onChange={(e) => setUseFullJiraUrl(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Full Jira URL
            </label>
            <button onClick={handleCopyAll} className="rounded bg-green-600 px-3 py-1 text-white">Copy all</button>
            <button onClick={onClose} className="rounded bg-gray-200 px-3 py-1">Close</button>
          </div>
        </div>

        <div className="p-4">
          <textarea
            aria-label="release-card-deploy-export"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[520px] w-full resize-y rounded border border-gray-300 p-3 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}

export default ReleaseChecklistPage;
