import { MRStatus, type RepositoryGroup } from '../../types';
import React from 'react';

interface FilterControlsProps {
  statusFilters: Record<MRStatus, boolean>;
  onStatusFilterChange: (status: MRStatus, visible: boolean) => void;
  fetchClosedMRs: boolean;
  repositoryList?: string[];
  selectedRepository?: string;
  onRepositoryChange?: (repo: string) => void;
  repositoryGroups?: RepositoryGroup[];
  selectedRepositoryGroups?: string[];
  onRepositoryGroupChange?: (groupName: string, selected: boolean) => void;
  teamScopeFilters?: Record<'myTeam' | 'partnerTeam', boolean>;
  onTeamScopeFilterChange?: (
    scope: 'myTeam' | 'partnerTeam',
    selected: boolean,
  ) => void;
  gitlabQueryOptions?: Array<{
    label: string;
    username: string;
    url: string;
    includesClosedMRs: boolean;
  }>;
  labelFilters?: string[];
  availableLabels?: Array<{ label: string; count: number }>;
  onAddLabel?: (value: string) => void;
  onRemoveLabel?: (value: string) => void;
  onClearLabels?: () => void;
  onResetFilters?: () => void;
  fetchTimeUnit: 'days' | 'weeks';
  fetchTimeValue: number;
  onFetchTimeUnitChange: (unit: 'days' | 'weeks') => void;
  onFetchTimeValueChange: (value: number) => void;
}

const statusLabels: Record<MRStatus, string> = {
  [MRStatus.NEW]: '✨ New',
  [MRStatus.COMMENTED]: '💬 Commented',
  [MRStatus.APPROVED]: '✅ Approved',
  [MRStatus.REJECTED]: '⛔ Rejected',
  [MRStatus.MERGED]: '🎉 Merged',
};

