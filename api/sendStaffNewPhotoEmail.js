import { FieldValue } from "firebase-admin/firestore";
import { preflight, requireUser, getUser, getPhoto, sendMail, escapeHtml, fullName, fail, HttpError } from "./_lib/server.js";

const STAFF_GROUP = "GruppoMembriStaff@gruppi.friuliemergenze.it";

export default async function handler(req, res) {
  if (!preflight(req, res)) return;

  try {
    const decoded = await requireUser(req);
    const { ref, photo } = await getPhoto(req.body?.photoId);

    if (photo.userId !== decoded.uid) throw new HttpError(403, "Puoi segnalare solo le tue foto");

    const claimed = await ref.firestore.runTransaction(async (tx) => {
      const fresh = await tx.get(ref);
      if (fresh.data()?.staffNotifiedAt) return false;
      tx.update(ref, { staffNotifiedAt: FieldValue.serverTimestamp() });
      return true;
    });

    if (!claimed) return res.status(200).json({ success: true, alreadySent: true });

    const user = await getUser(decoded.uid);
    const userName = fullName(user);
    const photoName = photo.vehicleModel || "Foto";

    await sendMail({
      to: STAFF_GROUP,
      toName: STAFF_GROUP,
      subject: `${userName} - ${photoName}: Nuova foto in attesa di moderazione`,
      htmlContent: staffEmailHtml({
        userName,
        userEmail: user?.email || decoded.email || "",
        photoName,
        location: photo.location,
        photoUrl: /^https:\/\//i.test(photo.url || "") ? photo.url : ""
      })
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return fail(res, error);
  }
}

function staffEmailHtml({ userName, userEmail, photoName, location, photoUrl }) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
        <table style="max-width:520px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
          <tr><td style="padding:35px;text-align:center;">
            <img src="https://www.friuliemergenze.it/assets/logo.png" style="width:80px;margin-bottom:20px;" loading="lazy">
            <h1 style="color:#00d4e8;margin:0;font-size:28px;">Nuova foto caricata</h1>
            <p style="font-size:16px;color:#333;margin-top:25px;text-align:left;">
              <b>Utente:</b> ${escapeHtml(userName)}<br>
              <b>Email:</b> ${escapeHtml(userEmail)}<br>
              <b>Foto:</b> ${escapeHtml(photoName)}${location ? `<br><b>Sede:</b> ${escapeHtml(location)}` : ""}
            </p>
            ${photoUrl ? `<p style="text-align:center;margin-top:30px;"><img src="${escapeHtml(photoUrl)}" style="width:100%;max-width:400px;"></p>` : ""}
            <p style="margin-top:25px;"><a href="https://myfrem.friuliemergenze.it/staff/dashboard/photos/" style="display:inline-block;padding:12px 20px;background:#00d4e8;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:bold;">Vai alla moderazione</a></p>
            <p style="font-size:11px;color:#999;margin-top:25px;line-height:1.5;">
              MyFrEM · Friuli Emergenze<br>
              <a href="https://friuliemergenze.it" style="color:#00d4e8;text-decoration:none;">friuliemergenze.it</a> ·
              <a href="mailto:info@friuliemergenze.it" style="color:#00d4e8;text-decoration:none;">info@friuliemergenze.it</a>
            </p>
          </td></tr>
        </table>
      </td></tr></table>
    </div>`;
}
