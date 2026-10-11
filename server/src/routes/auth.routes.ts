import {
  requestOtp,
  verifyOtp,
  refreshSession,
  logoutSession,
} from "../controllers/otpController";
import { Router } from "express";
import {
  signupController,
  loginController,
} from "../controllers/authController";

const router = Router();
router.post("/otp/request", requestOtp);
router.post("/otp/verify", verifyOtp);
router.post("/refresh", refreshSession);
router.post("/logout", logoutSession);

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     tags: [Authentication]
 *     summary: Create new user account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               role: { type: string, enum: [CHILD, NURSE, ADMIN] }
 *     responses:
 *       201:
 *         description: User created successfully
 */
router.post("/signup", signupController);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post("/login", loginController);

export default router;
