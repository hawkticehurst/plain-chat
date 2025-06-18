import { internalMutation } from "../_generated/server";

export default internalMutation(async (ctx) => {
  console.log(
    "Force cleaning all userAIPreferences records by rebuilding them..."
  );

  // Get all records
  const allRecords = await ctx.db.query("userAIPreferences").collect();

  console.log(`Found ${allRecords.length} records to process`);

  for (const record of allRecords) {
    console.log(
      `Processing record ${record._id}:`,
      JSON.stringify(record, null, 2)
    );

    // Create a completely new record with only valid fields
    const newRecord: any = {
      userId: record.userId,
      defaultModel: record.defaultModel,
      enableStreaming: record.enableStreaming || true,
      enableUsageNotifications: record.enableUsageNotifications || true,
      createdAt: record.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    // Add optional fields only if they exist in the original
    if (record.dailyUsageLimit !== undefined) {
      newRecord.dailyUsageLimit = record.dailyUsageLimit;
    }
    if (record.monthlyUsageLimit !== undefined) {
      newRecord.monthlyUsageLimit = record.monthlyUsageLimit;
    }
    if (record.usageWarningThreshold !== undefined) {
      newRecord.usageWarningThreshold = record.usageWarningThreshold;
    }
    if (record.systemPrompt !== undefined) {
      newRecord.systemPrompt = record.systemPrompt;
    }

    console.log(
      `Replacing record ${record._id} with clean version:`,
      newRecord
    );

    // Replace the record completely
    await ctx.db.replace(record._id, newRecord);

    console.log(`✓ Successfully cleaned record ${record._id}`);
  }

  console.log(
    `Force cleaning complete! Processed ${allRecords.length} records.`
  );

  return {
    success: true,
    recordsProcessed: allRecords.length,
  };
});
