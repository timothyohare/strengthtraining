/**
 * The gate scripts write test data, and lib/db falls back to the live
 * `lift5-dev` table when DYNAMODB_ENDPOINT is unset. Refuse to run unless
 * we're pointed at DynamoDB Local and the gate's own table.
 */
export function assertLocalGateDb() {
  const endpoint = process.env.DYNAMODB_ENDPOINT ?? "";
  const table = process.env.DYNAMODB_TABLE ?? "";
  const host = endpoint ? new URL(endpoint).hostname : "";
  if (!["localhost", "127.0.0.1"].includes(host) || table !== "lift5-gate") {
    console.error(
      `Refusing to run: DYNAMODB_ENDPOINT=${endpoint || "(unset)"}, ` +
        `DYNAMODB_TABLE=${table || "(unset)"}. Gate scripts only touch ` +
        "DynamoDB Local's lift5-gate table (see .claude/harness.json).",
    );
    process.exit(1);
  }
}
