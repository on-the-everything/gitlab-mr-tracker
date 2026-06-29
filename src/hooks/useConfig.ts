import { useState, useEffect } from "react";
import { AppConfig } from "../types";
import { storage } from "../services/storage";

const DEFAULT_CONFIG: AppConfig = {
  gitlabHost: "https://gitlab.com",
  jiraHost: "",
  accessToken: "",
  autoRefreshInterval: 60,
  myAccount: "",
  myTeamAccounts: [],
  partnerTeamAccounts: [],
  fetchTimeUnit: "weeks",
  fetchTimeValue: 2,
  fetchClosedMRs: false,
  repositoryGroups: [],
  sprintCardScopes: {
    sp13: "",
    sp14: "",
    sp15: "",
  },
};

function migrateConfig(saved: Partial<AppConfig>): AppConfig {
  return {
    ...DEFAULT_CONFIG,
    ...saved,
    myTeamAccounts: saved.myTeamAccounts || saved.teamAccounts || [],
    partnerTeamAccounts: saved.partnerTeamAccounts || [],
    teamAccounts: undefined,
    fetchTimeUnit: saved.fetchTimeUnit || "weeks",
    fetchTimeValue: saved.fetchTimeValue || 2,
    fetchClosedMRs:
      saved.fetchClosedMRs !== undefined ? saved.fetchClosedMRs : false,
    repositoryGroups: Array.isArray(saved.repositoryGroups)
      ? saved.repositoryGroups
      : [],
    sprintCardScopes:
      saved.sprintCardScopes && typeof saved.sprintCardScopes === "object"
        ? saved.sprintCardScopes
        : DEFAULT_CONFIG.sprintCardScopes,
  };
}

export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = storage.getConfig();
    return saved ? migrateConfig(saved) : DEFAULT_CONFIG;
  });

  useEffect(() => {
    const saved = storage.getConfig();
    if (saved) {
      // Migrate old configs
      const needsMigration =
        !saved.fetchTimeUnit ||
        !saved.fetchTimeValue ||
        saved.fetchClosedMRs === undefined ||
        saved.myTeamAccounts === undefined ||
        saved.partnerTeamAccounts === undefined ||
        saved.repositoryGroups === undefined ||
        saved.sprintCardScopes === undefined;

      if (needsMigration) {
        const migrated = migrateConfig(saved);
        setConfig(migrated);
        storage.saveConfig(migrated);
      } else {
        setConfig(migrateConfig(saved));
      }
    }
  }, []);

  const updateConfig = (newConfig: Partial<AppConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    storage.saveConfig(updated);
  };

  const saveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    storage.saveConfig(newConfig);
  };

  return {
    config,
    updateConfig,
    saveConfig,
  };
}
