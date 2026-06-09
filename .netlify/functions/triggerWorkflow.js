export default async (request, context) => {
  console.log("🚀 Function triggerWorkflow avviata");

  console.log("METHOD:", request.method);
  console.log("URL:", request.url);

  const rawBody = await request.text();

  console.log("RAW BODY:", rawBody);

  if (!rawBody) {
    return new Response("Body vuoto", {
      status: 400
    });
  }

  let draftId;

  try {
    ({ draftId } = JSON.parse(rawBody));
  } catch (err) {
    console.error("JSON non valido:", err);

    return new Response("JSON non valido", {
      status: 400
    });
  }

  console.log("📦 Draft ID:", draftId);

  const githubResponse = await fetch(
    "https://api.github.com/repos/FrenckOfficial/temp.myfrem.friuliemergenze.it/actions/workflows/push-vehicle-github.yml/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Netlify.env.get("GITHUB_PAT")}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          draftId
        }
      })
    }
  );

  const body = await githubResponse.text();

  console.log("📨 GitHub status:", githubResponse.status);
  console.log("📨 GitHub body:", body);

  return new Response(body, {
    status: githubResponse.status,
    headers: {
      "content-type": "application/json"
    }
  });
};