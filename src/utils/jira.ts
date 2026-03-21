export function extractJiraTicket(
  ...sources: Array<string | undefined | null>
): string | null {
  const pattern = /([A-Z][A-Z0-9]+-\d+)/i;
  for (const src of sources) {
    if (!src) continue;
    const match = src.match(pattern);
    if (match && match[1]) return match[1].toUpperCase();
  }
  return null;
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
