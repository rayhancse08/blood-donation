export async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") console.warn(`[email] RESEND_API_KEY is not configured; email to ${to} not sent`);
    else console.info(`[email] to=${to} subject=${subject}\n${html.replace(/<[^>]+>/g, " ")}`);
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Blood App <no-reply@bloodapp.local>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!response.ok) console.error(`[email] provider responded with ${response.status}`);
  } catch (error) {
    console.error("[email] failed to send", error);
  }
}
