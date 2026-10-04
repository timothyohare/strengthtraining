/**
 * One-off migration: session sort keys go from SESSION#<date>#<id> to
 * SESSION#<date>#<completedAt>#<id> (see sessionSk in lib/db/schema.ts), so
 * two sessions on the same date sort in the order they were finished.
 *
 * Old items have no completedAt, so this gives them a synthetic one at
 * midnight UTC on their date, a second apart in the order given. A date with
 * one old session needs nothing extra. A date with several needs their order,
 * because the old keys can't tell us:
 *
 *   pnpm exec tsx scripts/migrate-session-keys.ts                       # dry run
 *   pnpm exec tsx scripts/migrate-session-keys.ts --order 398903e0,239bbcf2 --apply
 *
 * Each item moves in one transaction (put new key, delete old), so a failure
 * part-way leaves every session either fully old or fully new.
 */
import { ScanCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, sessionSk, TABLE_NAME } from "../lib/db/schema";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const orderArg = args.includes("--order")
  ? args[args.indexOf("--order") + 1]
  : undefined;
if (args.includes("--order") && (!orderArg || orderArg.startsWith("--"))) {
  console.error("--order needs a comma-separated list of session ids");
  process.exit(1);
}
// Ids may be given in full or as unique prefixes (e.g. the first 8 chars).
const order = orderArg ? orderArg.split(",").map((id) => id.trim()) : [];
const orderIndex = (sessionId: string) =>
  order.findIndex((prefix) => sessionId.startsWith(prefix));

interface LegacyItem {
  PK: string;
  SK: string;
  sessionId: string;
  date: string;
  completedAt?: string;
  [key: string]: unknown;
}

async function scanSessions(): Promise<LegacyItem[]> {
  const items: LegacyItem[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(SK, :s)",
        ExpressionAttributeValues: { ":s": "SESSION#" },
        ExclusiveStartKey,
      }),
    );
    items.push(...((res.Items ?? []) as LegacyItem[]));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function main() {
  const legacy = (await scanSessions()).filter((i) => !i.completedAt);
  console.log(`${TABLE_NAME}: ${legacy.length} session(s) to migrate`);

  const groups = new Map<string, LegacyItem[]>();
  for (const item of legacy) {
    const key = `${item.PK}|${item.date}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  const moves: { item: LegacyItem; completedAt: string }[] = [];
  for (const [key, items] of groups) {
    if (items.length > 1) {
      const unordered = items.filter((i) => orderIndex(i.sessionId) === -1);
      if (unordered.length > 0) {
        throw new Error(
          `${key} has ${items.length} sessions; pass --order with ids ` +
            items.map((i) => i.sessionId).join(", "),
        );
      }
      const positions = items.map((i) => orderIndex(i.sessionId));
      if (new Set(positions).size !== positions.length) {
        throw new Error(`${key}: an --order prefix matches more than one session`);
      }
      items.sort((a, b) => orderIndex(a.sessionId) - orderIndex(b.sessionId));
    }
    items.forEach((item, i) => {
      const t = new Date(`${item.date}T00:00:00.000Z`);
      t.setUTCSeconds(i);
      moves.push({ item, completedAt: t.toISOString() });
    });
  }

  for (const { item, completedAt } of moves) {
    const { PK, SK, ...rest } = item;
    const newSk = sessionSk(item.date, completedAt, item.sessionId);
    console.log(`${PK} ${SK}\n  -> ${newSk}`);
    if (!apply) continue;
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE_NAME,
              Item: { PK, SK: newSk, ...rest, completedAt },
              ConditionExpression: "attribute_not_exists(SK)",
            },
          },
          {
            Delete: {
              TableName: TABLE_NAME,
              Key: { PK, SK },
              ConditionExpression: "attribute_exists(SK)",
            },
          },
        ],
      }),
    );
  }

  console.log(apply ? "done" : "dry run -- re-run with --apply to write");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
