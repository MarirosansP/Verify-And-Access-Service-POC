import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    // Dev fallback: log to console
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string,
  name?: string | null
) {
  const transport = createTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@concordium.com";
  const displayName = name || toEmail;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#090E1A;font-family:'Inter','Segoe UI',system-ui,sans-serif;">
  <div style="max-width:520px;margin:40px auto;padding:0 20px;">
    <div style="margin-bottom:28px;">
      <img src="https://concordium.com/wp-content/uploads/2023/01/concordium-logo-blue.svg" alt="Concordium" height="28" style="display:block;" />
    </div>
    <div style="background:#1B2735;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:36px 32px;">
      <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#e7edf7;letter-spacing:-0.4px;">
        Reset your password
      </h1>
      <p style="margin:0 0 24px;font-size:14px;color:#9FB2D3;line-height:1.6;">
        Hi ${displayName}, we received a request to reset the password for your
        Verify &amp; Access account. Click the button below to set a new password.
      </p>
      <a href="${resetUrl}" style="display:inline-block;background:#2667FF;color:#ffffff;padding:12px 28px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:-0.2px;">
        Reset Password
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#64748b;line-height:1.6;">
        This link expires in <strong style="color:#9FB2D3;">1 hour</strong>. If you didn't request a password
        reset, you can safely ignore this email — your password won't change.
      </p>
      <p style="margin:12px 0 0;font-size:11px;color:#475569;">
        Or copy this URL into your browser:<br/>
        <span style="color:#63A1FF;word-break:break-all;">${resetUrl}</span>
      </p>
    </div>
    <p style="margin:20px 0 0;text-align:center;font-size:12px;color:#475569;">
      Powered by Concordium Verify &amp; Access
    </p>
  </div>
</body>
</html>`;

  const text = `Hi ${displayName},\n\nReset your Verify & Access password by visiting:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.\n\nPowered by Concordium Verify & Access`;

  if (!transport) {
    // Dev mode: log to console instead of sending
    console.log("\n========== PASSWORD RESET EMAIL ==========");
    console.log(`To: ${toEmail}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log("==========================================\n");
    return;
  }

  await transport.sendMail({
    from: `"Concordium Verify & Access" <${from}>`,
    to: toEmail,
    subject: "Reset your Verify & Access password",
    text,
    html,
  });
}
