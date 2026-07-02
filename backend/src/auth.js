import jwt from "jsonwebtoken";
import { readDb, publicUser } from "./db.js";

const jwtSecret = process.env.JWT_SECRET || "dev-only-change-me";

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: "7d" });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  try {
    const payload = jwt.verify(token, jwtSecret);
    const db = readDb();
    const user = db.users.find((item) => item.id === payload.sub);
    if (!user || user.blocked) {
      return res.status(401).json({ message: "Account unavailable" });
    }
    req.user = publicUser(user);
    next();
  } catch {
    res.status(401).json({ message: "Login required" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}
