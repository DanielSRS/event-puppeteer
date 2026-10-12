import type { ScreeningPolicyRepository } from '../index.ts';
import { SCREENING_CATEGORIES, type ScreeningCategory, type ScreeningPolicy } from '../../types/image.ts';
import { screeningPolicy } from '../../db/schema.ts';
import type { Database } from '../../db/index.ts';

/** The Screening Policy stored in the `screening_policy` table, one row per category. */
export class DrizzleScreeningPolicyRepository implements ScreeningPolicyRepository {
  constructor(private db: Database) {}

  /** @returns null while any category has no row: a partial policy is no policy. */
  async get(): Promise<ScreeningPolicy | null> {
    const rows = await this.db.select().from(screeningPolicy);
    const byCategory = new Map(rows.map(row => [row.category, row]));
    const entries: [ScreeningCategory, { lower: number; upper: number }][] = [];
    for (const category of SCREENING_CATEGORIES) {
      const row = byCategory.get(category);
      if (!row) return null;
      entries.push([category, { lower: row.lower, upper: row.upper }]);
    }
    return Object.fromEntries(entries) as ScreeningPolicy;
  }

  /** Replaces every category's cut-offs in one transaction. */
  async set(policy: ScreeningPolicy): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(screeningPolicy);
      await tx.insert(screeningPolicy).values(
        SCREENING_CATEGORIES.map(category => ({ category, ...policy[category] }))
      );
    });
  }
}
