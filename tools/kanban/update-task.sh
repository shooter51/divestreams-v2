#!/usr/bin/env bash
#
# update-task.sh - CLI helper to manage the Kanban board tasks.json
#
# Usage:
#   ./update-task.sh add "Title" "Description" "P0|P1|P2|P3" "backlog|in_progress|in_review|done" [agent] [jiraKey]
#   ./update-task.sh <id> <field> <value>     # Update a single field on a task
#   ./update-task.sh list                      # List all tasks
#   ./update-task.sh delete <id>               # Delete a task
#   ./update-task.sh move <id> <status>        # Shortcut: move task to a new status
#
# Examples:
#   ./update-task.sh add "Fix login bug" "Users can't log in with email" P0 in_progress claude-opus KAN-123
#   ./update-task.sh 3 status done
#   ./update-task.sh 3 priority P0
#   ./update-task.sh 3 agent claude-sonnet
#   ./update-task.sh move 3 done
#   ./update-task.sh list
#   ./update-task.sh delete 5

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASKS_FILE="$SCRIPT_DIR/tasks.json"

# Ensure tasks.json exists
if [ ! -f "$TASKS_FILE" ]; then
  echo '{"lastUpdated":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","tasks":[]}' > "$TASKS_FILE"
fi

usage() {
  cat <<'EOF'
Kanban Task Manager

Usage:
  update-task.sh add "Title" "Description" PRIORITY STATUS [AGENT] [JIRA_KEY]
  update-task.sh <id> <field> <value>
  update-task.sh move <id> <status>
  update-task.sh delete <id>
  update-task.sh list

Fields: title, description, status, priority, agent, jiraKey
Status: backlog, in_progress, in_review, done
Priority: P0, P1, P2, P3
EOF
  exit 1
}

if [ $# -lt 1 ]; then
  usage
fi

CMD="$1"

case "$CMD" in
  list)
    python3 -c "
import json, sys

with open('$TASKS_FILE', 'r') as f:
    data = json.load(f)

tasks = data.get('tasks', [])
if not tasks:
    print('No tasks.')
    sys.exit(0)

# Group by status
statuses = ['backlog', 'in_progress', 'in_review', 'done']
status_labels = {
    'backlog': 'BACKLOG',
    'in_progress': 'IN PROGRESS',
    'in_review': 'IN REVIEW',
    'done': 'DONE'
}
colors = {
    'P0': '\033[91m',  # red
    'P1': '\033[93m',  # yellow
    'P2': '\033[94m',  # blue
    'P3': '\033[90m',  # gray
}
reset = '\033[0m'
bold = '\033[1m'

