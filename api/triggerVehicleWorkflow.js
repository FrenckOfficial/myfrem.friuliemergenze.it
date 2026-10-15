import { preflight, requireStaff, db, fail, HttpError } from "./_lib/server.js";

const WORKFLOW_URL = "https://api.github.com/repos/FrenckOfficial/myfrem.friuliemergenze.it/actions/workflows/push-vehicle-github.yml/dispatches";

export default async function handler(request, response) {
  if (!preflight(request, response)) return;

  try {
    await requireStaff(request);

    const draftId = String(request.body?.draftId || "");
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(draftId)) throw new HttpError(400, "draftId non valido");

    const draft = await db().doc(`vehiclesDraft/${draftId}`).get();
    if (!draft.exists) throw new HttpError(404, "Bozza non trovata");

    const token = process.env.GT_TOKEN;
    if (!token) throw new HttpError(500, "Token GitHub non configurato");

    const githubResponse = await fetch(WORKFLOW_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ref: "main", inputs: { draftId } })
    });

    if (githubResponse.status === 204) return response.status(204).send("");

    const body = await githubResponse.text();
    console.error("GitHub API Error:", githubResponse.status, body);
    throw new HttpError(502, `GitHub API error: ${githubResponse.status}`);
  } catch (error) {
    return fail(response, error);
  }
}
