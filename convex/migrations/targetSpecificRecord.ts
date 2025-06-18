import { internalMutation } from "../_generated/server";

export default internalMutation(async (ctx) => {
  console.log("Targeting the specific problematic record...");

  // The ID from the error message
  const recordId = "jn7f6wz0380cgx2jwq8kqcsje97hs161";

  try {
    // Try to get the record using the raw ID
    const record: any = await ctx.db.get(recordId as any);

    if (record) {
      console.log("Found the record:", JSON.stringify(record, null, 2));

      // Create a clean version by omitting temperature and maxTokens
      const { temperature, maxTokens, _id, _creationTime, ...cleanFields } =
        record;

      console.log(
        "Updating record with clean data (removing temperature and maxTokens)"
      );

      // Replace the entire record with clean data
      await ctx.db.replace(recordId as any, cleanFields);

      console.log("✓ Successfully cleaned the problematic record");

      return {
        success: true,
        recordCleaned: true,
        removedFields: { temperature, maxTokens },
      };
    } else {
      console.log("Record not found with that ID");
      return { success: false, error: "Record not found" };
    }
  } catch (error: any) {
    console.error("Error accessing record:", error);
    return { success: false, error: error.message };
  }
});
