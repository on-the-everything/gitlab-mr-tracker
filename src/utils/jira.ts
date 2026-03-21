export function extractJiraTicket(branchName?: string): string | null {
  if (!branchName) return null;
  // Common Jira ticket pattern: ABC-123 or ABCD-1234 (upper-case project key)
  const match = branchName.match(/([A-Z][A-Z0-9]+-\d+)/);
  return match ? match[1] : null;
}

export function buildJiraTicketUrl(
  ticket: string,
  jiraHost?: string,
): string | null {
  if (!ticket) return null;
  if (!jiraHost) return null;
  // Ensure no trailing slash
  const host = jiraHost.replace(/\/$/, "");
  return `${host}/browse/${ticket}`;
}

export default { extractJiraTicket, buildJiraTicketUrl };
