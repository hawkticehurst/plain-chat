import { internalMutation } from "../_generated/server";

export default internalMutation(async (ctx) => {
  console.log("Looking for records with temperature or maxTokens fields...");

  // First, find all records with the problematic fields
  const allRecords = await ctx.db.query("userAIPreferences").collect();

  console.log(`Found ${allRecords.length} total userAIPreferences records`);

  const recordsToUpdate = allRecords.filter(
    (record) =>
      record.temperature !== undefined || record.maxTokens !== undefined
  );

  console.log(
    `Found ${recordsToUpdate.length} records with temperature or maxTokens to clean`
  );

  for (const record of recordsToUpdate) {
    console.log(`Cleaning record ${record._id} for user ${record.userId}`);

    // Create a clean copy without temperature and maxTokens
    const cleanRecord: any = { ...record };
    delete cleanRecord.temperature;
    delete cleanRecord.maxTokens;
    delete cleanRecord._id;
    delete cleanRecord._creationTime;

    // Update the record
    await ctx.db.patch(record._id, cleanRecord);
    console.log(`✓ Cleaned record ${record._id}`);
  }

  console.log(`Migration complete! Cleaned ${recordsToUpdate.length} records.`);

  return {
    success: true,
    recordsCleaned: recordsToUpdate.length,
    totalRecords: allRecords.length,
  };
});
