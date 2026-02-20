#!/bin/bash
#
# Automated Peer Review Runner
#
# This script helps automate the peer-review-and-fix workflow.
# It can be called by git hooks or run manually.
#
# Usage:
#   ./scripts/run-peer-review.sh [--auto] [--since=DATE]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}🔍 Automated Peer Review - DiveStreams v2${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Find bug fix commits since last review
last_review=$(ls -t docs/PEER_REVIEW_REPORT_*.md 2>/dev/null | head -1)

if [ -z "$last_review" ]; then
    echo -e "${YELLOW}⚠️  No previous peer review found${NC}"
    echo "   This will be the first peer review."
    echo ""
    since_date="1 week ago"
else
    review_date=$(echo "$last_review" | sed 's/.*PEER_REVIEW_REPORT_//' | sed 's/\.md//')
    echo -e "${GREEN}✓${NC} Last review: $review_date"
    since_date="$review_date 00:00:00"
fi

# Find bug fix commits
echo ""
echo "Searching for bug fix commits since $since_date..."
echo ""

fixes=$(git log --oneline --since="$since_date" --grep="^fix:" --grep="^bug:" --grep="KAN-")

if [ -z "$fixes" ]; then
    echo -e "${GREEN}✓${NC} No bug fix commits found since last review"
    echo "   Nothing to review!"
    exit 0
fi

echo -e "${YELLOW}Found bug fix commits:${NC}"
echo ""
echo "$fixes"
echo ""

fix_count=$(echo "$fixes" | wc -l | tr -d ' ')
echo -e "${BLUE}Total: $fix_count bug fix commits${NC}"
echo ""

# Extract Jira issues from commits
jira_issues=$(echo "$fixes" | grep -oE 'KAN-[0-9]+' | sort -u)
issue_count=$(echo "$jira_issues" | wc -l | tr -d ' ')

if [ -n "$jira_issues" ]; then
    echo -e "${BLUE}Jira Issues to Review:${NC}"
    echo "$jira_issues" | sed 's/^/  - /'
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}🤖 PEER REVIEW WORKFLOW${NC}"
echo ""
echo "This workflow will:"
echo "  1. Spawn 5 independent peer reviewers"
echo "  2. Examine each bug fix for completeness"
echo "  3. Search for similar defects across codebase"
echo "  4. Compile unified review report"
echo "  5. Identify critical blockers"
echo ""
echo "Estimated time: 10-15 minutes"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if running in auto mode
if [[ "$1" == "--auto" ]]; then
    echo -e "${GREEN}Running in automatic mode...${NC}"
    run_review=true
else
    read -p "Start peer review? [Y/n]: " response
    if [[ "$response" =~ ^[Yy]$ ]] || [ -z "$response" ]; then
        run_review=true
    else
        run_review=false
    fi
fi

if [ "$run_review" = true ]; then
    echo ""
    echo -e "${BLUE}⚠️  MANUAL STEP REQUIRED:${NC}"
    echo ""
    echo "The peer review workflow requires Claude Code's LLM capabilities."
    echo ""
    echo -e "${YELLOW}In Claude Code, run:${NC}"
    echo ""
    echo "    Use the peer-review-and-fix skill to review these issues:"
    if [ -n "$jira_issues" ]; then
        echo "$jira_issues" | sed 's/^/    - /'
    else
        echo "    (Review commits from: $since_date)"
    fi
    echo ""
    echo -e "${GREEN}After review completes:${NC}"
    echo "  - Fix any critical blockers"
    echo "  - Re-run peer review to verify"
    echo "  - Push to test when APPROVED"
    echo ""
else
    echo ""
    echo -e "${YELLOW}⚠️  Peer review cancelled${NC}"
    echo ""
    echo "To run manually later:"
    echo "  ./scripts/run-peer-review.sh"
    echo ""
    echo "Or in Claude Code:"
    echo "  'Use peer-review-and-fix skill'"
    echo ""
fi

exit 0
