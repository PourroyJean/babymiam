import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [
      ".next/**",
      ".next-e2e/**",
      ".next-e2e-degraded/**",
      "node_modules/**",
      ".vercel/**"
    ]
  },
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "import/no-anonymous-default-export": "off"
    }
  }
];

export default config;
