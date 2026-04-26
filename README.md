# Convert Google Apps Script

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/nandienterprise1711-1245s-projects/v0-convert-google-apps-script)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/vrPvjf9gvHt)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/nandienterprise1711-1245s-projects/v0-convert-google-apps-script](https://vercel.com/nandienterprise1711-1245s-projects/v0-convert-google-apps-script)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/vrPvjf9gvHt](https://v0.app/chat/vrPvjf9gvHt)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository


## to install on local
1. move to project folder
2. create .env.local  - duplicate same file with only .env / or just create .env

DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb_dev?sslmode=require"
NEXTAUTH_SECRET="any-random-local-secret"
NEXTAUTH_URL="http://localhost:3000"

3. run this command on project folder 
    npm install

4. Run on dev server 
    npm run dev

    npx prisma generate
    npx prisma migrate dev --name init-pos

6. open url http://localhost:3000

To test DB connection - http://localhost:3000/api/test-db

To verify data available or not in DB - npx prisma studio

To Feed Initial Data 
----------------------
Option A: psql
Install psql if not installed.
From project root, run:
bash
# For Windows PowerShell:
psql "YOUR_DATABASE_URL" -f scripts/001_initial_seed.sql

Adjust the scripts/ path if your files are in a different folder.

Option B: Web SQL console - Go to: https://console.neon.tech
Open Neon’s web console for your neondb database.
Open the SQL editor.

Paste the contents of 001_initial_seed.sql → Run.
Then paste 002_dynamic_categories.sql → Run.

After running both:
User will have an admin record.
Product will have all 42 SKUs.
ProductCategory will have the 4 categories.
Product.categoryId will be set correctly.


3) Verify data is visible to the app
Use Prisma Studio:
bash
npx prisma studio










# 1) Prisma CLI + client installed correctly
npx prisma -v

# 2) Can your network resolve DB hostname?
nslookup ep-odd-frog-a4u692tl-pooler.us-east-1.aws.neon.tech

# 3) Can Prisma connect to DB?
npx prisma migrate status --schema prisma/schema.prisma