export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { name, email, phone, subject, message, honey } = body;

    // Honeypot: silently succeed for likely bots.
    if (honey) {
      return res.status(200).json({ success: true });
    }

    if (!name || !email || !subject || !message) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.CONTACT_TO_EMAIL || "info@wildchildstudios.com";
    const fromEmail =
      process.env.CONTACT_FROM_EMAIL || "WildChild Studios <onboarding@resend.dev>";

    if (!apiKey) {
      return res
        .status(500)
        .json({ success: false, error: "RESEND_API_KEY is not configured" });
    }

    const safe = (v) =>
      String(v || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const emailSubject = `Inquiry from Website Wildchildstudios: ${safe(subject)}`;

    const html = `
      <h2>New Website Inquiry</h2>
      <p><strong>Name:</strong> ${safe(name)}</p>
      <p><strong>Email:</strong> ${safe(email)}</p>
      <p><strong>Phone:</strong> ${safe(phone)}</p>
      <p><strong>Subject:</strong> ${safe(subject)}</p>
      <p><strong>Message:</strong><br>${safe(message).replace(/\n/g, "<br>")}</p>
    `;

    const sendEmail = async (fromValue) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromValue,
          to: [toEmail],
          reply_to: email,
          subject: emailSubject,
          html,
        }),
      });

    let resendResp = await sendEmail(fromEmail);

    // If custom domain is not verified yet, fall back to Resend's onboarding sender.
    if (!resendResp.ok) {
      const firstErrorText = await resendResp.text();
      if (
        resendResp.status === 403 &&
        firstErrorText.toLowerCase().includes("domain is not verified") &&
        !String(fromEmail).includes("onboarding@resend.dev")
      ) {
        resendResp = await sendEmail("WildChild Studios <onboarding@resend.dev>");
      } else {
        return res.status(502).json({
          success: false,
          error: "Mail provider error",
          details: firstErrorText,
        });
      }
    }

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      return res
        .status(502)
        .json({ success: false, error: "Mail provider error", details: errText });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Server error",
      details: error?.message || "Unknown error",
    });
  }
}

