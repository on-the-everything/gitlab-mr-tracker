interface JiraSearchProxyBody {
  jiraHost?: string;
  authorization?: string;
  jql?: string;
  fields?: string[];
  maxResults?: number;
  nextPageToken?: string;
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

export async function onRequestPost(context: { request: Request }) {
  let body: JiraSearchProxyBody;

  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ errorMessages: ["Invalid JSON body"] }, { status: 400 });
  }

  if (!body.jiraHost || !body.authorization || !body.jql) {
    return jsonResponse(
      { errorMessages: ["jiraHost, authorization, and jql are required"] },
      { status: 400 },
    );
  }

  let jiraUrl: URL;

  try {
    jiraUrl = new URL("/rest/api/3/search/jql", body.jiraHost);
  } catch {
    return jsonResponse({ errorMessages: ["Invalid Jira host"] }, { status: 400 });
  }

  const response = await fetch(jiraUrl.toString(), {
    method: "POST",
    headers: {
      Authorization: body.authorization,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jql: body.jql,
      fields: body.fields || ["summary", "status", "components", "fixVersions", "issuetype"],
      maxResults: body.maxResults || 100,
      nextPageToken: body.nextPageToken,
    }),
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
    },
  });
}

export function onRequestOptions() {
  return new Response(null, { status: 204 });
}
