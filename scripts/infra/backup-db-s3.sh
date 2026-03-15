#!/usr/bin/env bash
# backup-db-s3.sh — Automated PostgreSQL backup to S3
#
# Runs on the DB VPS via SSH. Dumps both production and test databases,
# compresses them, uploads to S3, and rotates backups older than 30 days.
#
# Required env vars (injected by GitHub Actions):
#   DB_VPS_IP        — IP address of the database VPS
#   SSH_PRIVATE_KEY  — SSH private key for DB VPS access
#   POSTGRES_USER    — PostgreSQL superuser
#   POSTGRES_PASSWORD — PostgreSQL password
#   S3_ENDPOINT      — S3-compatible endpoint URL
#   S3_BUCKET        — S3 bucket name
#   S3_ACCESS_KEY_ID — S3 access key
#   S3_SECRET_ACCESS_KEY — S3 secret key
#   S3_REGION        — S3 region (e.g. us-east-1)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/infra/common.sh
source "$SCRIPT_DIR/common.sh"

DB_VPS_IP="${DB_VPS_IP:-72.62.166.128}"
DATESTAMP="$(date +%Y-%m-%d)"
RETENTION_DAYS=30
DATABASES=("divestreams" "divestreams_test")

main() {
    log_step "=== DiveStreams Automated Database Backup ==="
    log_info "DB VPS: $DB_VPS_IP"
    log_info "Date: $DATESTAMP"
    log_info "Databases: ${DATABASES[*]}"

    require_env DB_VPS_IP POSTGRES_USER POSTGRES_PASSWORD \
                S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_REGION

    setup_ssh_key

    local success_count=0
    local fail_count=0

    for db in "${DATABASES[@]}"; do
        log_step "Backing up database: $db"
        if backup_database "$db"; then
            success_count=$((success_count + 1))
        else
            log_error "Backup failed for $db"
            fail_count=$((fail_count + 1))
        fi
    done

    log_step "Rotating old backups (keeping last ${RETENTION_DAYS} days)..."
    rotate_backups

    echo ""
    log_info "=== Backup Summary ==="
    log_info "  Successful: $success_count"
    if [[ $fail_count -gt 0 ]]; then
        log_error "  Failed:     $fail_count"
        exit 1
    else
        log_info "  Failed:     $fail_count"
    fi
}

