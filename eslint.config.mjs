import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Arabic-Indic (U+0660-0669) and Extended Arabic-Indic (U+06F0-06F9) digit
// ranges, built from code points so this file never contains the characters it
// forbids — otherwise the rule below flags its own source.
const AR_INDIC = "\\u0660-\\u0669\\u06F0-\\u06F9";
const DIGITS_MESSAGE =
  "Use Western digits (0-9), not Arabic-Indic ones — the shop renders every number in Western digits (prices via priceFmt, dates via the ar-DZ locale, and hand-written counts).";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // The storefront is Arabic, so Arabic-Indic digits are an easy
  // thing to type by reflex — but the shop shows numbers in Western digits
  // everywhere: prices via priceFmt(), dates via the ar-DZ locale (which
  // resolves to `latn`), and every hand-written count. One stray Arabic-Indic
  // number in a label
  // sits next to a Western price and looks like a bug.
  //
  // This is a lint rule rather than a one-time cleanup because a one-time
  // cleanup is exactly what drifts back: the next Arabic string somebody types
  // is where it returns. JSX text and string literals are both covered.
  {
    name: "desert-shop/western-digits",
    // Scoped to source, not the whole project: the selectors below necessarily
    // contain the very characters they forbid, so an unscoped rule flags this
    // config file itself.
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}", "stores/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=/[${AR_INDIC}]/]`,
          message: DIGITS_MESSAGE,
        },
        {
          selector: `JSXText[value=/[${AR_INDIC}]/]`,
          message: DIGITS_MESSAGE,
        },
        {
          selector: `TemplateElement[value.raw=/[${AR_INDIC}]/]`,
          message: DIGITS_MESSAGE,
        },
      ],
    },
  },
]);

export default eslintConfig;
