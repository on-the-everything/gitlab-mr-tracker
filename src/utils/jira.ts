export function extractJiraTickets(
  ...sources: Array<string | undefined | null>
): string[] {
  // Match typical JIRA keys like PROJ-123 but avoid false-positives
  // where the ticket-like pattern is followed immediately by letters
  // (eg. revert-560bb5d1) or the key is a common branch prefix like "revert".
  const pattern = /([A-Z][A-Z0-9]+-\d+)(?![A-Za-z0-9])/gi;
  const found = new Set<string>();
  const blacklist = new Set([
    "REVERT",
    "MERGE",
    "RELEASE",
    "HOTFIX",
    "FIX",
    "PATCH",
  ]);
  for (const src of sources) {
    if (!src) continue;
    const matches = src.match(pattern);
    if (matches) {
      for (const m of matches) {
        // m is like 'ABC-123' — split to check prefix against blacklist
        const parts = m.split("-");
        const prefix = parts[0] ? parts[0].toUpperCase() : "";
        if (blacklist.has(prefix)) continue;
        found.add(m.toUpperCase());
      }
    }
  }
  return Array.from(found);
}

// Backwards-compatible single-ticket helper
export function extractJiraTicket(
  ...sources: Array<string | undefined | null>
): string | null {
  const tickets = extractJiraTickets(...sources);
  return tickets.length > 0 ? tickets[0] : null;
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

export default { extractJiraTickets, extractJiraTicket, buildJiraTicketUrl };
