import { db } from "@/db";
import { Category } from "@/enums";
import { sql } from "drizzle-orm";

import ExpensePrefillChipsClient from "@/components/ExpensePrefillChipsClient";

type PrefillRow = {
  note: string;
  category: string;
  paid_by: string;
  total_frequency: number;
  latest_amount: number;
  most_frequent_amount: number;
};

const ExpensePrefillChips = async () => {
  const { rows } = await db.execute<PrefillRow>(sql`
    WITH RankedStats AS (
      SELECT
        note,
        category,
        paid_by,
        amount,
        created_at,
        COUNT(*) OVER(PARTITION BY note, category, paid_by, amount) as price_frequency,
        ROW_NUMBER() OVER(PARTITION BY note, category, paid_by ORDER BY created_at DESC) as recency_rank
      FROM expenses
      WHERE is_deleted = false
      AND created_at >= NOW() - INTERVAL '30 days'
    )
    SELECT
      note,
      category,
      paid_by,
      COUNT(*) as total_frequency,
      COALESCE(MAX(amount) FILTER (WHERE recency_rank = 1), 0) as latest_amount,
      COALESCE((ARRAY_AGG(amount ORDER BY price_frequency DESC, created_at DESC))[1], 0) as most_frequent_amount
    FROM RankedStats
    GROUP BY note, category, paid_by
    ORDER BY total_frequency DESC
    LIMIT 10;
  `);

  const items = rows
    .map((row) => ({
      note: String(row.note ?? ""),
      category: row.category as Category,
      totalFrequency: Number(row.total_frequency ?? 0),
      amount: Number(row.most_frequent_amount ?? 0),
    }))
    .filter(
      (row) => Object.values(Category).includes(row.category) && row.amount > 0
    );

  return <ExpensePrefillChipsClient items={items} />;
};

export default ExpensePrefillChips;
