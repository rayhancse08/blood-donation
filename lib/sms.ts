export async function sendSms(to: string, message: string) {
  const url = process.env.SMS_API_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") console.warn(`[sms] SMS_API_URL is not configured; message to ${to} not sent`);
    else console.info(`[sms] to=${to}\n${message}`);
    return;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SMS_API_KEY ? { Authorization: `Bearer ${process.env.SMS_API_KEY}` } : {}),
      },
      body: JSON.stringify({ to, message, sender_id: process.env.SMS_SENDER_ID ?? "BloodApp" }),
    });
    if (!response.ok) console.error(`[sms] gateway responded with ${response.status}`);
  } catch (error) {
    console.error("[sms] failed to send", error);
  }
}
