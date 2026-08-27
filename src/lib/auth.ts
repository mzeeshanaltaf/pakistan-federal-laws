import { betterAuth } from "better-auth";
import { emailOTP, admin } from "better-auth/plugins";
import { pool } from "./db";
import { sendOtpEmail } from "./email";

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const auth = betterAuth({
  database: pool,
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  emailVerification: { sendOnSignIn: true, autoSignInAfterVerification: true },
  user: {
    additionalFields: {
      // input: false — clients can't set this on sign-up; only the admin
      // credits route (application code) and the chat route's decrement
      // ever write it after creation.
      messageCredits: { type: "number", input: false, defaultValue: 10 },
    },
  },
  plugins: [
    emailOTP({
      overrideDefaultEmailVerification: true,
      disableSignUp: true,
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 3,
      storeOTP: "hashed",
      rateLimit: { window: 60, max: 3 },
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "email-verification" && type !== "forget-password") return;
        await sendOtpEmail(email, otp, type);
      },
    }),
    admin(),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (adminEmails.includes(user.email.toLowerCase())) {
            return { data: { ...user, role: "admin" } };
          }
        },
      },
    },
  },
});
