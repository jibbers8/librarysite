import { Client } from "@microsoft/microsoft-graph-client";

export type GraphMessage = {
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

type GraphMessagesResponse = {
  value: GraphMessage[];
};

export function createGraphClient(accessToken: string) {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

export async function fetchRecentMessages(accessToken: string, top = 50) {
  const graphClient = createGraphClient(accessToken);

  const response = await graphClient
    .api("/me/messages")
    .top(top)
    .orderby("receivedDateTime desc")
    .select(
      "id,subject,bodyPreview,body,receivedDateTime,webLink,internetMessageId,from"
    )
    .get();

  return (response as GraphMessagesResponse).value;
}
