import { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useConfig } from './hooks/useConfig';
import { useMRData } from './hooks/useMRData';
import { useAutoRefresh } from './hooks/useAutoRefresh';
import { AddMRInput } from './components/AddMRInput/AddMRInput';
import { ConfigModal } from './components/ConfigModal/ConfigModal';
import { MRTable } from './components/MRTable/MRTable';
import { FilterControls } from './components/FilterControls/FilterControls';
import MergedUATPage from './components/MergedUATPage/MergedUATPage';
import { formatTimeAgo } from './utils/timeFormatter';
import { MRStatus } from './types';
import { storage } from './services/storage';

function App() {
  const { config, saveConfig } = useConfig();
  const {
    mrList,
    lastUpdated,
    loading,
    error,
    categorizeMRs,
    addMR,
    refreshAll,
    subscribeToAccounts,
    updateMRList,
    markMRAsRead,
    markMRAsUnread,
    hasNewComments,
    isRead,
    setError,
  } = useMRData(config);

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const navigate = useNavigate();
  const [statusFilters, setStatusFilters] = useState<Record<MRStatus, boolean>>(() => {
    const filters = storage.getStatusFilters();
    // If fetchClosedMRs is disabled, ensure rejected and merged are unchecked
    if (!config.fetchClosedMRs) {
      if (filters[MRStatus.REJECTED] || filters[MRStatus.MERGED]) {
        filters[MRStatus.REJECTED] = false;
        filters[MRStatus.MERGED] = false;
        storage.saveStatusFilters(filters);
      }
    }
    return filters;
  });

  // Save status filters to storage
  useEffect(() => {
    storage.saveStatusFilters(statusFilters);
  }, [statusFilters]);

  // Label filter state
  const [labelFilter, setLabelFilter] = useState<string>('');

  // Update status filters when fetchClosedMRs changes
  useEffect(() => {
    if (!config.fetchClosedMRs) {
      // Uncheck rejected and merged when fetchClosedMRs is disabled
      setStatusFilters((prev) => {
        const needsUpdate = prev[MRStatus.REJECTED] || prev[MRStatus.MERGED];
        if (needsUpdate) {
          const updated = {
            ...prev,
            [MRStatus.REJECTED]: false,
            [MRStatus.MERGED]: false,
          };
          storage.saveStatusFilters(updated);
          return updated;
        }
        return prev;
      });
    }
  }, [config.fetchClosedMRs]);

  // Auto-subscribe when config changes
  useEffect(() => {
    if (config.myAccount || config.teamAccounts.length > 0) {
      // Only auto-subscribe if we have accounts configured
      const timer = setTimeout(() => {
        subscribeToAccounts();
      }, 1000); // Small delay to avoid multiple calls

      return () => clearTimeout(timer);
    }
  }, [config.myAccount, config.teamAccounts.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh handler
  useAutoRefresh(config, mrList, updateMRList, subscribeToAccounts);

  // Categorize and filter MRs
  const categorized = categorizeMRs(mrList);

  // Calculate fetch time limit date
  const getFetchTimeLimitDate = (): Date => {
    const now = new Date();
    if (config.fetchTimeUnit === 'days') {
      return new Date(now.getTime() - config.fetchTimeValue * 24 * 60 * 60 * 1000);
    } else {
      // weeks
      return new Date(now.getTime() - config.fetchTimeValue * 7 * 24 * 60 * 60 * 1000);
    }
  };

  // Filter by fetch time limit (only for My MRs and Team MRs, not Other)
  const filterByFetchTime = (mrs: typeof categorized.my, applyTimeLimit: boolean) => {
    if (!applyTimeLimit) {
      return mrs; // Don't filter "Other MRs"
    }
    const timeLimit = getFetchTimeLimitDate();
    return mrs.filter((mr) => {
      const mrCreatedAt = new Date(mr.createdAt);
      return mrCreatedAt >= timeLimit;
    });
  };

  // Filter by closed MRs setting (only for My MRs and Team MRs, not Other)
  const filterByClosedMRs = (mrs: typeof categorized.my, applyFilter: boolean) => {
    if (!applyFilter) {
      return mrs; // Don't filter "Other MRs"
    }
    if (config.fetchClosedMRs) {
      return mrs; // Show all if fetchClosedMRs is enabled
    }
    // Hide rejected (closed) MRs when fetchClosedMRs is disabled
    return mrs.filter((mr) => mr.status !== MRStatus.REJECTED);
  };

  // Filter by status
  const filterByStatus = (mrs: typeof categorized.my) => {
    return mrs.filter((mr) => statusFilters[mr.status]);
  };

  // Filter by label substring (case-insensitive). If empty, no filter applied.
  const filterByLabel = (mrs: typeof categorized.my) => {
    if (!labelFilter || labelFilter.trim() === '') return mrs;
    const needle = labelFilter.trim().toLowerCase();
    return mrs.filter((mr) => {
      if (!mr.labels || mr.labels.length === 0) return false;
      return mr.labels.some((l) => l.toLowerCase().includes(needle));
    });
  };

  // If a label filter is present, apply it against the local MR list first
  // and categorize those results. This ensures filtering uses only local data
  // and does not rely on fetch-time limits.
  let myMRs = [] as typeof categorized.my;
  let teamMRs = [] as typeof categorized.team;
  let otherMRs = [] as typeof categorized.other;

  if (labelFilter && labelFilter.trim() !== '') {
    const needle = labelFilter.trim().toLowerCase();
    const filteredList = mrList.filter((mr) => {
      if (!mr.labels || mr.labels.length === 0) return false;
      return mr.labels.some((l) => l.toLowerCase().includes(needle));
    });

    const categorizedFiltered = categorizeMRs(filteredList);

    myMRs = filterByStatus(filterByClosedMRs(categorizedFiltered.my, true));
    teamMRs = filterByStatus(filterByClosedMRs(categorizedFiltered.team, true));
    otherMRs = filterByStatus(filterByClosedMRs(categorizedFiltered.other, false));
  } else {
    myMRs = filterByLabel(filterByStatus(filterByClosedMRs(filterByFetchTime(categorized.my, true), true)));
    teamMRs = filterByLabel(filterByStatus(filterByClosedMRs(filterByFetchTime(categorized.team, true), true)));
    otherMRs = filterByLabel(filterByStatus(filterByClosedMRs(filterByFetchTime(categorized.other, false), false)));
  }

  const handleConfigSave = (newConfig: typeof config) => {
    saveConfig(newConfig);
    // Trigger subscription after config save
    setTimeout(() => {
      subscribeToAccounts();
    }, 500);
  };

  const handleStatusFilterChange = (status: MRStatus, visible: boolean) => {
    setStatusFilters((prev) => ({ ...prev, [status]: visible }));
  };

  const handleRefreshClick = () => {
    refreshAll();
    subscribeToAccounts();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              <Link to="/" className="hover:underline">GitLab MR Tracker</Link>
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={handleRefreshClick}
                disabled={loading}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                title="Refresh all merge requests"
              >
                🔄 Refresh
              </button>
              <Link
                to="/merged-uat"
                className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors"
                title="Show merged MRs waiting for UAT"
              >
                🎯 Merged → UAT
              </Link>
              <button
                onClick={() => setIsConfigOpen(true)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                title="Configuration"
              >
                ⚙️
              </button>
            </div>
          </div>

          {/* Add Custom MR Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add Custom MR
            </label>
            <AddMRInput
              onAdd={addMR}
              loading={loading}
              error={error}
              onErrorClear={() => setError(null)}
            />
          </div>

          {/* Last Updated */}
          {lastUpdated && (
            <div className="text-sm text-gray-500">
              Last updated: {formatTimeAgo(lastUpdated)}
            </div>
          )}
        </div>

        {/* Filter Controls */}
        <FilterControls
          statusFilters={statusFilters}
          onStatusFilterChange={handleStatusFilterChange}
          fetchClosedMRs={config.fetchClosedMRs}
          labelFilter={labelFilter}
          onLabelFilterChange={(v) => setLabelFilter(v)}
          fetchTimeUnit={config.fetchTimeUnit}
          fetchTimeValue={config.fetchTimeValue}
          onFetchTimeUnitChange={(u) => saveConfig({ ...config, fetchTimeUnit: u })}
          onFetchTimeValueChange={(v) => {
            const val = Number.isNaN(Number(v)) ? config.fetchTimeValue : Number(v);
            if (val > 0) saveConfig({ ...config, fetchTimeValue: val });
          }}
        />

        <Routes>
          <Route
            path="/"
            element={(
              <>
                {myMRs.length > 0 && (
                  <MRTable
                    title="My MRs"
                    mrList={myMRs}
                    onMarkAsRead={markMRAsRead}
                    onMarkAsUnread={markMRAsUnread}
                    hasNewComments={hasNewComments}
                    isRead={isRead}
                  />
                )}

                {teamMRs.length > 0 && (
                  <MRTable
                    title="Team MRs"
                    mrList={teamMRs}
                    onMarkAsRead={markMRAsRead}
                    onMarkAsUnread={markMRAsUnread}
                    hasNewComments={hasNewComments}
                    isRead={isRead}
                  />
                )}

                {otherMRs.length > 0 && (
                  <MRTable
                    title="Other MRs"
                    mrList={otherMRs}
                    onMarkAsRead={markMRAsRead}
                    onMarkAsUnread={markMRAsUnread}
                    hasNewComments={hasNewComments}
                    isRead={isRead}
                  />
                )}
              </>
            )}
          />

          <Route
            path="/merged-uat"
            element={(
              <MergedUATPage
                mrList={mrList}
                onMarkAsRead={markMRAsRead}
                onMarkAsUnread={markMRAsUnread}
                hasNewComments={(mr) => hasNewComments(mr)}
                isRead={(id) => isRead(id)}
                onBack={() => navigate('/')}
                labelFilter={labelFilter}
              />
            )}
          />
        </Routes>

        {/* Empty State */}
        {myMRs.length === 0 && teamMRs.length === 0 && otherMRs.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow-sm border border-gray-200">
            <p className="text-lg">No merge requests to display.</p>
            <p className="text-sm mt-2">
              {mrList.length === 0
                ? 'Configure your accounts in settings or add a custom MR to get started.'
                : 'All merge requests are filtered out.'}
            </p>
          </div>
        )}
      </div>

      {/* Config Modal */}
      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={config}
        onSave={handleConfigSave}
      />
    </div>
  );
}

export default App;
