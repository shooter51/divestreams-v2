#!/usr/bin/env tsx
/**
 * Simple Jira Issue Fetcher
 * Usage: npx tsx scripts/get-jira-issue-simple.mts <ISSUE-KEY>
 * Example: npx tsx scripts/get-jira-issue-simple.mts KAN-597
 */
import axios from 'axios';
import 'dotenv/config';

const issueKey = process.argv[2];
if (!issueKey) {
  console.error('Usage: npx tsx scripts/get-jira-issue-simple.mts <ISSUE-KEY>');
  process.exit(1);
}

const client = axios.create({
  baseURL: `${process.env.JIRA_HOST}/rest/api/3`,
  auth: {
    username: process.env.JIRA_USER_EMAIL,
    password: process.env.JIRA_API_TOKEN,
  },
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

try {
  const response = await client.get(`/issue/${issueKey}`);
  const issue = response.data;
  
  console.log(JSON.stringify({
    key: issue.key,
    summary: issue.fields.summary,
    description: issue.fields.description,
    status: issue.fields.status.name,
    priority: issue.fields.priority?.name,
    type: issue.fields.issuetype.name,
    reporter: issue.fields.reporter.displayName,
    assignee: issue.fields.assignee?.displayName || 'Unassigned',
    created: issue.fields.created,
    updated: issue.fields.updated,
    comments: issue.fields.comment?.comments?.map((c: any) => ({
      author: c.author.displayName,
      created: c.created,
      body: c.body
    })) || []
  }, null, 2));
} catch (error: any) {
  if (error.response?.status === 404) {
    console.error(`❌ Issue ${issueKey} not found or no permission`);
  } else {
    console.error('❌ Error:', error.message);
  }
  process.exit(1);
}
