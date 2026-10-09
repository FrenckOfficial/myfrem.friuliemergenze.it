import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

const ALLOWED_BUCKETS = Object.keys(domainMap).concat("myfrem-staff-docs");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileName, uid, bucket, contentType } = req.body;

    if (!fileName || !uid || !bucket) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return res.status(400).json({ error: "Bucket non valido" });
    }

    const filePath = `${uid}/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: filePath,
      ContentType: contentType || "application/octet-stream",
    });

    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });

    const domain = domainMap[bucket];
    const publicUrl = domain ? `${domain}/${filePath}` : null;

    return res.status(200).json({ uploadUrl, publicUrl, success: true });
  } catch (error) {
    console.error("Upload URL error:", error);
    return res.status(500).json({ error: error.message });
  }
}