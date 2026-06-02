const admin = require("firebase-admin");
const { randomUUID } = require("crypto");

const SITE_ID = process.env.SITE_ID || "taste-of-africa";
const COLLECTION = process.env.FIREBASE_COLLECTION || "site_content";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-password",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json"
};

function json(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

function requiredEnv() {
  const missing = [];
  if (!process.env.FIREBASE_PROJECT_ID) missing.push("FIREBASE_PROJECT_ID");
  if (!process.env.FIREBASE_CLIENT_EMAIL) missing.push("FIREBASE_CLIENT_EMAIL");
  if (!process.env.FIREBASE_PRIVATE_KEY) missing.push("FIREBASE_PRIVATE_KEY");
  if (!process.env.ADMIN_PASSWORD) missing.push("ADMIN_PASSWORD");
  return missing;
}

function getPrivateKey() {
  return String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
}

function getFirebaseApp() {
  if (admin.apps.length) return admin.app();
  const config = {
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: getPrivateKey()
    })
  };
  if (process.env.FIREBASE_STORAGE_BUCKET) {
    config.storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  }
  return admin.initializeApp(config);
}

function db() {
  getFirebaseApp();
  return admin.firestore();
}

function checkPassword(event, body) {
  const given = event.headers["x-admin-password"] || event.headers["X-Admin-Password"] || body.password || "";
  return given && process.env.ADMIN_PASSWORD && given === process.env.ADMIN_PASSWORD;
}

async function readContent() {
  const snap = await db().collection(COLLECTION).doc(SITE_ID).get();
  if (!snap.exists) return {};
  const data = snap.data() || {};
  return data.content || {};
}

async function saveContent(content) {
  await db().collection(COLLECTION).doc(SITE_ID).set({
    content,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return content;
}

async function uploadImageToStorage({ key, filename, mimeType, base64 }) {
  if (!process.env.FIREBASE_STORAGE_BUCKET) {
    throw new Error("Image uploads need FIREBASE_STORAGE_BUCKET in Netlify environment variables. You can still paste hosted image URLs without this.");
  }
  if (!key || !base64) throw new Error("Missing image key or file data.");

  getFirebaseApp();
  const bucket = admin.storage().bucket();
  const safeName = String(filename || `${key}.jpg`).replace(/[^a-z0-9._-]/gi, "-");
  const ext = safeName.includes(".") ? safeName.split(".").pop() : "jpg";
  const objectPath = `${SITE_ID}/${key}-${Date.now()}.${ext}`;
  const token = randomUUID();
  const file = bucket.file(objectPath);

  await file.save(Buffer.from(base64, "base64"), {
    resumable: false,
    metadata: {
      contentType: mimeType || "application/octet-stream",
      metadata: { firebaseStorageDownloadTokens: token }
    }
  });

  const encodedPath = encodeURIComponent(objectPath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders, body: "" };

  const missing = requiredEnv();
  if (missing.length) {
    return json(500, {
      error: "Live CMS is not configured yet.",
      missing,
      setup: "Add Firebase service account environment variables and ADMIN_PASSWORD in Netlify."
    });
  }

  try {
    if (event.httpMethod === "GET") {
      const content = await readContent();
      return json(200, { configured: true, content });
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      if (!checkPassword(event, body)) return json(401, { error: "Incorrect admin password." });

      if (body.action === "uploadImage") {
        const current = await readContent();
        const url = await uploadImageToStorage(body);
        current.images = current.images || {};
        current.images[body.key] = url;
        await saveContent(current);
        return json(200, { ok: true, url, content: current });
      }

      if (!body.content || typeof body.content !== "object") {
        return json(400, { error: "Missing content object." });
      }
      const saved = await saveContent(body.content);
      return json(200, { ok: true, content: saved });
    }

    return json(405, { error: "Method not allowed." });
  } catch (err) {
    return json(500, { error: err.message || "Unknown server error." });
  }
};
