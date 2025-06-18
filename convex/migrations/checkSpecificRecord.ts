import { internalQuery } from "../_generated/server";

export default internalQuery(async (ctx) => {
  console.log("Checking specific record that caused validation error...");

  // Get the specific record that caused the error
  const specificRecord = await ctx.db.get(
    "jn7f6wz0380cgx2jwq8kqcsje97hs161" as any
  );

  if (specificRecord) {
    console.log(
      "Found the problematic record:",
      JSON.stringify(specificRecord, null, 2)
    );

    // Check what fields it has
    const fields = Object.keys(specificRecord);
    console.log("Record fields:", fields);

    // Check for temperature and maxTokens specifically
    const hasTemperature = "temperature" in specificRecord;
    const hasMaxTokens = "maxTokens" in specificRecord;

    console.log(`Has temperature: ${hasTemperature}`);
    console.log(`Has maxTokens: ${hasMaxTokens}`);

    return {
      record: specificRecord,
      hasTemperature,
      hasMaxTokens,
      fields,
    };
  } else {
    console.log("Record not found");
    return { record: null };
  }
});
