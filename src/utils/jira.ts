export function extractJiraTickets(
  ...sources: Array<string | undefined | null>
): string[] {
  const pattern = /([A-Z][A-Z0-9]+-\d+)/gi;
  const found = new Set<string>();
  for (const src of sources) {
    if (!src) continue;
    const matches = src.match(pattern);
    if (matches) {
      for (const m of matches) {
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