backup_database() {
    local db="$1"
    local remote_dump="/tmp/backup-${db}-${DATESTAMP}.sql.gz"
    local s3_key="backups/${db}/${DATESTAMP}.sql.gz"

    # Run pg_dump inside the postgres container on the DB VPS
    log_info "Dumping $db on DB VPS..."
    ssh_exec "$DB_VPS_IP" bash <<REMOTE
set -euo pipefail

PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    -h 127.0.0.1 \
    -U "${POSTGRES_USER}" \
    -d "${db}" \
    --format=plain \
    --no-owner \
    --no-acl \
    | gzip > "${remote_dump}"

echo "[backup] Dump complete for ${db}. Size: \$(du -sh ${remote_dump} | cut -f1)"
REMOTE

    # Upload to S3 from the DB VPS using curl (avoids needing aws CLI on the VPS)
    log_info "Uploading $db backup to s3://${S3_BUCKET}/${s3_key}..."
    ssh_exec "$DB_VPS_IP" bash <<REMOTE
set -euo pipefail

FILE="${remote_dump}"
BUCKET="${S3_BUCKET}"
KEY="${s3_key}"
ENDPOINT="${S3_ENDPOINT}"
REGION="${S3_REGION}"
ACCESS_KEY="${S3_ACCESS_KEY_ID}"
SECRET_KEY="${S3_SECRET_ACCESS_KEY}"

DATE="\$(date -u +"%Y%m%dT%H%M%SZ")"
DATE_SHORT="\$(date -u +"%Y%m%d")"
CONTENT_TYPE="application/gzip"
CONTENT_MD5="\$(md5sum "\$FILE" | cut -d' ' -f1 | xxd -r -p | base64)"
PAYLOAD_HASH="\$(sha256sum "\$FILE" | cut -d' ' -f1)"

# Build AWS Signature V4
CANONICAL_HEADERS="content-md5:\${CONTENT_MD5}\ncontent-type:\${CONTENT_TYPE}\nhost:\$(echo \$ENDPOINT | sed 's|https://||')\nx-amz-content-sha256:\${PAYLOAD_HASH}\nx-amz-date:\${DATE}"
SIGNED_HEADERS="content-md5;content-type;host;x-amz-content-sha256;x-amz-date"

CANONICAL_REQUEST="PUT\n/\${BUCKET}/\${KEY}\n\n\${CANONICAL_HEADERS}\n\n\${SIGNED_HEADERS}\n\${PAYLOAD_HASH}"
STRING_TO_SIGN="AWS4-HMAC-SHA256\n\${DATE}\n\${DATE_SHORT}/\${REGION}/s3/aws4_request\n\$(echo -ne "\${CANONICAL_REQUEST}" | sha256sum | cut -d' ' -f1)"

SIGNING_KEY="\$(echo -n "\${DATE_SHORT}" | openssl dgst -sha256 -hmac "AWS4\${SECRET_KEY}" -binary | \
    openssl dgst -sha256 -hmac "\${REGION}" -binary | \
    openssl dgst -sha256 -hmac "s3" -binary | \
    openssl dgst -sha256 -hmac "aws4_request" -binary)"

SIGNATURE="\$(echo -ne "\${STRING_TO_SIGN}" | openssl dgst -sha256 -hmac "" -mac HMAC -macopt "hexkey:\$(echo -n "\${DATE_SHORT}" | openssl dgst -sha256 -hmac "AWS4\${SECRET_KEY}" -binary | xxd -p -c 256 | tr -d '\n' | xargs -I{} sh -c 'echo -n "'" \${REGION}"'" | openssl dgst -sha256 -hmac "" -binary -mac HMAC -macopt hexkey:{} | xxd -p -c 256')" 2>/dev/null || true)"

# Fall back to simpler s3cmd-style upload if openssl chaining is unavailable
if command -v aws &>/dev/null; then
    AWS_ACCESS_KEY_ID="\${ACCESS_KEY}" \
    AWS_SECRET_ACCESS_KEY="\${SECRET_KEY}" \
    aws s3 cp "\${FILE}" "s3://\${BUCKET}/\${KEY}" \
        --endpoint-url "\${ENDPOINT}" \
        --region "\${REGION}" \
        --no-progress
elif command -v s3cmd &>/dev/null; then
    s3cmd put "\${FILE}" "s3://\${BUCKET}/\${KEY}" \
        --access_key="\${ACCESS_KEY}" \
        --secret_key="\${SECRET_KEY}" \
        --host="\$(echo \$ENDPOINT | sed 's|https://||')" \
        --host-bucket="\$(echo \$ENDPOINT | sed 's|https://||')" \
        --ssl
else
    echo "[backup] ERROR: Neither aws CLI nor s3cmd found on DB VPS. Cannot upload to S3."
    exit 1
fi

echo "[backup] Upload complete: s3://\${BUCKET}/\${KEY}"
rm -f "\${FILE}"
REMOTE

    log_info "Backup complete for $db -> s3://${S3_BUCKET}/${s3_key}"
    return 0
}

rotate_backups() {
    for db in "${DATABASES[@]}"; do
        log_info "Rotating old backups for $db (retention: ${RETENTION_DAYS} days)..."
        ssh_exec "$DB_VPS_IP" bash <<REMOTE || log_warn "Rotation failed for $db (non-fatal)"
set -euo pipefail

if command -v aws &>/dev/null; then
    CUTOFF="\$(date -u -d "${RETENTION_DAYS} days ago" +%Y-%m-%d 2>/dev/null || date -u -v-${RETENTION_DAYS}d +%Y-%m-%d)"

    AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}" \
    AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" \
    aws s3 ls "s3://${S3_BUCKET}/backups/${db}/" \
        --endpoint-url "${S3_ENDPOINT}" \
        --region "${S3_REGION}" \
        | awk '{print \$4}' \
        | while read -r key; do
            FILE_DATE="\$(echo "\$key" | grep -oP '\d{4}-\d{2}-\d{2}')"
            if [[ "\$FILE_DATE" < "\$CUTOFF" ]]; then
                echo "[rotate] Deleting old backup: backups/${db}/\$key"
                AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}" \
                AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" \
                aws s3 rm "s3://${S3_BUCKET}/backups/${db}/\$key" \
                    --endpoint-url "${S3_ENDPOINT}" \
                    --region "${S3_REGION}"
            fi
        done
    echo "[rotate] Rotation complete for ${db}"
else
    echo "[rotate] aws CLI not available — skipping rotation for ${db}"
fi
REMOTE
    done
}

main "$@"
