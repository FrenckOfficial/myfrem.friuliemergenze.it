import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
});

const domainMap = {
  "myfrem-staff-docs": "https://staffdocs.cdn.friuliemergenze.it",
  "myfrem-photos": "https://cdn.friuliemergenze.it",
  "myfrem-reports": "https://rpt.cdn.friuliemergenze.it",
  "profile-pics": "https://profilepics.cdn.friuliemergenze.it",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileBuffer, fileName, uid, bucket, contentType } = req.body;

    if (!fileBuffer || !fileName || !uid || !bucket) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const filePath = `${uid}/${fileName}`;

    const buffer = Buffer.isBuffer(fileBuffer)
      ? fileBuffer
      : Buffer.from(fileBuffer, "base64");

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: filePath,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    });

    await r2.send(command);

    const domain = domainMap[bucket];
    const imageUrl = `${domain}/${filePath}`;

    return res.status(200).json({ url: imageUrl, success: true });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: error.message });
  }
}