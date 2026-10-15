import { mountFeed } from "/helpers/feed.js";
import { db, initAssociationPage } from "/association/dashboard/common.js";

initAssociationPage(async ({ user, userData, associationId, association }) => {
  const canPost = association.stato === "approvata";
  document.getElementById("boardNotice").hidden = canPost;

  const name = association.nome || userData.name || "Associazione";

  await mountFeed(document.getElementById("feedRoot"), {
    db,
    user,
    author: { name, photoURL: association.logoUrl || "" },
    memberships: [{ id: associationId, name, role: "associazione" }],
    scope: { type: "association", id: associationId, name },
    composer: canPost,
    canModerate: true
  });
});
