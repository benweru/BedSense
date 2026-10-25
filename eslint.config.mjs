import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextCoreWebVitals,
  {
    ignores: ["coverage/**", "vitest.config.ts"],
  },
];

export default config;
