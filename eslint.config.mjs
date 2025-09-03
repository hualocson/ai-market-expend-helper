import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  // Global configuration for all files
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  // JavaScript recommended config
  pluginJs.configs.recommended,

  // React recommended config
  pluginReact.configs.flat.recommended,

  // TypeScript recommended configs
  ...tseslint.configs.recommended,

  // Custom rules configuration
  {
    rules: {
      // Quote style - using double quotes
      quotes: [
        "error",
        "double",
        {
          avoidEscape: true,
          allowTemplateLiterals: true,
        },
      ],

      // Semicolons
      semi: ["error", "always"],

      // React specific rules
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unknown-property": "off",

      // TypeScript specific rules
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "none",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-empty-object-type": "off",

      // General rules
      "no-case-declarations": "off",
      "no-extra-boolean-cast": "off",

      // Additional useful rules
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: "error",
      curly: "error",
    },

    settings: {
      react: {
        version: "detect",
      },
    },
  },
];
