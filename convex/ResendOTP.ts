import Resend from "@auth/core/providers/resend";

// Console-based OTP provider for development
// In production, replace with actual Resend API calls
export const ResendOTPPasswordReset = Resend({
  id: "resend-otp-reset",
  apiKey: process.env.AUTH_RESEND_KEY ?? "dev-key",
  async generateVerificationToken() {
    // Generate a simple 8-digit code
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  },
  async sendVerificationRequest({ identifier: email, provider, token, url }) {
    // For development: Log the code to console
    console.log("\n" + "=".repeat(60));
    console.log("🔐 PASSWORD RESET CODE");
    console.log("=".repeat(60));
    console.log(`Email: ${email}`);
    console.log(`Reset Code: ${token}`);
    console.log(`Code expires in 24 hours`);
    console.log("=".repeat(60) + "\n");

    // TODO: In production, send actual email with Resend
    // Uncomment and configure when ready:
    /*
    const { Resend: ResendAPI } = await import("resend");
    const resend = new ResendAPI(process.env.AUTH_RESEND_KEY);
    await resend.emails.send({
      from: "My App <onboarding@resend.dev>",
      to: [email],
      subject: "Reset your password",
      html: `
        <h2>Reset Your Password</h2>
        <p>Your password reset code is:</p>
        <h1 style="font-size: 32px; letter-spacing: 5px;">${token}</h1>
        <p>This code will expire in 24 hours.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
    */
  },
});
