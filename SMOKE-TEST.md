# SMOKE-TEST.md

Run before merging `hardening/security-and-repo-reorg`. `$API` = server base URL (e.g. http://localhost:8000), `$WEB` = website base URL (e.g. http://localhost:3000).

## Registration & Authentication

1. **Web login with real Supabase account**
   - Log in via the website login form using a real Supabase credential.
   - Confirm `GET $API/user` returns your profile (JWT HS256 verification regression check).

2. **Reject forged and expired tokens**
   - Run: `curl -s -o /dev/null -w '%{http_code}' $API/user -H "Authorization: Bearer eyJhbGciOi...FORGED"` (any malformed token) → returns **401**
   - Run: `curl -s -o /dev/null -w '%{http_code}' $API/user -H "Authorization: Bearer $EXPIRED_TOKEN"` (genuine expired JWT) → returns **401**

3. **Serverside-create endpoint restricted to STUDENT role**
   - Run: `curl -XPOST $API/user/serverside-create -H 'content-type: application/json' -d '{"email":"x@y.co","password":"password123","fullName":"Mallory","role":"ADMIN"}'`
   - Confirm the created user's role is **STUDENT** (check in DB or via `GET $API/user/:id` as an admin)
   - Verify no ADMIN user was created (privilege escalation prevented).

4. **Web sign-up form blocks role selection**
   - Complete the sign-up flow via the website form.
   - Confirm a new **STUDENT** account is created.
   - Confirm the form displays **no role dropdown** during sign-up.

## Rate Limiting & Session Enforcement

5. **TTS endpoint requires valid session**
   - Run: `curl -XPOST $WEB/api/tts -d '{"text":"hello"}'` with no session cookie → returns **401**
   - Run: `curl -XPOST $WEB/api/tts -d '{"text":"hello"}'` with a valid session cookie → returns audio data (200)
   - Run ~25 rapid authenticated calls to `$WEB/api/tts` in quick succession → some requests return **429** (rate limit enforced).

## Game Session Authorization

6. **Game session requires class enrollment**
   - As a user NOT enrolled in the hosting class, join a game session and submit an answer → returns **403**
   - As an enrolled student in the hosting class, join and submit an answer → works (**200**).

## Dev-only JWT Endpoint

7. **Dev-login requires dev mode**
   - With `NODE_ENV=development` (locally): `POST $API/jwt` with the correct `SECRET_PASS` returns a valid token (**200**)
   - Set `NODE_ENV=production` (locally): `POST $API/jwt` with the same `SECRET_PASS` returns **403**

## Dead-Letter Queue Handling

8. **Malformed messages route to DLQ**
   - Publish a malformed grading message to the RabbitMQ queue.
   - Confirm it lands in `grade_queue.dead` within 3 retry attempts.
   - Confirm the queue continues processing valid messages without interruption.

## Docker Compose Full Stack

9. **All containers reach healthy state**
   - Run: `docker compose up --build`
   - Confirm all services (website, server, assignments, ai, kokoro) report healthy status.
   - Confirm no container crashes or restarts during initial startup.

## Image CDN Allowlist

10. **All approved image sources load**
    - Load a page that renders images from Supabase, Cloudinary, Google Avatars, and Unsplash.
    - Confirm all images display (no CSP violations; `next/image` `remotePatterns` allowlist is correct).

## Post-Merge Infrastructure

11. **GitHub Actions secrets & first deployment**
    - Confirm `FLY_API_TOKEN` exists in GitHub repo secrets.
    - After merge, watch the first `deploy-server` and `deploy-assignments` Actions runs complete successfully.
