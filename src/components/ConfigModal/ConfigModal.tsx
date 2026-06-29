import { useState, useEffect } from 'react';
import { AppConfig, type JiraVersionScope, type RepositoryGroup } from '../../types';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSave: (config: AppConfig) => void;
}

function normalizeRepositoryGroups(repositoryGroups: unknown): RepositoryGroup[] {
  if (!Array.isArray(repositoryGroups)) {
    return [];
  }

  return repositoryGroups.map((group) => {
    const groupRecord =
      group && typeof group === 'object'
        ? (group as Partial<RepositoryGroup>)
        : {};
    const repositories = Array.isArray(groupRecord.repositories)
      ? groupRecord.repositories
        .filter((repository): repository is string => typeof repository === 'string')
        .map((repository) => repository.trim())
        .filter(Boolean)
      : [];

    return {
      name: typeof groupRecord.name === 'string' ? groupRecord.name.trim() : '',
      repositories,
    };
  });
}

function normalizeJiraVersionScopes(scopes: unknown): JiraVersionScope[] {
  if (!Array.isArray(scopes)) {
    return [{ name: 'AMZ 2.12', version: 'AMZ 2.12', components: [] }];
  }

  const normalized = scopes
    .map((scope) => {
      const scopeRecord =
        scope && typeof scope === 'object'
          ? (scope as Partial<JiraVersionScope>)
          : {};
      const components = Array.isArray(scopeRecord.components)
        ? scopeRecord.components
          .filter((component): component is string => typeof component === 'string')
          .map((component) => component.trim())
          .filter(Boolean)
        : [];

      return {
        name: typeof scopeRecord.name === 'string' ? scopeRecord.name.trim() : '',
        version: typeof scopeRecord.version === 'string' ? scopeRecord.version.trim() : '',
        components,
      };
    })
    .filter((scope) => scope.name && scope.version);

  return normalized.length > 0
    ? normalized
    : [{ name: 'AMZ 2.12', version: 'AMZ 2.12', components: [] }];
}

function normalizeConfig(config: Partial<AppConfig>): AppConfig {
  const sprintCardScopes =
    config.sprintCardScopes && typeof config.sprintCardScopes === 'object'
      ? config.sprintCardScopes
      : {};

  return {
    gitlabHost: config.gitlabHost || '',
    accessToken: config.accessToken || '',
    autoRefreshInterval: config.autoRefreshInterval || 60,
    myAccount: config.myAccount || '',
    myTeamAccounts: Array.isArray(config.myTeamAccounts)
      ? config.myTeamAccounts
      : Array.isArray(config.teamAccounts)
        ? config.teamAccounts
        : [],
    partnerTeamAccounts: Array.isArray(config.partnerTeamAccounts)
      ? config.partnerTeamAccounts
      : [],
    fetchTimeUnit:
      config.fetchTimeUnit === 'days' || config.fetchTimeUnit === 'weeks'
        ? config.fetchTimeUnit
        : 'weeks',
    fetchTimeValue: config.fetchTimeValue || 2,
    fetchClosedMRs: config.fetchClosedMRs !== undefined ? config.fetchClosedMRs : false,
    jiraHost: config.jiraHost || '',
    jiraProjectKey: !config.jiraProjectKey || config.jiraProjectKey === 'AMZ' ? 'AZP' : config.jiraProjectKey,
    jiraEmail: config.jiraEmail || '',
    jiraAccessToken: config.jiraAccessToken || '',
    repositoryGroups: normalizeRepositoryGroups(config.repositoryGroups),
    sprintCardScopes: {
      sp13: '',
      sp14: '',
      sp15: '',
      ...sprintCardScopes,
    },
    jiraVersionScopes: normalizeJiraVersionScopes(config.jiraVersionScopes),
  };
}

function parseRepositoryInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((repository) => repository.trim())
        .filter(Boolean),
    ),
  );
}

function formatRepositoryInput(repositories: string[]): string {
  return repositories.join('\n');
}

function parseComponentInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((component) => component.trim())
        .filter(Boolean),
    ),
  );
}

function formatComponentInput(components: string[]): string {
  return components.join('\n');
}

