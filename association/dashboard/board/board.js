import { mountFeed } from "/helpers/feed.js";
import { db, initAssociationPage } from "/association/dashboard/common.js";

initAssociationPage(async ({ user, userData, associationId, association }) => {
  await mountFeed(document.getElementById("feedRoot"), {
    db,
    user,
    userName: userData.name || association.nome || "Associazione",
    associationId,
    role: "associazione",
    canPost: association.stato === "approvata",
    canModerate: true
  });
});