# Nihongo Jukebox

中日英三语日语学习站：一个板块做日语歌曲学习，一个板块做“不背单词”式的单词记忆。前端可部署到 GitHub Pages，账号和学习进度由独立 Node API 写入 MongoDB。

## What is included

- Login and register UI
- MongoDB-backed API for username/password login, bcrypt password hashing, JWT sessions, and progress sync
- Singer-grouped lyric catalog imported from the provided Fujii Kaze and Togenashi Togeari DOCX files
- Lyric-study flow with word-by-word analysis, readings, Chinese/English meanings, examples, and line spelling tests
- Paste analyzer for lyrics you have permission to study
- 3,000+ word JLPT vocabulary bank with N1-N5 selection, N1 as the default, JLPT labels, examples, Chinese/English hints, and spelling tests every 10 words
- Japanese text-to-speech buttons using the browser Web Speech API, with no user-facing API key or connection setting
- GitHub Actions workflow for GitHub Pages

## Lyrics note

The built-in song packs are imported from local DOCX files provided by the site owner and are grouped by singer. Confirm you have permission before publishing full lyrics in a public repository or public GitHub Pages site.

Useful public metadata sources:

- JLPT Vocabulary API: https://jlpt-vocab-api.vercel.app/
- Official JLPT level summary: https://www.jlpt.jp/sp/cn/about/levelsummary.html
- Web Speech API SpeechSynthesis: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
- MongoDB Node.js driver connection docs: https://www.mongodb.com/docs/drivers/node/current/connect/connection-targets/
- GitHub Pages HTTPS docs: https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https

## Frontend

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Regenerate the bundled JLPT vocabulary snapshot:

```bash
npm run generate:vocab
```

For GitHub Pages, the workflow sets `VITE_BASE_PATH` automatically to `/${{ github.event.repository.name }}/`.

## Backend

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

Set these environment variables in production:

```bash
MONGODB_URI=mongodb+srv://<db_username>:<db_password>@useraccountcluster.5ibcfva.mongodb.net/?appName=UserAccountCluster
MONGODB_DB=nihongo_jukebox
JWT_SECRET=<long-random-secret>
CORS_ORIGIN=https://<github-username>.github.io
PORT=8787
```

Create or reset a user directly:

```bash
cd server
npm run create-user -- linxuan your-password Linxuan
```

Then set a GitHub repository variable named `VITE_API_BASE_URL` to the deployed backend URL. The app does not expose API connection settings to learners.

## Deploy backend on Render

Create a Render Web Service from this GitHub repository.

Use these values if you fill the form manually:

| Render field | Value |
| --- | --- |
| Service Type | Web Service |
| Repository | `https://github.com/XuanLIN0224/nihongo-jukebox` |
| Branch | `main` |
| Root Directory | `server` |
| Runtime / Language | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free is fine for personal use |
| Health Check Path | `/api/health` |

Environment variables:

| Key | Value |
| --- | --- |
| `MONGODB_URI` | Your MongoDB Atlas connection string, with the real username and password |
| `MONGODB_DB` | `nihongo_jukebox` |
| `JWT_SECRET` | A long random string |
| `CORS_ORIGIN` | `https://xuanlin0224.github.io,http://localhost:5173` |

The root `render.yaml` also defines the same service as a Render Blueprint. If you use the Blueprint flow, Render will still ask you to fill the secret value for `MONGODB_URI`.

After Render deploys, open:

```text
https://<your-render-service>.onrender.com/api/health
```

It should return JSON with `"ok": true`.

Finally, connect GitHub Pages to the backend:

1. In GitHub, open this repo's Settings.
2. Go to Secrets and variables > Actions > Variables.
3. Add or update `VITE_API_BASE_URL`.
4. Set it to your Render URL, for example `https://nihongo-jukebox-api.onrender.com`.
5. Rerun the GitHub Pages workflow or push a new commit so the frontend rebuilds with the backend URL.

## Security

Do not commit `.env` files. If a MongoDB password has been shown in screenshots or chat, rotate that database user's password before deploying.
