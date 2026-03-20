import { MRStatus } from '../../types';
import React from 'react';

interface FilterControlsProps {
  statusFilters: Record<MRStatus, boolean>;
  onStatusFilterChange: (status: MRStatus, visible: boolean) => void;
  fetchClosedMRs: boolean;
  repositoryList?: string[];
  selectedRepository?: string;
  onRepositoryChange?: (repo: string) => void;
  labelFilters?: string[];
  onAddLabel?: (value: string) => void;
  onRemoveLabel?: (value: string) => void;
  onClearLabels?: () => void;
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
  labelFilters,
  onAddLabel,
  onRemoveLabel,
  onClearLabels,
  fetchTimeUnit,
  fetchTimeValue,
  onFetchTimeUnitChange,
  onFetchTimeValueChange,
}: FilterControlsProps) {
  // local input state for adding labels
  const [inputValue, setInputValue] = React.useState('');

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
          <div className="flex items-center gap-2 mt-2 w-full">
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
        {repositoryList && repositoryList.length > 0 && (
          <div className="flex items-center gap-2 w-full mt-2">
            <label className="text-sm font-medium text-gray-700">Repository:</label>
            <select
              value={selectedRepository ?? ''}
              onChange={(e) => onRepositoryChange && onRepositoryChange(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All repositories</option>
              {repositoryList.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
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

