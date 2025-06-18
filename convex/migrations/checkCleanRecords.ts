import { internalMutation } from "../_generated/server";

export default internalMutation(async (ctx) => {
  console.log("Checking all userAIPreferences records...");

  const allRecords = await ctx.db.query("userAIPreferences").collect();

  console.log(`Found ${allRecords.length} total records`);

  const recordsWithTempFields = allRecords.filter(
    (record) =>
      record.temperature !== undefined || record.maxTokens !== undefined
  );

  console.log(
    `Found ${recordsWithTempFields.length} records with temperature or maxTokens`
  );

  if (recordsWithTempFields.length > 0) {
    console.log("Records with temp fields:", recordsWithTempFields);
  } else {
    console.log(
      "All records are clean! Safe to remove temp fields from schema."
    );
  }

  return {
    totalRecords: allRecords.length,
    recordsWithTempFields: recordsWithTempFields.length,
    isClean: recordsWithTempFields.length === 0,
  };
});
