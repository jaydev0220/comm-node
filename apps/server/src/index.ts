import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./lib/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

const app = express();

// Trust proxy (for rate limiting headers behind reverse proxy)
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());
app.use(
	cors({
		origin: env.CORS_ORIGIN,
		credentials: true,
	}),
);

// Rate limiting
app.use(
	rateLimit({
		windowMs: 15 * 60 * 1000, // 15 minutes
		max: 100, // limit each IP to 100 requests per windowMs
		standardHeaders: true,
		legacyHeaders: false,
		message: {
			error: {
				code: "TOO_MANY_REQUESTS",
				message: "Too many requests, please try again later",
			},
		},
	}),
);

// Body parsing
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(cookieParser());

// Health check
app.get("/health", (_req, res) => {
	res.json({ status: "ok" });
});

// TODO: Mount API routes here
// app.use("/api", routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(env.PORT, () => {
	console.log(`🚀 Server running on http://localhost:${env.PORT}`);
	console.log(`📝 Environment: ${env.NODE_ENV}`);
});
