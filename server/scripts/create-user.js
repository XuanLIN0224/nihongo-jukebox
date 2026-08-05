import bcrypt from "bcryptjs";
import "dotenv/config";
import { MongoClient } from "mongodb";

const [usernameArg, passwordArg, displayNameArg] = process.argv.slice(2);

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is required.");
}

if (!usernameArg || !passwordArg) {
  console.error("Usage: npm run create-user -- <username> <password> [displayName]");
  process.exit(1);
}

const username = usernameArg.trim().toLowerCase();
const passwordHash = await bcrypt.hash(passwordArg, 12);
const client = new MongoClient(process.env.MONGODB_URI);
const dbName = process.env.MONGODB_DB || "nihongo_jukebox";

await client.connect();
const db = client.db(dbName);
await db.collection("users").createIndex({ username: 1 }, { unique: true });
await db.collection("users").updateOne(
  { username },
  {
    $set: {
      username,
      displayName: displayNameArg || username,
      passwordHash,
      updatedAt: new Date()
    },
    $setOnInsert: {
      createdAt: new Date()
    }
  },
  { upsert: true }
);
await client.close();

console.log(`User ready: ${username}`);
