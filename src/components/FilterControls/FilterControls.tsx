import { MRStatus } from '../../types';

interface FilterControlsProps {
  statusFilters: Record<MRStatus, boolean>;
  onStatusFilterChange: (status: MRStatus, visible: boolean) => void;
  fetchClosedMRs: boolean;
  labelFilter?: string;
  onLabelFilterChange?: (value: string) => void;
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
  labelFilter,
  onLabelFilterChange,
  fetchTimeUnit,
  fetchTimeValue,
  onFetchTimeUnitChange,
  onFetchTimeValueChange,
}: FilterControlsProps) {
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
        <div className="flex items-center gap-2 ml-2">
          <label className="text-sm font-medium text-gray-700">Label filter:</label>
          <input
            type="text"
            placeholder="e.g. UAT, waiting UAT"
            value={labelFilter || ''}
            onChange={(e) => onLabelFilterChange && onLabelFilterChange(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
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

