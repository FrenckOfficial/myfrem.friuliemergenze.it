import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { preflight, requireUser, getUser, STAFF_ROLES, fail, HttpError } from "./_lib/server.js";

const r2 = new S3Client({
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
});

const domainMap = {
  "myfrem-photos": "https://cdn.friuliemergenze.it",
  "myfrem-reports": "https://rpt.cdn.friuliemergenze.it",
  "profile-pics": "https://profilepics.cdn.friuliemergenze.it",
  "associations-images": "https://cdn.enti-associazioni.friuliemergenze.it",
  "interventi": "https://interventi.friuliemergenze.it",
};

const MB = 1024 * 1024;

const DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/octet-stream"
];

const BUCKETS = {
  "myfrem-photos": { staffOnly: false, images: true, maxBytes: 25 * MB },
  "profile-pics": { staffOnly: false, images: true, maxBytes: 10 * MB },
  "associations-images": { staffOnly: false, images: true, videos: true, maxBytes: 10 * MB, videoMaxBytes: 150 * MB },
  "myfrem-reports": { staffOnly: true, images: true, documents: true, maxBytes: 25 * MB },
  "interventi": { staffOnly: true, images: true, maxBytes: 25 * MB },
  "myfrem-staff-docs": { staffOnly: true, images: true, documents: true, maxBytes: 50 * MB },
};

function safeFileName(name) {
  const base = String(name || "file").split(/[\\/]/).pop();
  const cleaned = base.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (cleaned || "file").slice(-100);
}

const VIDEO_RE = /^video\/(mp4|webm|quicktime)$/i;

function allowedType(rules, contentType) {
  if (rules.images && /^image\/(png|jpe?g|webp|gif|heic|heif)$/i.test(contentType)) return true;
  if (rules.videos && VIDEO_RE.test(contentType)) return true;
  return !!rules.documents && DOCUMENT_TYPES.includes(contentType);
}

export default async function handler(req, res) {
  if (!preflight(req, res)) return;

  try {
    const decoded = await requireUser(req);
    const { fileName, bucket, contentType, size } = req.body || {};

    const rules = BUCKETS[bucket];
    if (!rules) throw new HttpError(400, "Bucket non valido");

    if (rules.staffOnly) {
      const user = await getUser(decoded.uid);
      if (!user || !STAFF_ROLES.includes(user.role)) throw new HttpError(403, "Riservato allo staff");
    }

    const type = String(contentType || (rules.documents ? "application/octet-stream" : "")).toLowerCase();
    if (!allowedType(rules, type)) throw new HttpError(415, "Tipo di file non consentito");

    const bytes = Number(size);
    if (!Number.isInteger(bytes) || bytes <= 0) throw new HttpError(400, "Dimensione del file mancante");
    const maxBytes = VIDEO_RE.test(type) ? rules.videoMaxBytes : rules.maxBytes;
    if (bytes > maxBytes) throw new HttpError(413, `File troppo grande (massimo ${maxBytes / MB} MB)`);

    const filePath = `${decoded.uid}/${Date.now()}-${safeFileName(fileName)}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: filePath,
      ContentType: type,
      ContentLength: bytes,
    });

    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });

    const domain = domainMap[bucket];
    const publicUrl = domain ? `${domain}/${filePath}` : null;

    return res.status(200).json({ uploadUrl, publicUrl, success: true });
  } catch (error) {
    return fail(res, error);
  }
}