for status in statuses:
    group = [t for t in tasks if t.get('status') == status]
    if not group:
        continue
    print(f'\n{bold}--- {status_labels[status]} ({len(group)}) ---{reset}')
    for t in group:
        p = t.get('priority', 'P3')
        pc = colors.get(p, '')
        agent = f\" [{t['agent']}]\" if t.get('agent') else ''
        jira = f\" ({t['jiraKey']})\" if t.get('jiraKey') else ''
        desc = t.get('description', '')
        if len(desc) > 60:
            desc = desc[:57] + '...'
        print(f\"  {pc}{p}{reset} #{t['id']} {bold}{t.get('title','')}{reset}{agent}{jira}\")
        if desc:
            print(f\"       {desc}\")

print()
print(f'Total: {len(tasks)} tasks  |  Last updated: {data.get(\"lastUpdated\", \"unknown\")}')
"
    ;;

  add)
    if [ $# -lt 5 ]; then
      echo "Error: add requires at least 4 arguments: title, description, priority, status"
      echo "Usage: update-task.sh add \"Title\" \"Description\" P0 in_progress [agent] [jiraKey]"
      exit 1
    fi
    TITLE="$2"
    DESC="$3"
    PRIORITY="$4"
    STATUS="$5"
    AGENT="${6:-}"
    JIRA="${7:-}"

    python3 -c "
import json, sys
from datetime import datetime, timezone

with open('$TASKS_FILE', 'r') as f:
    data = json.load(f)

tasks = data.get('tasks', [])

# Find next ID
max_id = 0
for t in tasks:
    try:
        tid = int(t['id'])
        if tid > max_id:
            max_id = tid
    except (ValueError, KeyError):
        pass

now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
new_task = {
    'id': str(max_id + 1),
    'title': '''$TITLE''',
    'description': '''$DESC''',
    'status': '''$STATUS''',
    'priority': '''$PRIORITY''',
    'agent': '''$AGENT''' if '''$AGENT''' else None,
    'created': now,
    'updated': now,
    'jiraKey': '''$JIRA''' if '''$JIRA''' else None,
}

tasks.append(new_task)
data['tasks'] = tasks
data['lastUpdated'] = now

with open('$TASKS_FILE', 'w') as f:
    json.dump(data, f, indent=2)

print(f\"Added task #{new_task['id']}: {new_task['title']} [{new_task['status']}]\")
" || {
      echo "Error adding task"
      exit 1
    }
    ;;

  move)
    if [ $# -lt 3 ]; then
      echo "Usage: update-task.sh move <id> <status>"
      exit 1
    fi
    TASK_ID="$2"
    NEW_STATUS="$3"

    python3 -c "
import json, sys
from datetime import datetime, timezone

with open('$TASKS_FILE', 'r') as f:
    data = json.load(f)

valid_statuses = ['backlog', 'in_progress', 'in_review', 'done']
new_status = '$NEW_STATUS'
if new_status not in valid_statuses:
    print(f'Error: Invalid status \"{new_status}\". Must be one of: {valid_statuses}')
    sys.exit(1)

found = False
for t in data.get('tasks', []):
    if t['id'] == '$TASK_ID':
        old_status = t.get('status', 'unknown')
        t['status'] = new_status
        t['updated'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        data['lastUpdated'] = t['updated']
        found = True
        print(f\"Moved task #{t['id']} ({t['title']}): {old_status} -> {new_status}\")
        break

if not found:
    print(f'Error: Task #$TASK_ID not found')
    sys.exit(1)

with open('$TASKS_FILE', 'w') as f:
    json.dump(data, f, indent=2)
"
    ;;

  delete)
    if [ $# -lt 2 ]; then
      echo "Usage: update-task.sh delete <id>"
      exit 1
    fi
    TASK_ID="$2"

    python3 -c "
import json, sys
from datetime import datetime, timezone

with open('$TASKS_FILE', 'r') as f:
    data = json.load(f)

tasks = data.get('tasks', [])
new_tasks = [t for t in tasks if t['id'] != '$TASK_ID']

if len(new_tasks) == len(tasks):
    print(f'Error: Task #$TASK_ID not found')
    sys.exit(1)

deleted = [t for t in tasks if t['id'] == '$TASK_ID'][0]
data['tasks'] = new_tasks
data['lastUpdated'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

with open('$TASKS_FILE', 'w') as f:
    json.dump(data, f, indent=2)

print(f\"Deleted task #{deleted['id']}: {deleted['title']}\")
"
    ;;

  help|--help|-h)
    usage
    ;;

  *)
    # Field update: ./update-task.sh <id> <field> <value>
    if [ $# -lt 3 ]; then
      echo "Error: Field update requires 3 arguments: <id> <field> <value>"
      usage
    fi
    TASK_ID="$1"
    FIELD="$2"
    VALUE="$3"

    python3 -c "
import json, sys
from datetime import datetime, timezone

with open('$TASKS_FILE', 'r') as f:
    data = json.load(f)

valid_fields = ['title', 'description', 'status', 'priority', 'agent', 'jiraKey']
field = '$FIELD'
if field not in valid_fields:
    print(f'Error: Invalid field \"{field}\". Must be one of: {valid_fields}')
    sys.exit(1)

valid_statuses = ['backlog', 'in_progress', 'in_review', 'done']
valid_priorities = ['P0', 'P1', 'P2', 'P3']

value = '''$VALUE'''

if field == 'status' and value not in valid_statuses:
    print(f'Error: Invalid status \"{value}\". Must be one of: {valid_statuses}')
    sys.exit(1)

if field == 'priority' and value not in valid_priorities:
    print(f'Error: Invalid priority \"{value}\". Must be one of: {valid_priorities}')
    sys.exit(1)

# Handle null/none for agent and jiraKey
if field in ('agent', 'jiraKey') and value.lower() in ('null', 'none', ''):
    value = None

found = False
for t in data.get('tasks', []):
    if t['id'] == '$TASK_ID':
        old_value = t.get(field, 'unset')
        t[field] = value
        t['updated'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        data['lastUpdated'] = t['updated']
        found = True
        print(f\"Updated task #{t['id']} ({t.get('title','')}): {field} = {value} (was: {old_value})\")
        break

if not found:
    print(f'Error: Task #$TASK_ID not found')
    sys.exit(1)

with open('$TASKS_FILE', 'w') as f:
    json.dump(data, f, indent=2)
"
    ;;
esac
