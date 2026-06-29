import { AppConfig, MergeRequest, MRStatus } from '../types';

const CONFIG_KEY = 'gitlab_mr_config';
const MR_LIST_KEY = 'gitlab_mr_list';
const LAST_UPDATED_KEY = 'gitlab_mr_last_updated';
const STATUS_FILTERS_KEY = 'gitlab_mr_status_filters';
const LABEL_FILTERS_KEY = 'gitlab_mr_label_filters';
const SELECTED_REPOSITORY_KEY = 'gitlab_mr_selected_repository';
const SELECTED_REPOSITORY_GROUPS_KEY = 'gitlab_mr_selected_repository_groups';
const SELECTED_JIRA_VERSIONS_KEY = 'gitlab_mr_selected_jira_versions';
const TEAM_SCOPE_FILTERS_KEY = 'gitlab_mr_team_scope_filters';
const MR_READ_TIMESTAMPS_KEY = 'gitlab_mr_read_timestamps';

export const storage = {
  getConfig(): AppConfig | null {
    try {
      const item = localStorage.getItem(CONFIG_KEY);
      if (!item) return null;
      return JSON.parse(item) as AppConfig;
    } catch {
      return null;
    }
  },

  saveConfig(config: AppConfig): void {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  },

  getMRList(): MergeRequest[] {
    try {
      const item = localStorage.getItem(MR_LIST_KEY);
      if (!item) return [];
      return JSON.parse(item) as MergeRequest[];
    } catch {
      return [];
    }
  },

  saveMRList(mrList: MergeRequest[]): void {
    try {
      localStorage.setItem(MR_LIST_KEY, JSON.stringify(mrList));
    } catch (error) {
      console.error('Failed to save MR list:', error);
    }
  },

  getLastUpdated(): string | null {
    return localStorage.getItem(LAST_UPDATED_KEY);
  },

  saveLastUpdated(timestamp: string): void {
    try {
      localStorage.setItem(LAST_UPDATED_KEY, timestamp);
    } catch (error) {
      console.error('Failed to save last updated:', error);
    }
  },

  getStatusFilters(): Record<MRStatus, boolean> {
    try {
      const item = localStorage.getItem(STATUS_FILTERS_KEY);
      if (!item) {
        // Default: all statuses visible
        return {
          [MRStatus.NEW]: true,
          [MRStatus.COMMENTED]: true,
          [MRStatus.APPROVED]: true,
          [MRStatus.REJECTED]: true,
          [MRStatus.MERGED]: true,
        };
      }
      const filters = JSON.parse(item) as Partial<Record<MRStatus, boolean>>;
      // Ensure all statuses exist (for backward compatibility)
      // NEW status is always checked by default
      return {
        [MRStatus.NEW]: true, // Always default to checked
        [MRStatus.COMMENTED]: filters[MRStatus.COMMENTED] ?? true,
        [MRStatus.APPROVED]: filters[MRStatus.APPROVED] ?? true,
        [MRStatus.REJECTED]: filters[MRStatus.REJECTED] ?? true,
        [MRStatus.MERGED]: filters[MRStatus.MERGED] ?? true,
      };
    } catch {
      return {
        [MRStatus.NEW]: true,
        [MRStatus.COMMENTED]: true,
        [MRStatus.APPROVED]: true,
        [MRStatus.REJECTED]: true,
        [MRStatus.MERGED]: true,
      };
    }
  },

  saveStatusFilters(filters: Record<MRStatus, boolean>): void {
    try {
      localStorage.setItem(STATUS_FILTERS_KEY, JSON.stringify(filters));
    } catch (error) {
      console.error('Failed to save status filters:', error);
    }
  },

  getLabelFilters(): string[] {
    try {
      const item = localStorage.getItem(LABEL_FILTERS_KEY);
      if (!item) return [];
      return JSON.parse(item) as string[];
    } catch {
      return [];
    }
  },

  saveLabelFilters(filters: string[]): void {
    try {
      localStorage.setItem(LABEL_FILTERS_KEY, JSON.stringify(filters));
    } catch (error) {
      console.error('Failed to save label filters:', error);
    }
  },

  getSelectedRepository(): string {
    return localStorage.getItem(SELECTED_REPOSITORY_KEY) || '';
  },

  saveSelectedRepository(repository: string): void {
    try {
      localStorage.setItem(SELECTED_REPOSITORY_KEY, repository);
    } catch (error) {
      console.error('Failed to save selected repository:', error);
    }
  },

  getSelectedRepositoryGroups(): string[] {
    try {
      const item = localStorage.getItem(SELECTED_REPOSITORY_GROUPS_KEY);
      if (!item) return [];
      return JSON.parse(item) as string[];
    } catch {
      return [];
    }
  },

  saveSelectedRepositoryGroups(groups: string[]): void {
    try {
      localStorage.setItem(SELECTED_REPOSITORY_GROUPS_KEY, JSON.stringify(groups));
    } catch (error) {
      console.error('Failed to save selected repository groups:', error);
    }
  },

  getSelectedJiraVersion(projectKey: string): string {
    try {
      const normalizedProjectKey = projectKey.trim().toUpperCase();
      if (!normalizedProjectKey) return '';

      const item = localStorage.getItem(SELECTED_JIRA_VERSIONS_KEY);
      if (!item) return '';

      const versions = JSON.parse(item) as Record<string, string>;
      return typeof versions[normalizedProjectKey] === 'string'
        ? versions[normalizedProjectKey]
        : '';
    } catch {
      return '';
    }
  },

  saveSelectedJiraVersion(projectKey: string, version: string): void {
    try {
      const normalizedProjectKey = projectKey.trim().toUpperCase();
      const normalizedVersion = version.trim();
      if (!normalizedProjectKey || !normalizedVersion) return;

      const item = localStorage.getItem(SELECTED_JIRA_VERSIONS_KEY);
      const versions = item ? (JSON.parse(item) as Record<string, string>) : {};
      versions[normalizedProjectKey] = normalizedVersion;
      localStorage.setItem(SELECTED_JIRA_VERSIONS_KEY, JSON.stringify(versions));
    } catch (error) {
      console.error('Failed to save selected Jira version:', error);
    }
  },

  getTeamScopeFilters(): Record<'myTeam' | 'partnerTeam', boolean> {
    try {
      const item = localStorage.getItem(TEAM_SCOPE_FILTERS_KEY);
      if (!item) {
        return { myTeam: true, partnerTeam: true };
      }

      const filters = JSON.parse(item) as Partial<Record<'myTeam' | 'partnerTeam', boolean>>;
      return {
        myTeam: filters.myTeam ?? true,
        partnerTeam: filters.partnerTeam ?? true,
      };
    } catch {
      return { myTeam: true, partnerTeam: true };
    }
  },

  saveTeamScopeFilters(filters: Record<'myTeam' | 'partnerTeam', boolean>): void {
    try {
      localStorage.setItem(TEAM_SCOPE_FILTERS_KEY, JSON.stringify(filters));
    } catch (error) {
      console.error('Failed to save team scope filters:', error);
    }
  },

  getMRReadTimestamps(): Record<string, string> {
    try {
      const item = localStorage.getItem(MR_READ_TIMESTAMPS_KEY);
      if (!item) return {};
      return JSON.parse(item) as Record<string, string>;
    } catch {
      return {};
    }
  },

  saveMRReadTimestamps(timestamps: Record<string, string>): void {
    try {
      localStorage.setItem(MR_READ_TIMESTAMPS_KEY, JSON.stringify(timestamps));
    } catch (error) {
      console.error('Failed to save MR read timestamps:', error);
    }
  },

  updateMRReadTimestamp(mrId: string, timestamp: string): void {
    try {
      const timestamps = this.getMRReadTimestamps();
      timestamps[mrId] = timestamp;
      this.saveMRReadTimestamps(timestamps);
    } catch (error) {
      console.error('Failed to update MR read timestamp:', error);
    }
  },
};
