#!/usr/bin/env bash
# Uploads app/lambda/rest-push/index.mjs to the lift5-rest-push function.
# Run after `aws cloudformation deploy` of infra/rest-push.yaml, and again
# whenever index.mjs changes. Usage: infra/deploy-rest-push.sh [stage]
set -euo pipefail
stage="${1:-dev}"
region="ap-southeast-2"
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cp "$here/../app/lambda/rest-push/index.mjs" "$tmp/index.mjs"
(cd "$tmp" && zip -q function.zip index.mjs)
aws lambda update-function-code \
  --region "$region" \
  --function-name "lift5-rest-push-$stage" \
  --zip-file "fileb://$tmp/function.zip" \
  --query "[FunctionName,LastUpdateStatus,CodeSha256]" --output text
aws lambda wait function-updated --region "$region" --function-name "lift5-rest-push-$stage"
echo "deployed"
