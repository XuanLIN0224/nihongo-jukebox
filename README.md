# Nihongo Jukebox

中日英三语日语学习站：一个板块做日语歌曲学习，一个板块做“不背单词”式的单词记忆。前端可部署到 GitHub Pages，账号和学习进度由独立 Node API 写入 MongoDB。

## What is included

- Login and register UI
- MongoDB-backed API for username/password login, bcrypt password hashing, JWT sessions, and progress sync
- Song catalog for Fujii Kaze, Vaundy, Kenshi Yonezu, Togenashi Togeari, and popular Vocaloid tracks
- Lyric-study flow with word-by-word analysis, readings, Chinese/English meanings, examples, and line spelling tests
- Paste analyzer for lyrics you have permission to study
- Vocabulary drill with intro, examples, Chinese/English hints, and spelling tests every 10 words
- GitHub Actions workflow for GitHub Pages

## Copyright note

The repository does not include full copyrighted lyrics. The built-in song packs use original study lines that match the vocabulary themes of the songs. For real lyrics, paste text that you have permission to use into the analyzer.

Useful public metadata sources:

- VocaDB public API: https://wiki.vocadb.net/docs/public-api
- VocaDB API and embeds: https://wiki.vocadb.net/docs/api-and-embeds
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
INVITE_CODE=<code-for-friends>
CORS_ORIGIN=https://<github-username>.github.io
PORT=8787
```

Create or reset a user directly:

```bash
cd server
npm run create-user -- linxuan your-password Linxuan
```

Then set the frontend API URL to the deployed backend URL in the app settings, or set a GitHub repository variable named `VITE_API_BASE_URL`.

## Security

Do not commit `.env` files. If a MongoDB password has been shown in screenshots or chat, rotate that database user's password before deploying.