function sanitizeConfig(config: AppConfig): AppConfig {
  return {
    ...config,
    gitlabHost: config.gitlabHost.trim(),
    jiraHost: config.jiraHost?.trim() || '',
    jiraProjectKey: config.jiraProjectKey.trim(),
    jiraEmail: config.jiraEmail.trim(),
    jiraAccessToken: config.jiraAccessToken.trim(),
    myAccount: config.myAccount.trim(),
    myTeamAccounts: config.myTeamAccounts.map((account) => account.trim()).filter(Boolean),
    partnerTeamAccounts: config.partnerTeamAccounts.map((account) => account.trim()).filter(Boolean),
    teamAccounts: undefined,
    repositoryGroups: normalizeRepositoryGroups(config.repositoryGroups).filter(
      (group) => group.name && group.repositories.length > 0,
    ),
    sprintCardScopes: Object.fromEntries(
      Object.entries(config.sprintCardScopes || {})
        .map(([sprint, cards]) => [sprint.trim().toLowerCase(), cards])
        .filter(([sprint]) => sprint),
    ),
    jiraVersionScopes: normalizeJiraVersionScopes(config.jiraVersionScopes),
  };
}

export function ConfigModal({ isOpen, onClose, config, onSave }: ConfigModalProps) {
  const [formData, setFormData] = useState<AppConfig>(config);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState<string>('');
  const [repositoryGroupTexts, setRepositoryGroupTexts] = useState<string[]>([]);
  const [jiraComponentTexts, setJiraComponentTexts] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const normalizedConfig = normalizeConfig(config);
      setFormData(normalizedConfig);
      setErrors({});
      setJsonText(JSON.stringify(normalizedConfig, null, 2));
      setViewMode('form');
      setRepositoryGroupTexts(normalizedConfig.repositoryGroups.map((g) => formatRepositoryInput(g.repositories)));
      setJiraComponentTexts(normalizedConfig.jiraVersionScopes.map((scope) => formatComponentInput(scope.components)));
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.gitlabHost.trim()) {
      newErrors.gitlabHost = 'GitLab host is required';
    } else {
      try {
        new URL(formData.gitlabHost);
      } catch {
        newErrors.gitlabHost = 'Invalid URL format';
      }
    }

    if (!formData.accessToken.trim()) {
      newErrors.accessToken = 'Access token is required';
    }

    if (formData.jiraHost && formData.jiraHost.trim()) {
      try {
        new URL(formData.jiraHost);
      } catch {
        newErrors.jiraHost = 'Invalid URL format';
      }
    }

    if ((formData.jiraEmail.trim() || formData.jiraAccessToken.trim()) && !formData.jiraHost?.trim()) {
      newErrors.jiraHost = 'Jira host is required when Jira API credentials are set';
    }

    if (formData.jiraHost?.trim() && !formData.jiraProjectKey.trim()) {
      newErrors.jiraProjectKey = 'Jira project key is required for Jira version fetching';
    }

    if (formData.jiraHost?.trim() && formData.jiraAccessToken.trim() && !formData.jiraEmail.trim()) {
      newErrors.jiraEmail = 'Jira email is required for Jira API access';
    }

    if (formData.jiraHost?.trim() && formData.jiraEmail.trim() && !formData.jiraAccessToken.trim()) {
      newErrors.jiraAccessToken = 'Jira API token is required for Jira API access';
    }

    if (formData.autoRefreshInterval <= 0) {
      newErrors.autoRefreshInterval = 'Auto-refresh interval must be greater than 0';
    }

    if (!formData.fetchTimeValue || formData.fetchTimeValue <= 0) {
      newErrors.fetchTimeValue = 'Fetch time limit is required';
    } else {
      const max = formData.fetchTimeUnit === 'days' ? 90 : 12;
      if (formData.fetchTimeValue > max) {
        newErrors.fetchTimeValue = `Maximum ${max} ${formData.fetchTimeUnit} allowed`;
      }
    }

    const repositoryGroupNames = new Set<string>();
    formData.repositoryGroups.forEach((group, index) => {
      const groupName = group.name.trim();
      const repositories = group.repositories.map((repository) => repository.trim()).filter(Boolean);

      if (!groupName) {
        newErrors[`repositoryGroupName-${index}`] = 'Group name is required';
      } else {
        const normalizedGroupName = groupName.toLowerCase();
        if (repositoryGroupNames.has(normalizedGroupName)) {
          newErrors[`repositoryGroupName-${index}`] = 'Group name must be unique';
        }
        repositoryGroupNames.add(normalizedGroupName);
      }

      if (repositories.length === 0) {
        newErrors[`repositoryGroupRepositories-${index}`] = 'Add at least one repository';
      }
    });

    const jiraScopeNames = new Set<string>();
    formData.jiraVersionScopes.forEach((scope, index) => {
      const scopeName = scope.name.trim();
      const version = scope.version.trim();

      if (!scopeName) {
        newErrors[`jiraVersionScopeName-${index}`] = 'Version scope name is required';
      } else {
        const normalizedScopeName = scopeName.toLowerCase();
        if (jiraScopeNames.has(normalizedScopeName)) {
          newErrors[`jiraVersionScopeName-${index}`] = 'Version scope name must be unique';
        }
        jiraScopeNames.add(normalizedScopeName);
      }

      if (!version) {
        newErrors[`jiraVersionScopeVersion-${index}`] = 'Jira version is required';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleJsonChange = (value: string) => {
    setJsonText(value);
    try {
      const parsed = JSON.parse(value) as Partial<AppConfig>;
      setFormData(normalizeConfig(parsed));
      setErrors({});
    } catch {
      setErrors({ json: 'Invalid JSON format' });
    }
  };

  const handleExport = () => {
    try {
      const configJson = JSON.stringify(sanitizeConfig(formData), null, 2);
      const blob = new Blob([configJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gitlab-mr-config.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export config:', error);
      alert('Failed to export configuration');
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string) as Partial<AppConfig>;

          // Validate imported config
          if (!imported.gitlabHost || !imported.accessToken) {
            alert('Invalid configuration file: missing required fields');
            return;
          }

          // Update form with imported config
          const normalizedImported = normalizeConfig(imported);
          setFormData(normalizedImported);
          setRepositoryGroupTexts(normalizedImported.repositoryGroups.map((g) => formatRepositoryInput(g.repositories)));
          setJiraComponentTexts(normalizedImported.jiraVersionScopes.map((scope) => formatComponentInput(scope.components)));

          alert('Configuration imported successfully! Click Save to apply.');
        } catch (error) {
          console.error('Failed to import config:', error);
          alert('Failed to import configuration: Invalid JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Configuration</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="flex border-b mb-4">
            <button
              type="button"
              onClick={() => setViewMode('form')}
              className={`px-4 py-2 font-medium text-sm ${viewMode === 'form'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Form
            </button>
            <button
              type="button"
              onClick={() => {
                setJsonText(JSON.stringify(sanitizeConfig(formData), null, 2));
                setViewMode('json');
              }}
              className={`px-4 py-2 font-medium text-sm ${viewMode === 'json'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              JSON
            </button>
          </div>

          {viewMode === 'form' && <div className="space-y-4">
            <div>
              <label htmlFor="gitlabHost" className="block text-sm font-medium text-gray-700 mb-1">
                GitLab Host
              </label>
              <input
                type="text"
                id="gitlabHost"
                value={formData.gitlabHost}
                onChange={(e) =>
                  setFormData({ ...formData, gitlabHost: e.target.value })
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.gitlabHost ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="https://gitlab.com"
              />
              {errors.gitlabHost && (
                <p className="mt-1 text-sm text-red-600">{errors.gitlabHost}</p>
              )}
            </div>

            <div>
              <label htmlFor="accessToken" className="block text-sm font-medium text-gray-700 mb-1">
                Private Access Token
              </label>
              <input
                type="password"
                id="accessToken"
                value={formData.accessToken}
                onChange={(e) =>
                  setFormData({ ...formData, accessToken: e.target.value })
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.accessToken ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="Enter your GitLab access token"
              />
              {errors.accessToken && (
                <p className="mt-1 text-sm text-red-600">{errors.accessToken}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Create a token at: Settings → Access Tokens
              </p>
            </div>

            <div>
              <label htmlFor="jiraHost" className="block text-sm font-medium text-gray-700 mb-1">
                Jira Host (optional)
              </label>
              <input
                type="text"
                id="jiraHost"
                value={formData.jiraHost || ''}
                onChange={(e) =>
                  setFormData({ ...formData, jiraHost: e.target.value })
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.jiraHost ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="https://your-company.atlassian.net"
              />
              {errors.jiraHost && (
                <p className="mt-1 text-sm text-red-600">{errors.jiraHost}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Optional — used to build links to Jira tickets discovered in branch names.
              </p>
            </div>

            <div>
              <label htmlFor="jiraEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Jira Email
              </label>
              <input
                type="email"
                id="jiraEmail"
                value={formData.jiraEmail}
                onChange={(e) =>
                  setFormData({ ...formData, jiraEmail: e.target.value })
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.jiraEmail ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="name@company.com"
              />
              {errors.jiraEmail && (
                <p className="mt-1 text-sm text-red-600">{errors.jiraEmail}</p>
              )}
            </div>

            <div>
              <label htmlFor="jiraProjectKey" className="block text-sm font-medium text-gray-700 mb-1">
                Jira Project Key
              </label>
              <input
                type="text"
                id="jiraProjectKey"
                value={formData.jiraProjectKey}
                onChange={(e) =>
                  setFormData({ ...formData, jiraProjectKey: e.target.value })
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.jiraProjectKey ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="AZP"
              />
              {errors.jiraProjectKey && (
                <p className="mt-1 text-sm text-red-600">{errors.jiraProjectKey}</p>
              )}
            </div>

            <div>
              <label htmlFor="jiraAccessToken" className="block text-sm font-medium text-gray-700 mb-1">
                Jira API Token
              </label>
              <input
                type="password"
                id="jiraAccessToken"
                value={formData.jiraAccessToken}
                onChange={(e) =>
                  setFormData({ ...formData, jiraAccessToken: e.target.value })
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.jiraAccessToken ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="Enter your Jira API token"
              />
              {errors.jiraAccessToken && (
                <p className="mt-1 text-sm text-red-600">{errors.jiraAccessToken}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Used with Jira email for Jira Cloud API access.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jira Version Scopes
              </label>
              <div className="space-y-3">
                {formData.jiraVersionScopes.map((scope, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value={scope.name}
                          onChange={(e) => {
                            const nextScopes = [...formData.jiraVersionScopes];
                            nextScopes[index] = { ...scope, name: e.target.value };
                            setFormData({ ...formData, jiraVersionScopes: nextScopes });
                          }}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`jiraVersionScopeName-${index}`] ? 'border-red-500' : 'border-gray-300'
                            }`}
                          placeholder="AMZ 2.12"
                        />
                        {errors[`jiraVersionScopeName-${index}`] && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors[`jiraVersionScopeName-${index}`]}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextScopes = formData.jiraVersionScopes.filter((_, i) => i !== index);
                          setFormData({ ...formData, jiraVersionScopes: nextScopes });
                          setJiraComponentTexts(jiraComponentTexts.filter((_, i) => i !== index));
                        }}
                        className="mt-6 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Jira Version
                      </label>
                      <input
                        type="text"
                        value={scope.version}
                        onChange={(e) => {
                          const nextScopes = [...formData.jiraVersionScopes];
                          nextScopes[index] = { ...scope, version: e.target.value };
                          setFormData({ ...formData, jiraVersionScopes: nextScopes });
                        }}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`jiraVersionScopeVersion-${index}`] ? 'border-red-500' : 'border-gray-300'
                          }`}
                        placeholder="AMZ 2.12"
                      />
                      {errors[`jiraVersionScopeVersion-${index}`] && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors[`jiraVersionScopeVersion-${index}`]}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Components
                      </label>
                      <textarea
                        value={jiraComponentTexts[index] ?? formatComponentInput(scope.components)}
                        onChange={(e) => {
                          const rawValue = e.target.value;
                          const nextTexts = [...jiraComponentTexts];
                          nextTexts[index] = rawValue;
                          setJiraComponentTexts(nextTexts);
                          const nextScopes = [...formData.jiraVersionScopes];
                          nextScopes[index] = {
                            ...scope,
                            components: parseComponentInput(rawValue),
                          };
                          setFormData({ ...formData, jiraVersionScopes: nextScopes });
                        }}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={'checkout-service\npayment-service'}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Leave empty to include every component in this Jira version.
                      </p>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      jiraVersionScopes: [
                        ...formData.jiraVersionScopes,
                        { name: '', version: '', components: [] },
                      ],
                    });
                    setJiraComponentTexts([...jiraComponentTexts, '']);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  + Add Jira Version Scope
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="autoRefreshInterval" className="block text-sm font-medium text-gray-700 mb-1">
                Auto-refresh Interval (seconds)
              </label>
              <input
                type="number"
                id="autoRefreshInterval"
                value={formData.autoRefreshInterval}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    autoRefreshInterval: parseInt(e.target.value, 10) || 60,
                  })
                }
                min="10"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.autoRefreshInterval ? 'border-red-500' : 'border-gray-300'
                  }`}
              />
              {errors.autoRefreshInterval && (
                <p className="mt-1 text-sm text-red-600">{errors.autoRefreshInterval}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Minimum: 10 seconds
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fetch Time Limit <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 items-center">
                <div className="flex gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="fetchTimeUnit"
                      value="days"
                      checked={formData.fetchTimeUnit === 'days'}
                      onChange={() =>
                        setFormData({
                          ...formData,
                          fetchTimeUnit: 'days',
                          fetchTimeValue: Math.min(formData.fetchTimeValue, 90),
                        })
                      }
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">Days</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="fetchTimeUnit"
                      value="weeks"
                      checked={formData.fetchTimeUnit === 'weeks'}
                      onChange={() =>
                        setFormData({
                          ...formData,
                          fetchTimeUnit: 'weeks',
                          fetchTimeValue: Math.min(formData.fetchTimeValue, 12),
                        })
                      }
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">Weeks</span>
                  </label>
                </div>
                <input
                  type="number"
                  value={formData.fetchTimeValue}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10) || 0;
                    const max = formData.fetchTimeUnit === 'days' ? 90 : 12;
                    setFormData({
                      ...formData,
                      fetchTimeValue: Math.min(Math.max(value, 1), max),
                    });
                  }}
                  min="1"
                  max={formData.fetchTimeUnit === 'days' ? 90 : 12}
                  className={`w-20 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.fetchTimeValue ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
              </div>
              {errors.fetchTimeValue && (
                <p className="mt-1 text-sm text-red-600">{errors.fetchTimeValue}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Maximum: {formData.fetchTimeUnit === 'days' ? '90 days' : '12 weeks'}. Default: 2 weeks
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.fetchClosedMRs}
                  onChange={(e) =>
                    setFormData({ ...formData, fetchClosedMRs: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Fetch Closed MRs
                </span>
              </label>
              <p className="mt-1 text-xs text-gray-500 ml-6">
                When enabled, includes closed/rejected MRs in addition to opened and merged MRs. Default: disabled (only fetch opened and merged).
              </p>
            </div>

            <div>
              <label htmlFor="myAccount" className="block text-sm font-medium text-gray-700 mb-1">
                My Account
              </label>
              <input
                type="text"
                id="myAccount"
                value={formData.myAccount}
                onChange={(e) =>
                  setFormData({ ...formData, myAccount: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="@myname"
              />
              <p className="mt-1 text-xs text-gray-500">
                Your GitLab username (e.g., @myname). MRs from this account will appear in "My MRs" table.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                My Team Accounts
              </label>
              <div className="space-y-2">
                {formData.myTeamAccounts.map((account, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={account}
                      onChange={(e) => {
                        const newAccounts = [...formData.myTeamAccounts];
                        newAccounts[index] = e.target.value;
                        setFormData({ ...formData, myTeamAccounts: newAccounts });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="@teammate"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newAccounts = formData.myTeamAccounts.filter((_, i) => i !== index);
                        setFormData({ ...formData, myTeamAccounts: newAccounts });
                      }}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      myTeamAccounts: [...formData.myTeamAccounts, ''],
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  + Add My Team Account
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                My team member usernames. MRs from these accounts will appear in "My Team MRs" table.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Partner Team Accounts
              </label>
              <div className="space-y-2">
                {formData.partnerTeamAccounts.map((account, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={account}
                      onChange={(e) => {
                        const newAccounts = [...formData.partnerTeamAccounts];
                        newAccounts[index] = e.target.value;
                        setFormData({ ...formData, partnerTeamAccounts: newAccounts });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="@partner"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newAccounts = formData.partnerTeamAccounts.filter((_, i) => i !== index);
                        setFormData({ ...formData, partnerTeamAccounts: newAccounts });
                      }}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      partnerTeamAccounts: [...formData.partnerTeamAccounts, ''],
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  + Add Partner Team Account
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Partner team usernames. MRs from these accounts will appear in "Partner Team MRs" table.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Repository Groups
              </label>
              <div className="space-y-3">
                {formData.repositoryGroups.map((group, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={group.name}
                          onChange={(e) => {
                            const nextGroups = [...formData.repositoryGroups];
                            nextGroups[index] = { ...group, name: e.target.value };
                            setFormData({ ...formData, repositoryGroups: nextGroups });
                          }}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`repositoryGroupName-${index}`] ? 'border-red-500' : 'border-gray-300'
                            }`}
                          placeholder="product-sqd"
                        />
                        {errors[`repositoryGroupName-${index}`] && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors[`repositoryGroupName-${index}`]}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextGroups = formData.repositoryGroups.filter((_, i) => i !== index);
                          setFormData({ ...formData, repositoryGroups: nextGroups });
                          setRepositoryGroupTexts(repositoryGroupTexts.filter((_, i) => i !== index));
                        }}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    <div>
                      <textarea
                        value={repositoryGroupTexts[index] ?? formatRepositoryInput(group.repositories)}
                        onChange={(e) => {
                          const rawValue = e.target.value;
                          const nextTexts = [...repositoryGroupTexts];
                          nextTexts[index] = rawValue;
                          setRepositoryGroupTexts(nextTexts);
                          const nextGroups = [...formData.repositoryGroups];
                          nextGroups[index] = {
                            ...group,
                            repositories: parseRepositoryInput(rawValue),
                          };
                          setFormData({ ...formData, repositoryGroups: nextGroups });
                        }}
                        rows={3}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`repositoryGroupRepositories-${index}`] ? 'border-red-500' : 'border-gray-300'
                          }`}
                        placeholder={'product-sqd-android\nproduct-sqd-ios\nproduct-sqd-web'}
                      />
                      {errors[`repositoryGroupRepositories-${index}`] && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors[`repositoryGroupRepositories-${index}`]}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      repositoryGroups: [
                        ...formData.repositoryGroups,
                        { name: '', repositories: [] },
                      ],
                    }); setRepositoryGroupTexts([...repositoryGroupTexts, '']);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  + Add Repository Group
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Use GitLab project names such as product-sqd-android. Separate repositories with commas or new lines.
              </p>
            </div>

          </div>
          }

          {viewMode === 'json' && <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                JSON Configuration
              </label>
              <textarea
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                rows={20}
                className={`w-full px-3 py-2 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.json ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="Paste your JSON configuration here"
              />
              {errors.json && (
                <p className="mt-1 text-sm text-red-600">{errors.json}</p>
              )}
              {!errors.json && Object.entries(errors).length > 0 && (
                <div className="mt-2 space-y-1">
                  {Object.values(errors).map((error, index) => (
                    <p key={`${error}-${index}`} className="text-sm text-red-600">{error}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
          }

          <div className="border-t pt-4 mt-4">
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={handleExport}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                📥 Export Config
              </button>
              <button
                type="button"
                onClick={handleImport}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                📤 Import Config
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (viewMode === 'json' && errors.json) return;
                if (!validate()) return;
                onSave(sanitizeConfig(formData));
                onClose();
              }}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div >
    </div >
  );
}
