import { AppConfig, JiraIssue, JiraVersion } from "../types";

interface JiraSearchIssue {
  key: string;
  fields?: {
    summary?: string;
    status?: {
      name?: string;
    };
    components?: Array<{
      name?: string;
    }>;
    fixVersions?: Array<{
      name?: string;
    }>;
    issuetype?: {
      name?: string;
    };
  };
}

interface JiraSearchResponse {
  issues?: JiraSearchIssue[];
  isLast?: boolean;
  nextPageToken?: string;
}

interface JiraVersionResponse {
  id: string;
  name: string;
  archived?: boolean;
  released?: boolean;
  releaseDate?: string;
}

class JiraAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public statusText?: string,
  ) {
    super(message);
    this.name = "JiraAPIError";
  }
}

function getJiraAuthHeader(config: AppConfig) {
  return `Basic ${btoa(`${config.jiraEmail}:${config.jiraAccessToken}`)}`;
}

function buildJiraIssueUrl(config: AppConfig, key: string) {
  return `${config.jiraHost?.replace(/\/$/, "")}/browse/${key}`;
}

async function fetchJiraSearchPage(
  config: AppConfig,
  jql: string,
  nextPageToken?: string,
): Promise<JiraSearchResponse> {
  if (!config.jiraHost || !config.jiraEmail || !config.jiraAccessToken) {
    throw new JiraAPIError("Configure Jira host, email, and access token first.");
  }

  const response = await fetch("/api/jira/search", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jiraHost: config.jiraHost,
      authorization: getJiraAuthHeader(config),
      jql,
      fields: ["summary", "status", "components", "fixVersions", "issuetype"],
      maxResults: 100,
      nextPageToken,
    }),
  });

  if (!response.ok) {
    let message = `Jira API error: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (Array.isArray(errorData?.errorMessages) && errorData.errorMessages.length > 0) {
        message = errorData.errorMessages.join(", ");
      } else if (typeof errorData?.message === "string") {
        message = errorData.message;
      }
    } catch {
      // Keep the HTTP status message when Jira does not return JSON.
    }

    throw new JiraAPIError(message, response.status, response.statusText);
  }

  return response.json();
}

async function fetchJiraProxy(
  path: string,
  config: AppConfig,
  extraBody: Record<string, unknown> = {},
): Promise<Response> {
  if (!config.jiraHost || !config.jiraEmail || !config.jiraAccessToken) {
    throw new JiraAPIError("Configure Jira host, email, and access token first.");
  }

  return fetch(path, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jiraHost: config.jiraHost,
      authorization: getJiraAuthHeader(config),
      ...extraBody,
    }),
  });
}

async function parseJiraResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Jira API error: ${response.statusText}`;
    let parsedJsonError = false;
    try {
      const errorData = await response.json();
      parsedJsonError = true;
      if (Array.isArray(errorData?.errorMessages) && errorData.errorMessages.length > 0) {
        message = errorData.errorMessages.join(", ");
      } else if (typeof errorData?.message === "string") {
        message = errorData.message;
      }
    } catch {
      // Keep the HTTP status message when Jira does not return JSON.
    }

    if (response.status === 404 && !parsedJsonError) {
      message =
        "Jira proxy route not found. Restart dev server or use the active Vite port.";
    }

    throw new JiraAPIError(message, response.status, response.statusText);
  }

  return response.json();
}

function normalizeJiraIssue(config: AppConfig, issue: JiraSearchIssue): JiraIssue {
  const fields = issue.fields || {};

  return {
    key: issue.key,
    url: buildJiraIssueUrl(config, issue.key),
    summary: fields.summary || issue.key,
    status: fields.status?.name || "Unknown",
    components:
      fields.components
        ?.map((component) => component.name?.trim())
        .filter((component): component is string => Boolean(component)) || [],
    fixVersions:
      fields.fixVersions
        ?.map((version) => version.name?.trim())
        .filter((version): version is string => Boolean(version)) || [],
    issueType: fields.issuetype?.name || "Unknown",
  };
}

function quoteJqlValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export async function fetchJiraIssuesByVersion(
  config: AppConfig,
  version: string,
): Promise<JiraIssue[]> {
  const jql = `fixVersion = ${quoteJqlValue(version)} ORDER BY key ASC`;
  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;

  do {
    const data = await fetchJiraSearchPage(config, jql, nextPageToken);
    issues.push(
      ...(data.issues || []).map((issue) => normalizeJiraIssue(config, issue)),
    );
    nextPageToken = data.isLast ? undefined : data.nextPageToken;
  } while (nextPageToken);

  return issues;
}

export async function fetchJiraProjectVersions(
  config: AppConfig,
): Promise<JiraVersion[]> {
  if (!config.jiraProjectKey) {
    throw new JiraAPIError("Configure Jira project key first.");
  }

  const response = await fetchJiraProxy("/api/jira/project-versions", config, {
    projectKey: config.jiraProjectKey,
  });
  const versions = await parseJiraResponse<JiraVersionResponse[]>(response);

  return versions
    .map((version) => ({
      id: version.id,
      name: version.name,
      archived: Boolean(version.archived),
      released: Boolean(version.released),
      releaseDate: version.releaseDate,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export { JiraAPIError };
