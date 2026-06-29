interface JiraProjectVersionsProxyBody {
  jiraHost?: string;
  authorization?: string;
  projectKey?: string;
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
  let body: JiraProjectVersionsProxyBody;

  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ errorMessages: ["Invalid JSON body"] }, { status: 400 });
  }

  if (!body.jiraHost || !body.authorization || !body.projectKey) {
    return jsonResponse(
      { errorMessages: ["jiraHost, authorization, and projectKey are required"] },
      { status: 400 },
    );
  }

  let jiraUrl: URL;

  try {
    jiraUrl = new URL(
      `/rest/api/3/project/${encodeURIComponent(body.projectKey)}/versions`,
      body.jiraHost,
    );
  } catch {
    return jsonResponse({ errorMessages: ["Invalid Jira host"] }, { status: 400 });
  }

  const response = await fetch(jiraUrl.toString(), {
    headers: {
      Authorization: body.authorization,
      Accept: "application/json",
    },
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
