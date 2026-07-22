export default async function handler(req, res) {
  console.log(req.method);
  console.log(req.body);
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userName, staffContent } = req.body;

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          name: "Friuli Emergenze",
          email: "autosystem@friuliemergenze.it"
        },
        to: [{ 
          name: "GruppoMembriStaff@gruppi.friuliemergenze.it",
          email: "GruppoMembriStaff@gruppi.friuliemergenze.it" 
        }],
        subject: "Nuovo utente registrato su MyFrEM: " + userName,
        staffContent,
        replyTo: {
          email: "info@friuliemergenze.it",
          name: "Info - Friuli Emergenze"
        }
      })
    });

    const data = await response.json();

    console.log("📨 Inviata:", response.body.to.name);

    return res.status(200).json({ success: true, data });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false });
  }
}