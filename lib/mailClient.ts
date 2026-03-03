export type MailMessage = {
  id: string;
  subject: string;
  bodyPreview: string;
  body?: {
    contentType: "text" | "html";
    content: string;
  };
  receivedDateTime: string;
  webLink?: string;
  internetMessageId?: string;
  from?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
};

type GmailListResponse = {
  messages?: Array<{ id: string }>;
};

type GmailPayloadPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayloadPart[];
};

type GmailMessageResponse = {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name?: string; value?: string }>;
    body?: { data?: string };
    mimeType?: string;
    parts?: GmailPayloadPart[];
  };
};

function decodeBase64Url(input?: string) {
  if (!input) {
    return "";
  }

  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  const withPadding = normalized + "=".repeat(paddingLength);
  return Buffer.from(withPadding, "base64").toString("utf8");
}

function extractBodyFromPayload(payload?: GmailMessageResponse["payload"]) {
  if (!payload) {
    return { contentType: "text" as const, content: "" };
  }

  const stack: GmailPayloadPart[] = [...(payload.parts ?? [])];
  let html = "";
  let text = "";

  while (stack.length > 0) {
    const part = stack.pop();
    if (!part) {
      continue;
    }

    if (part.parts?.length) {
      stack.push(...part.parts);
    }

    if (part.mimeType === "text/html" && part.body?.data) {
      html = decodeBase64Url(part.body.data);
    } else if (part.mimeType === "text/plain" && part.body?.data) {
      text = decodeBase64Url(part.body.data);
    }
  }

  if (!html && !text && payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/html") {
      html = decoded;
    } else {
      text = decoded;
    }
  }

  if (html) {
    return { contentType: "html" as const, content: html };
  }

  return { contentType: "text" as const, content: text };
}

function headerValue(headers: Array<{ name?: string; value?: string }> | undefined, name: string) {
  if (!headers) {
    return undefined;
  }

  return headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value;
}

function parseFromHeader(fromHeader?: string) {
  if (!fromHeader) {
    return undefined;
  }

  const match = fromHeader.match(/^(.*)<([^>]+)>$/);
  if (!match) {
    return {
      name: undefined,
      address: fromHeader.trim(),
    };
  }

  return {
    name: match[1].trim().replace(/^"|"$/g, ""),
    address: match[2].trim(),
  };
}

async function fetchGmailMessage(accessToken: string, id: string) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch Gmail message ${id}: ${response.status} ${text}`);
  }

  return (await response.json()) as GmailMessageResponse;
}

export async function fetchRecentMessages(accessToken: string, top = 50) {
  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${top}&q=newer_than:30d`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!listResponse.ok) {
    const text = await listResponse.text();
    throw new Error(`Failed to list Gmail messages: ${listResponse.status} ${text}`);
  }

  const listData = (await listResponse.json()) as GmailListResponse;
  const ids = listData.messages?.map((message) => message.id) ?? [];

  const fullMessages = await Promise.all(ids.map((id) => fetchGmailMessage(accessToken, id)));

  return fullMessages.map((message) => {
    const headers = message.payload?.headers;
    const subject = headerValue(headers, "Subject") ?? "(no subject)";
    const from = parseFromHeader(headerValue(headers, "From"));
    const internetMessageId = headerValue(headers, "Message-Id");
    const receivedMs = Number(message.internalDate ?? Date.now());
    const body = extractBodyFromPayload(message.payload);

    return {
      id: message.id,
      subject,
      bodyPreview: message.snippet ?? "",
      body,
      receivedDateTime: new Date(receivedMs).toISOString(),
      webLink: `https://mail.google.com/mail/u/0/#inbox/${message.id}`,
      internetMessageId,
      from: from
        ? {
            emailAddress: {
              name: from.name,
              address: from.address,
            },
          }
        : undefined,
    } satisfies MailMessage;
  });
}
