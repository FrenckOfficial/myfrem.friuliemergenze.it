export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const {
      userEmail,
      htmlContent,
      title
    } = req.body;

    if (!userEmail || !htmlContent) {
      return res.status(400).json({
        success: false,
        error: "Parametri mancanti"
      });
    }

    const response = await fetch(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.BREVO_API_KEY_VERIFICATION
        },

        body: JSON.stringify({

          sender: {
            name: "Piattaforma MyFrEM - Friuli Emergenze",
            email: "verification@myfrem.friuliemergenze.it"
          },

          to: [
            {
              email: userEmail
            }
          ],

          subject:
            title ||
            "Verifica il tuo indirizzo email - MyFrEM",

          htmlContent,

          replyTo: {
            email: "soem@friuliemergenze.it",
            name: "Piattaforma MyFrEM - Friuli Emergenze"
          }

        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Brevo error:", data);

      return res.status(response.status).json({
        success: false,
        error: data
      });
    }

    console.log("📨 Email inviata a:", userEmail);

    return res.status(200).json({
      success: true,
      data
    });

  } catch (err) {

    console.error("❌ Server error:", err);

    return res.status(500).json({
      success: false,
      error: "Errore interno del server"
    });

  }
}