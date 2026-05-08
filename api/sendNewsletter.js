export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userEmail, htmlContent, title } = req.body;

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          name: "Friuli Emergenze",
          email: "newsletter@friuliemergenze.it"
        },
        to: [{ email: userEmail }],
        subject: title,
        htmlContent,
        replyTo: {
          email: "soem@friuliemergenze.it",
          name: "Friuli Emergenze"
        }
      })
    });

    const data = await response.json();

    console.log("📨 Inviata:", userEmail);

    return res.status(200).json({ success: true, data });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false });
  }
}