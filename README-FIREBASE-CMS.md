# Taste of Africa Live CMS with Firebase + Netlify

This version uses your existing Firebase project instead of Supabase.

## What this does

- Netlify hosts the public website.
- A Netlify Function at `/.netlify/functions/content` talks securely to Firebase.
- Public visitors fetch the latest menu, prices, hours, specials, photos, and announcements on page load.
- Admin dashboard edits save to Firebase.
- Normal content edits do not require a Netlify redeploy.
- Only actual code, layout, or design changes require redeploying.

## Firebase setup

Use Firebase Firestore for content storage.

1. Open your Firebase project.
2. Go to **Build → Firestore Database**.
3. Create/enable Firestore if it is not already enabled.
4. Go to **Project settings → Service accounts**.
5. Click **Generate new private key**.
6. Open the downloaded JSON file.

You will use these JSON values in Netlify environment variables:

- `project_id`
- `client_email`
- `private_key`

## Optional Firebase Storage setup for photo uploads

If you want the admin dashboard to upload image files directly:

1. In Firebase, go to **Build → Storage**.
2. Enable Firebase Storage.
3. Find your bucket name. It usually looks like:
   `your-project-id.appspot.com` or `your-project-id.firebasestorage.app`.
4. Add that bucket name to Netlify as `FIREBASE_STORAGE_BUCKET`.

If you skip this, you can still paste hosted image URLs in the admin dashboard.

## Netlify environment variables

In Netlify, open your site:

**Site configuration → Environment variables**

Add:

```txt
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
ADMIN_PASSWORD=choose_your_admin_password
FIREBASE_STORAGE_BUCKET=your_bucket_name_optional
SITE_ID=taste-of-africa
FIREBASE_COLLECTION=site_content
```

Important: keep the quotes around `FIREBASE_PRIVATE_KEY` if Netlify accepts it that way. The key must include the `\n` line breaks exactly like the JSON file shows them.

## Deploy

Upload/deploy this whole folder to Netlify, not just `index.html`.

The folder must include:

```txt
index.html
package.json
netlify/functions/content.js
firebase/firestore-notes.txt
README-FIREBASE-CMS.md
```

After the first deploy, admin content edits should save live through Firebase without redeploying.
