import bcrypt from "bcryptjs";
import cors from "cors";
import "dotenv/config";
import express from "express";
import jwt from "jsonwebtoken";
import { MongoClient, ObjectId } from "mongodb";

const {
  MONGODB_URI,
  MONGODB_DB = "nihongo_jukebox",
  JWT_SECRET,
  INVITE_CODE,
  CORS_ORIGIN = "http://localhost:5173",
  PORT = 8787
} = process.env;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is required.");
}

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required.");
}

const app = express();
const client = new MongoClient(MONGODB_URI);
let dbPromise;

app.use(
  cors({
    origin: CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

function getDb() {
  if (!dbPromise) {
    dbPromise = client.connect().then(async () => {
      const db = client.db(MONGODB_DB);
      await Promise.all([
        db.collection("users").createIndex({ username: 1 }, { unique: true }),
        db.collection("progress").createIndex({ userId: 1 }, { unique: true })
      ]);
      return db;
    });
  }
  return dbPromise;
}

function cleanUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase();
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName || user.username
  };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      username: user.username
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

async function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({ message: "Missing token." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = new ObjectId(payload.sub);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token." });
  }
}

app.get("/api/health", async (_req, res) => {
  const db = await getDb();
  await db.command({ ping: 1 });
  res.json({ ok: true, db: MONGODB_DB });
});

app.post("/api/auth/register", async (req, res) => {
  const username = cleanUsername(req.body.username);
  const password = String(req.body.password || "");
  const displayName = String(req.body.displayName || username).trim();
  const inviteCode = String(req.body.inviteCode || "").trim();

  if (!username || username.length < 2) {
    return res.status(400).json({ message: "Username is too short." });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }
  if (INVITE_CODE && inviteCode !== INVITE_CODE) {
    return res.status(403).json({ message: "Invite code is wrong." });
  }

  const db = await getDb();
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await db.collection("users").insertOne({
      username,
      displayName,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const user = { _id: result.insertedId, username, displayName };
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Username already exists." });
    }
    throw error;
  }
});

app.post("/api/auth/login", async (req, res) => {
  const username = cleanUsername(req.body.username);
  const password = String(req.body.password || "");
  const db = await getDb();
  const user = await db.collection("users").findOne({ username });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: "Username or password is wrong." });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get("/api/progress", auth, async (req, res) => {
  const db = await getDb();
  const row = await db.collection("progress").findOne({ userId: req.userId });
  res.json({ progress: row?.progress || null });
});

app.put("/api/progress", auth, async (req, res) => {
  const progress = req.body.progress || {};
  const db = await getDb();
  await db.collection("progress").updateOne(
    { userId: req.userId },
    {
      $set: {
        progress,
        updatedAt: new Date()
      },
      $setOnInsert: {
        userId: req.userId,
        createdAt: new Date()
      }
    },
    { upsert: true }
  );
  res.json({ ok: true });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Server error." });
});

app.listen(Number(PORT), () => {
  console.log(`Nihongo Jukebox API listening on ${PORT}`);
});
