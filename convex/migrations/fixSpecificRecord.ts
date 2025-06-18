import { internalMutation } from "../_generated/server";

export const fixSpecificUserRecord = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Look for the specific problematic record by ID
    const problematicId = "jn7f6wz0380cgx2jwq8kqcsje97hs161" as any;

    try {
      const record = await ctx.db.get(problematicId);
      if (record) {
        console.log(`Found problematic record:`, record);

        const recordAny = record as any;

        // Create clean record without temperature and maxTokens
        const cleanRecord: any = {
          userId: recordAny.userId,
          defaultModel: recordAny.defaultModel,
          enableStreaming: recordAny.enableStreaming,
          enableUsageNotifications: recordAny.enableUsageNotifications,
          systemPrompt: recordAny.systemPrompt || "",
          createdAt: recordAny.createdAt,
          updatedAt: Date.now(),
        };

        // Add optional fields if they exist
        if (recordAny.dailyUsageLimit !== undefined) {
          cleanRecord.dailyUsageLimit = recordAny.dailyUsageLimit;
        }
        if (recordAny.monthlyUsageLimit !== undefined) {
          cleanRecord.monthlyUsageLimit = recordAny.monthlyUsageLimit;
        }
        if (recordAny.usageWarningThreshold !== undefined) {
          cleanRecord.usageWarningThreshold = recordAny.usageWarningThreshold;
        }

        await ctx.db.replace(problematicId, cleanRecord);
        console.log(`Fixed record for user: ${recordAny.userId}`);
        return { success: true, fixed: true };
      } else {
        console.log("Record not found");
        return { success: true, fixed: false, message: "Record not found" };
      }
    } catch (error: any) {
      console.error("Error fixing record:", error);
      return { success: false, error: error.message };
    }
  },
});
