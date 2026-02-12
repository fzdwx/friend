// Test the getThemes tool
import { createGetThemesTool } from "./src/tools/index.js";

const manager = {
  addCustomProvider: () => {},
  updateConfig: async () => {},
};

async function test() {
  const getThemesTool = createGetThemesTool(manager);
  const result = await getThemesTool.execute("test-call-1", {}, null, null, {});
  console.log("Themes:");
  console.log(result.content[0].text);
  console.log("\nDetails:");
  console.log(
    JSON.stringify(
      result.details.themes.map((t) => ({
        id: t.id,
        name: t.name,
        mode: t.mode,
        isBuiltIn: t.isBuiltIn,
      })),
      null,
      2,
    ),
  );
}

test().catch(console.error);