export function FilterControls({
  statusFilters,
  onStatusFilterChange,
  fetchClosedMRs,
  repositoryList,
  selectedRepository,
  onRepositoryChange,
  repositoryGroups,
  selectedRepositoryGroups,
  onRepositoryGroupChange,
  teamScopeFilters,
  onTeamScopeFilterChange,
  gitlabQueryOptions,
  labelFilters,
  availableLabels,
  onAddLabel,
  onRemoveLabel,
  onClearLabels,
  onResetFilters,
  fetchTimeUnit,
  fetchTimeValue,
  onFetchTimeUnitChange,
  onFetchTimeValueChange,
}: FilterControlsProps) {
  // local input state for adding labels
  const [inputValue, setInputValue] = React.useState('');
  const [repositorySearch, setRepositorySearch] = React.useState(selectedRepository ?? '');
  const [isRepositoryMenuOpen, setIsRepositoryMenuOpen] = React.useState(false);
  const [isQueryInfoOpen, setIsQueryInfoOpen] = React.useState(false);
  const repositorySearchRef = React.useRef<HTMLDivElement>(null);
  const previousSelectedRepositoryRef = React.useRef(selectedRepository ?? '');

  React.useEffect(() => {
    const nextSelectedRepository = selectedRepository ?? '';
    const previousSelectedRepository = previousSelectedRepositoryRef.current;
    previousSelectedRepositoryRef.current = nextSelectedRepository;

    setRepositorySearch((currentSearch) => {
      if (nextSelectedRepository || currentSearch === previousSelectedRepository) {
        return nextSelectedRepository;
      }

      return currentSearch;
    });
  }, [selectedRepository]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        repositorySearchRef.current &&
        !repositorySearchRef.current.contains(event.target as Node)
      ) {
        setIsRepositoryMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredRepositories = React.useMemo(() => {
    if (!repositoryList) return [];

    const search = repositorySearch.trim().toLowerCase();
    if (!search) return repositoryList;

    return repositoryList.filter((repository) =>
      repository.toLowerCase().includes(search),
    );
  }, [repositoryList, repositorySearch]);

  const selectedLabelKeys = React.useMemo(() => {
    return new Set((labelFilters ?? []).map((label) => label.trim().toLowerCase()));
  }, [labelFilters]);

  const visibleRepositoryGroups = React.useMemo(() => {
    return (repositoryGroups ?? []).filter(
      (group) =>
        group.name.trim() &&
        group.repositories.some((repository) => repository.trim()),
    );
  }, [repositoryGroups]);

  const handleRepositorySearchChange = (value: string) => {
    setRepositorySearch(value);
    setIsRepositoryMenuOpen(true);

    if (!value) {
      onRepositoryChange?.('');
      return;
    }

    const exactMatch = repositoryList?.find(
      (repository) => repository.toLowerCase() === value.trim().toLowerCase(),
    );
    if (exactMatch) {
      onRepositoryChange?.(exactMatch);
    } else if (selectedRepository) {
      onRepositoryChange?.('');
    }
  };

  const handleRepositorySelect = (repository: string) => {
    setRepositorySearch(repository);
    setIsRepositoryMenuOpen(false);
    onRepositoryChange?.(repository);
  };

  const handleRepositoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredRepositories.length > 0) {
      e.preventDefault();
      handleRepositorySelect(filteredRepositories[0]);
    }

    if (e.key === 'Escape') {
      setIsRepositoryMenuOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const v = inputValue.trim();
      if (v && onAddLabel) {
        onAddLabel(v);
        setInputValue('');
      }
      e.preventDefault();
    }
  };

  const handleAvailableLabelClick = (label: string) => {
    const selectedLabel = (labelFilters ?? []).find(
      (currentLabel) => currentLabel.trim().toLowerCase() === label.toLowerCase(),
    );

    if (selectedLabel) {
      onRemoveLabel?.(selectedLabel);
      return;
    }

    onAddLabel?.(label);
  };

  const handleResetFilters = () => {
    setInputValue('');
    setRepositorySearch('');
    setIsRepositoryMenuOpen(false);
    setIsQueryInfoOpen(false);

    if (onResetFilters) {
      onResetFilters();
      return;
    }

    onClearLabels?.();
    onRepositoryChange?.('');
    selectedRepositoryGroups?.forEach((groupName) =>
      onRepositoryGroupChange?.(groupName, false),
    );
    onTeamScopeFilterChange?.('myTeam', true);
    onTeamScopeFilterChange?.('partnerTeam', true);
    onFetchTimeUnitChange('weeks');
    onFetchTimeValueChange(4);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          {Object.entries(statusLabels).map(([status, label]) => {
            const statusEnum = status as MRStatus;
            const isRejected = statusEnum === MRStatus.REJECTED;
            const isMerged = statusEnum === MRStatus.MERGED;
            const isDisabled = (isRejected || isMerged) && !fetchClosedMRs;
            const isChecked = isDisabled ? false : statusFilters[statusEnum];

            return (
              <label
                key={status}
                className={`flex items-center gap-2 px-3 py-1 rounded ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isDisabled}
                  onChange={(e) =>
                    onStatusFilterChange(statusEnum, e.target.checked)
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                />
                <span className="text-sm">{label}</span>
              </label>
            );
          })}
          {gitlabQueryOptions && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsQueryInfoOpen((isOpen) => !isOpen)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-bold text-gray-600 hover:border-blue-300 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-expanded={isQueryInfoOpen}
                aria-label="Show current GitLab query options"
                title="Show current GitLab query options"
              >
                i
              </button>
              {isQueryInfoOpen && (
                <div className="absolute left-0 z-30 mt-2 w-[min(36rem,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                  <div className="mb-2 text-sm font-semibold text-gray-900">
                    Current GitLab queries
                  </div>
                  {gitlabQueryOptions.length > 0 ? (
                    <div className="space-y-3">
                      {gitlabQueryOptions.map((option) => (
                        <div key={`${option.label}-${option.username}`} className="rounded border border-gray-100 bg-gray-50 p-2">
                          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                            <span className="font-semibold text-gray-800">{option.label}</span>
                            <span>{option.username}</span>
                            <span>
                              closed MRs {option.includesClosedMRs ? 'included' : 'filtered after fetch'}
                            </span>
                          </div>
                          <code className="block break-all rounded bg-white p-2 text-xs text-gray-700">
                            {option.url}
                          </code>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      No configured accounts.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="w-full flex items-center gap-2 mt-2">
          <label className="text-sm font-medium text-gray-700">Label filter:</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="type label and press Enter"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleResetFilters}
              className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
            >
              Reset filters
            </button>
            {labelFilters && labelFilters.length > 0 && (
              <button
                onClick={() => onClearLabels && onClearLabels()}
                className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {labelFilters && labelFilters.length > 0 && (
          <div className="flex items-center gap-2 mt-2 w-full flex-wrap">
            <span className="text-sm font-medium text-gray-700">Selected labels:</span>
            {labelFilters.map((lab) => (
              <span key={lab} className="inline-flex items-center bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                <span className="mr-2">{lab}</span>
                <button
                  onClick={() => onRemoveLabel && onRemoveLabel(lab)}
                  className="text-blue-600 hover:text-blue-800 px-1"
                  aria-label={`Remove ${lab}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {availableLabels && availableLabels.length > 0 && (
          <div className="w-full mt-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-gray-700">Available labels:</span>
              <span className="text-xs text-gray-500">{availableLabels.length} labels from loaded MRs</span>
            </div>
            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-2">
              {availableLabels.map(({ label, count }) => {
                const isSelected = selectedLabelKeys.has(label.toLowerCase());

                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleAvailableLabelClick(label)}
                    className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${isSelected
                        ? 'border-blue-300 bg-blue-100 text-blue-800'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800'
                      }`}
                    aria-pressed={isSelected}
                    title={`Filter by ${label}`}
                  >
                    <span>{label}</span>
                    <span className={`rounded-full px-1.5 py-0.5 ${isSelected ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {repositoryList && repositoryList.length > 0 && (
          <div className="flex items-center gap-2 w-full mt-2">
            <label className="text-sm font-medium text-gray-700">Repository:</label>
            <div ref={repositorySearchRef} className="relative w-full max-w-md">
              <input
                type="search"
                value={repositorySearch}
                placeholder="All repositories"
                onChange={(e) => handleRepositorySearchChange(e.target.value)}
                onFocus={() => setIsRepositoryMenuOpen(true)}
                onKeyDown={handleRepositoryKeyDown}
                className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Search repository"
                aria-expanded={isRepositoryMenuOpen}
                aria-controls="repository-filter-options"
                role="combobox"
              />
              {isRepositoryMenuOpen && (
                <div
                  id="repository-filter-options"
                  className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setRepositorySearch('');
                      setIsRepositoryMenuOpen(false);
                      onRepositoryChange?.('');
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${selectedRepository ? 'text-gray-700' : 'bg-blue-50 text-blue-700'
                      }`}
                  >
                    All repositories
                  </button>
                  {filteredRepositories.length > 0 ? (
                    filteredRepositories.map((repository) => (
                      <button
                        key={repository}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleRepositorySelect(repository)}
                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${selectedRepository === repository
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700'
                          }`}
                      >
                        {repository}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500">No repositories found</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {visibleRepositoryGroups.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap w-full mt-2">
            <span className="text-sm font-medium text-gray-700">Repository groups:</span>
            {visibleRepositoryGroups.map((group, index) => (
              <label
                key={`${group.name}-${index}`}
                className="flex items-center gap-2 px-3 py-1 rounded cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedRepositoryGroups?.includes(group.name) ?? false}
                  onChange={(e) =>
                    onRepositoryGroupChange?.(group.name, e.target.checked)
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm">{group.name}</span>
              </label>
            ))}
          </div>
        )}
        {teamScopeFilters && onTeamScopeFilterChange && (
          <div className="flex items-center gap-2 flex-wrap w-full mt-2">
            <span className="text-sm font-medium text-gray-700">Team scope:</span>
            <label className="flex items-center gap-2 px-3 py-1 rounded cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={teamScopeFilters.myTeam}
                onChange={(e) =>
                  onTeamScopeFilterChange('myTeam', e.target.checked)
                }
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm">My team</span>
            </label>
            <label className="flex items-center gap-2 px-3 py-1 rounded cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={teamScopeFilters.partnerTeam}
                onChange={(e) =>
                  onTeamScopeFilterChange('partnerTeam', e.target.checked)
                }
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm">Partner team</span>
            </label>
          </div>
        )}
        <div className="flex items-center gap-2 ml-2">
          <label className="text-sm font-medium text-gray-700">Fetch time:</label>
          <input
            type="number"
            min={1}
            value={fetchTimeValue}
            onChange={(e) => onFetchTimeValueChange(Number(e.target.value))}
            className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={fetchTimeUnit}
            onChange={(e) => onFetchTimeUnitChange(e.target.value as 'days' | 'weeks')}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="days">days</option>
            <option value="weeks">weeks</option>
          </select>
        </div>
      </div>
    </div>
  );
}
