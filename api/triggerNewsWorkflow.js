export default async (request, response) => {
  try {
    console.log("🚀 Function triggerWorkflow avviata");
    console.log("METHOD:", request.method);
    console.log("URL:", request.url);

    let rawBody;
    
    if (request.body instanceof Buffer) {
      rawBody = request.body.toString('utf-8');
    } else if (typeof request.body === 'string') {
      rawBody = request.body;
    } else if (request.body && typeof request.body === 'object') {
      rawBody = JSON.stringify(request.body);
    } else {
      try {
        rawBody = await request.text();
      } catch (e) {
        console.error("❌ Non riesco a leggere il body:", e);
        return response.status(400).json({ error: "Body non valido" });
      }
    }

    console.log("RAW BODY:", rawBody);

    if (!rawBody) {
      return response.status(400).json({ error: "Body vuoto" });
    }

    let draftId;
    const token = process.env.GT_TOKEN;

    console.log("TOKEN ESISTE:", !!token);
    console.log("TOKEN LENGTH:", token?.length);

    try {
      const parsed = JSON.parse(rawBody);
      draftId = parsed.draftId;
    } catch (err) {
      console.error("JSON non valido:", err);
      return response.status(400).json({ error: "JSON non valido" });
    }

    if (!draftId) {
      console.error("❌ draftId mancante");
      return response.status(400).json({ error: "draftId mancante" });
    }

    console.log("📦 Draft ID:", draftId);

    if (!token) {
      console.error("❌ GITHUB_PAT non configurato");
      return response.status(500).json({ error: "Token GitHub non configurato" });
    }

    const githubResponse = await fetch(
      "https://api.github.com/repos/FrenckOfficial/myfrem.friuliemergenze.it/actions/workflows/push-news-github.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            draftId: String(draftId)
          }
        })
      }
    );

    const body = await githubResponse.text();

    console.log("📨 GitHub status:", githubResponse.status);
    console.log("📨 GitHub body:", body);

    if (githubResponse.status === 204) {
      console.log("✅ Workflow triggered successfully");
      return response.status(204).send("");
    }

    if (!githubResponse.ok) {
      console.error("❌ GitHub API Error:", githubResponse.status, body);
      return response.status(githubResponse.status).json({
        error: `GitHub API error: ${githubResponse.status}`,
        details: body
      });
    }

    return response.status(githubResponse.status).json(body);

  } catch (error) {
    console.error("❌ Errore non gestito:", error.message);
    console.error("Stack:", error.stack);
    return response.status(500).json({
      error: "Errore interno della funzione",
      message: error.message
    });
  }
};