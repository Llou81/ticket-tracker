import { Router } from "express";
import { z } from "zod";
import { resendByEmail, resendByToken, signUp, verifyEmail } from "../services/auth";

export const authRouter = Router();

const email = z
  .string({ required_error: "Email is required." })
  .trim()
  .toLowerCase()
  .max(254, "Email is too long.")
  .email("Enter a valid email address.");

const password = z
  .string({ required_error: "Password is required." })
  .min(8, "Password must be at least 8 characters.")
  .max(1024, "Password is too long.");

const token = z.string({ required_error: "Token is required." }).min(1, "Token is required.").max(200);

authRouter.post("/signup", async (req, res) => {
  const body = z.object({ email, password }).parse(req.body);
  const result = await signUp(body.email, body.password);
  res.status(201).json(result);
});

authRouter.post("/verify-email", async (req, res) => {
  const body = z.object({ token }).parse(req.body);
  const status = await verifyEmail(body.token);
  res.json({ status });
});

authRouter.post("/resend-verification", async (req, res) => {
  const body = z.union([z.object({ token }), z.object({ email })]).parse(req.body);
  if ("token" in body) {
    await resendByToken(body.token);
  } else {
    await resendByEmail(body.email);
  }
  res.status(202).json({
    message: "If the account exists and is not yet verified, a new verification email has been sent.",
  });
});
