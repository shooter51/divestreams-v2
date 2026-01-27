# Jira API Access - DiveStreams

## Credentials Location
Jira credentials are stored in `.env` file:
- `JIRA_HOST=https://divestreams.atlassian.net`
- `JIRA_USER_EMAIL=tom@divestreams.com`
- `JIRA_API_TOKEN=<long token>`
- `JIRA_PROJECT_KEY=KAN`

## How to Fetch Jira Issues

### Method 1: Use the reusable script (RECOMMENDED)
```bash
npx tsx scripts/get-jira-issue-simple.mts KAN-597
```

### Method 2: Create an ad-hoc script
```bash
cat > scripts/get-issue.mts << 'SCRIPT'
import axios from 'axios';
import 'dotenv/config';

const client = axios.create({
  baseURL: `${process.env.JIRA_HOST}/rest/api/3`,
  auth: {
    username: process.env.JIRA_USER_EMAIL,
    password: process.env.JIRA_API_TOKEN,
  },
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
});

const response = await client.get(`/issue/KAN-597`);
console.log(JSON.stringify(response.data, null, 2));
SCRIPT

npx tsx scripts/get-issue.mts
```

## Why curl doesn't work
- Using `curl` with credentials from `.env` is tricky because `source .env` doesn't work in bash subshells
- Extracting with `grep` can work but is fragile
- The axios approach with `tsx` is more reliable because it loads `.env` via dotenv/config

## Key Learnings
1. **MUST use `npx tsx`** - Regular `node` won't work because project uses ES modules
2. **MUST run from project root** - Script needs access to `node_modules/axios` and `.env`
3. **Script must be `.mts` extension** - TypeScript module format
4. **Load dotenv with `import 'dotenv/config'`** - Automatically loads `.env`
