import { internalMutation } from "../_generated/server";

export const removeTemperatureMaxTokensFromPreferences = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all userAIPreferences records using collect (less performant but simpler for migration)
    const preferences = await ctx.db.query("userAIPreferences").collect();

    console.log(
      `Found ${preferences.length} userAIPreferences records to migrate`
    );

    let migratedCount = 0;

    for (const pref of preferences) {
      // Check if this record needs migration (has temperature or maxTokens)
      const prefAny = pref as any;
      const needsMigration = "temperature" in prefAny || "maxTokens" in prefAny;

      if (needsMigration) {
        // Create a new object without temperature and maxTokens
        const updatedPref: any = {
          userId: pref.userId,
          defaultModel: pref.defaultModel,
          enableStreaming: pref.enableStreaming,
          enableUsageNotifications: pref.enableUsageNotifications,
          systemPrompt: pref.systemPrompt,
          createdAt: pref.createdAt,
          updatedAt: Date.now(),
        };

        // Only include optional fields if they exist
        if (pref.dailyUsageLimit !== undefined) {
          updatedPref.dailyUsageLimit = pref.dailyUsageLimit;
        }
        if (pref.monthlyUsageLimit !== undefined) {
          updatedPref.monthlyUsageLimit = pref.monthlyUsageLimit;
        }
        if (pref.usageWarningThreshold !== undefined) {
          updatedPref.usageWarningThreshold = pref.usageWarningThreshold;
        }

        // Replace the record with the new structure
        await ctx.db.replace(pref._id, updatedPref);
        console.log(
          `Migrated preference record for user: ${pref.userId} (removed temp: ${!!prefAny.temperature}, maxTokens: ${!!prefAny.maxTokens})`
        );
        migratedCount++;
      } else {
        console.log(`Record for user ${pref.userId} already migrated`);
      }
    }

    console.log(
      `Migration completed: ${migratedCount} records updated out of ${preferences.length} total`
    );
    return { success: true, migratedCount, totalCount: preferences.length };
  },
});
