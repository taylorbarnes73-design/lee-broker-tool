import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "client/**",
      "drizzle/**",
      "vendor/**",
      "scripts/**",
      "e2e/**",
      "*.config.js",
      "*.config.ts",
    ],
  },
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ["server/**/*.ts", "shared/**/*.ts"],
  })),
  {
    files: ["server/**/*.ts", "shared/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-control-regex": "off",
      "no-useless-escape": "off",
      "prefer-const": "off",
      "no-empty": "off",
    },
  }
);
