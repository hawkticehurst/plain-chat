import { internalMutation } from "../_generated/server";

export default internalMutation(async (ctx) => {
  console.log(
    "Nuclear option: Deleting all userAIPreferences records and recreating clean ones..."
  );

  // First, get all records and save their data
  const allRecords = await ctx.db.query("userAIPreferences").collect();

  console.log(`Found ${allRecords.length} records to backup and recreate`);

  const backupData = allRecords.map((record) => ({
    userId: record.userId,
    defaultModel: record.defaultModel,
    enableStreaming: record.enableStreaming || true,
    enableUsageNotifications: record.enableUsageNotifications || true,
    createdAt: record.createdAt || Date.now(),
    updatedAt: Date.now(),
    // Only preserve valid optional fields
    ...(record.dailyUsageLimit !== undefined && {
      dailyUsageLimit: record.dailyUsageLimit,
    }),
    ...(record.monthlyUsageLimit !== undefined && {
      monthlyUsageLimit: record.monthlyUsageLimit,
    }),
    ...(record.usageWarningThreshold !== undefined && {
      usageWarningThreshold: record.usageWarningThreshold,
    }),
    ...(record.systemPrompt !== undefined && {
      systemPrompt: record.systemPrompt,
    }),
  }));

  console.log("Backup data:", JSON.stringify(backupData, null, 2));

  // Delete all existing records
  for (const record of allRecords) {
    console.log(`Deleting record ${record._id}`);
    await ctx.db.delete(record._id);
  }

  console.log("All old records deleted. Creating clean records...");

  // Create new clean records
  for (const data of backupData) {
    console.log(`Creating clean record for user ${data.userId}`);
    const newId = await ctx.db.insert("userAIPreferences", data);
    console.log(`✓ Created clean record ${newId}`);
  }

  console.log(
    `Nuclear cleanup complete! Recreated ${backupData.length} clean records.`
  );

  return {
    success: true,
    recordsDeleted: allRecords.length,
    recordsCreated: backupData.length,
    backupData,
  };
});
