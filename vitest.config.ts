import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `.tsx` was missing here, so a component test would be silently
    // skipped by vitest rather than reported as passing or failing.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Default environment is `node`: this suite is almost entirely pure
    // DSP/schema/model code, and `jsdom` would slow every one of those down
    // for no benefit. If a `.test.tsx` needs a DOM (e.g. React Testing
    // Library), opt that file in individually with a docblock comment at
    // the very top of the file, above the imports:
    //
    //   // @vitest-environment jsdom
    //
    // This requires the `jsdom` package (devDependency) to be installed,
    // which it is — vitest resolves the environment per file when it sees
    // that comment, so the rest of the suite stays on the fast `node` path.
    environment: "node",
  },
});
