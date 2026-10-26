import { staffOrders } from "./routes/staffOrders";
import { nurseOrders } from "./routes/nurseOrders";
import { nurseOffers } from "./routes/nurseOffers";
import { nurseEarnings } from "./routes/nurseEarnings";
import { receiptRoutes } from "./routes/receipts";
import { nurseApplication } from "./routes/nurseApplication";
import { adminRoutes } from "./routes/admin";
import { pushRoutes } from "./routes/push";
import { clientV2Routes } from "./controllers/clientV2Controller";
import express, { Request, Response } from "express";
import cors from "cors";
import fileupload from "express-fileupload";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/users";
import parentRoutes from "./routes/parents.routes";
import visitRoutes from "./routes/visits.routes";
import nursesRoutes from "./routes/nurses.routes";
import analyticsRoutes from "./routes/analytics.routes";
import reviewRoutes from "./routes/review.routes";
import catalogRoutes from "./routes/catalog.routes";
import orderRoutes from "./routes/orders.routes";
import paymentRoutes from "./routes/payments.routes";
import { specs } from "./config/swagger";
import { errorHandler, notFoundHandler } from "./middlwares/error";

// Comma-separated allowlist for production, e.g. "https://admin.example.mn"
function corsOrigin(): cors.CorsOptions["origin"] {
  if (process.env.NODE_ENV !== "production") return true; // web client, Expo web, LAN devices
  const allowed = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return allowed.length ? allowed : false;
}

/**
 * TRUST_PROXY: a hop count ("1" behind one load balancer, e.g. Render) or
 * Express address names/CIDRs ("loopback", "10.0.0.0/8"). A numeric string must
 * become a number: Express reads the string "1" as an IP address and trusts nothing,
 * so every client would share the proxy's IP (and its OTP rate limit).
 */
export function trustProxySetting(raw: string | undefined): number | string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export function createApp() {
  const app = express();

  const trustProxy = trustProxySetting(process.env.TRUST_PROXY);
  if (trustProxy !== undefined) app.set("trust proxy", trustProxy);

  // Middleware
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());
  // Over-limit files are flagged `truncated` (handled as 413 FILE_TOO_LARGE in the controller);
  // abortOnLimit is off because it answers with plain text outside the error contract.
  app.use(fileupload({ limits: { fileSize: 10 * 1024 * 1024, files: 1 } }));
  app.use(cors({ origin: corsOrigin(), credentials: true }));

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

  // Static files
  app.use("/uploads/images", express.static("src/uploads/images"));
  app.use("/uploads/coverimgs", express.static("src/uploads/coverimgs"));

  // Basic routes
  app.get("/", (req: Request, res: Response) => {
    res.json({
      message: "Team-ALPHA Backend API",
      status: "running",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/health", (req: Request, res: Response) => {
    res.status(200).json({
      message: "API is healthy",
      status: "success",
    });
  });

  // API Routes
  app.use("/api/staff/orders", staffOrders);
  app.use("/api/nurse/orders", nurseOrders);
  app.use("/api/nurse/application", nurseApplication);
  // signed, short-lived links (no login header): payout receipts
  app.use("/api/receipts", receiptRoutes);
  app.use("/api/nurse", nurseEarnings);
  app.use("/api/nurse", nurseOffers);
  app.use("/api/admin", adminRoutes);
  app.use("/api/client", clientV2Routes);
  app.use("/api/push", pushRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/parents", parentRoutes);
  app.use("/api/visits", visitRoutes);
  app.use("/api/nurses", nursesRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/review", reviewRoutes);
  app.use("/api/catalog", catalogRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api", paymentRoutes);

  app.use("/api", notFoundHandler);
  app.use(errorHandler);

  return app;
}
