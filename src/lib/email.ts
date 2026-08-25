import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// RESEND_FROM_EMAIL can arrive quoted ("App <noreply@...>") in some deploy
// environments even though it's unquoted locally — strip surrounding quotes
// defensively, or every send 422s in production with no local repro.
function fromAddress(): string {
  const raw = process.env.RESEND_FROM_EMAIL ?? "";
  return raw.replace(/^"(.*)"$/, "$1");
}

type OtpType = "email-verification" | "forget-password";

const SUBJECTS: Record<OtpType, string> = {
  "email-verification": "Verify your email — Qanoon",
  "forget-password": "Reset your password — Qanoon",
};

export async function sendOtpEmail(email: string, otp: string, type: OtpType) {
  await resend.emails.send({
    from: fromAddress(),
    to: email,
    subject: SUBJECTS[type],
    text: `Your verification code is ${otp}. It expires in 10 minutes.`,
  });
}
