import {RuleTester} from 'eslint';
import tseslint from 'typescript-eslint';

import {requireUseClient} from '../src/rules/require-use-client.js';

// eslint's RuleTester expects its own RuleModule shape; the rule is authored
// with typescript-eslint's RuleCreator, which is runtime-compatible.
const rule = requireUseClient as unknown as Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {ecmaFeatures: {jsx: true}},
  },
});

const directive = "'use client';\n\n";

ruleTester.run('require-use-client', rule, {
  valid: [
    {
      name: 'already has use client',
      code: "'use client';\nimport {useState} from 'react';\nfunction C(){const [n]=useState(0);return n;}",
    },
    {
      name: 'already has use server',
      code: "'use server';\nexport async function action(){}",
    },
    {
      name: 'plain server component, no client feature',
      code: 'export function Page(){return null;}',
      filename: 'Page.tsx',
    },
    {
      name: 'allowedHooks exempts a custom hook',
      code: 'export const x = useThing();',
      options: [{allowedHooks: ['useThing']}],
    },
    {
      name: 'createContext detector disabled',
      code: 'export const Ctx = createContext(null);',
      options: [{createContext: false}],
    },
    {
      name: 'hooks detector disabled',
      code: 'function C(){const [x]=useState(0);return x;}',
      options: [{hooks: false}],
      filename: 'C.tsx',
    },
    {
      name: 'lowercase useful() is not a hook',
      code: 'export const y = useful();',
    },
    {
      name: 'hook referenced but not called',
      code: 'export const ref = useState;',
    },
    {
      name: 'use() exempted via allowedHooks',
      code: 'export const v = use(x);',
      options: [{allowedHooks: ['use']}],
    },
    {
      name: 'local window shadows the global',
      code: 'export function C(){const window = {}; window.foo; return null;}',
      filename: 'C.tsx',
    },
    {
      name: 'string-valued onClick is not a client handler',
      code: 'export const x = <button onClick="save" />;',
      filename: 'x.tsx',
    },
    {
      name: 'browserApis detector disabled',
      code: "document.getElementById('x');",
      options: [{browserApis: false}],
    },
    {
      name: 'eventHandlers detector disabled',
      code: 'export const x = <button onClick={fn} />;',
      options: [{eventHandlers: false}],
      filename: 'x.tsx',
    },
  ],
  invalid: [
    {
      name: 'hook inside a component',
      code: 'function Counter(){const [c,setC]=useState(0);return c;}',
      filename: 'Counter.tsx',
      output:
        directive + 'function Counter(){const [c,setC]=useState(0);return c;}',
      errors: [{messageId: 'missingUseClient', data: {feature: 'useState'}}],
    },
    {
      name: 'custom-hook file (the differentiator)',
      code: 'export function useDialog(){const [o,setO]=useState(false);return o;}',
      output:
        directive +
        'export function useDialog(){const [o,setO]=useState(false);return o;}',
      errors: [{messageId: 'missingUseClient', data: {feature: 'useState'}}],
    },
    {
      name: 'module-scope hook call',
      code: 'export const theme = useTheme();',
      output: directive + 'export const theme = useTheme();',
      errors: [{messageId: 'missingUseClient', data: {feature: 'useTheme'}}],
    },
    {
      name: 'React.useEffect member call',
      code: "import * as React from 'react';\nfunction C(){React.useEffect(()=>{});return null;}",
      filename: 'C.tsx',
      output:
        directive +
        "import * as React from 'react';\nfunction C(){React.useEffect(()=>{});return null;}",
      errors: [{messageId: 'missingUseClient', data: {feature: 'useEffect'}}],
    },
    {
      name: 'bare use(Ctx) React 19 hook',
      code: 'function C(){const v = use(Ctx);return v;}',
      filename: 'C.tsx',
      output: directive + 'function C(){const v = use(Ctx);return v;}',
      errors: [{messageId: 'missingUseClient', data: {feature: 'use'}}],
    },
    {
      name: 'createContext (default on)',
      code: 'export const Ctx = createContext(null);',
      output: directive + 'export const Ctx = createContext(null);',
      errors: [
        {messageId: 'missingUseClient', data: {feature: 'createContext'}},
      ],
    },
    {
      name: 'React.createContext',
      code: "import React from 'react';\nexport const Ctx = React.createContext(null);",
      output:
        directive +
        "import React from 'react';\nexport const Ctx = React.createContext(null);",
      errors: [
        {messageId: 'missingUseClient', data: {feature: 'createContext'}},
      ],
    },
    {
      name: 'additionalHooks matches a non-use-prefixed hook',
      code: 'export const s = atom(0);',
      options: [{additionalHooks: '^atom$'}],
      output: directive + 'export const s = atom(0);',
      errors: [{messageId: 'missingUseClient', data: {feature: 'atom'}}],
    },
    {
      name: 'browser API: window',
      code: "window.addEventListener('resize', fn);",
      output: directive + "window.addEventListener('resize', fn);",
      errors: [{messageId: 'missingUseClient', data: {feature: 'window'}}],
    },
    {
      name: 'browser API: document',
      code: "export const el = document.getElementById('x');",
      output: directive + "export const el = document.getElementById('x');",
      errors: [{messageId: 'missingUseClient', data: {feature: 'document'}}],
    },
    {
      name: 'JSX event handler',
      code: 'export const x = <button onClick={fn} />;',
      filename: 'x.tsx',
      output: directive + 'export const x = <button onClick={fn} />;',
      errors: [{messageId: 'missingUseClient', data: {feature: 'onClick'}}],
    },
    {
      name: 'shebang: directive goes after the hashbang line',
      code: '#!/usr/bin/env node\nconst s = useState(0);\n',
      output: "#!/usr/bin/env node\n'use client';\n\nconst s = useState(0);\n",
      errors: [{messageId: 'missingUseClient', data: {feature: 'useState'}}],
    },
    {
      name: "existing 'use strict': directive goes above it",
      code: "'use strict';\nconst s = useState(0);\n",
      output: "'use client';\n\n'use strict';\nconst s = useState(0);\n",
      errors: [{messageId: 'missingUseClient', data: {feature: 'useState'}}],
    },
    {
      name: 'leading eslint-disable comment: directive goes below it (not above)',
      code: '/* eslint-disable no-console */\nconst s = useState(0);\n',
      output:
        "/* eslint-disable no-console */\n'use client';\nconst s = useState(0);\n",
      errors: [{messageId: 'missingUseClient', data: {feature: 'useState'}}],
    },
    {
      name: 'leading line-comment block: directive goes below it',
      code: '// Copyright\n// header\nconst s = useState(0);\n',
      output:
        "// Copyright\n// header\n'use client';\nconst s = useState(0);\n",
      errors: [{messageId: 'missingUseClient', data: {feature: 'useState'}}],
    },
    {
      name: 'shebang + leading comment: directive goes below both',
      code: '#!/usr/bin/env node\n/* header */\nconst s = useState(0);\n',
      output:
        "#!/usr/bin/env node\n/* header */\n'use client';\nconst s = useState(0);\n",
      errors: [{messageId: 'missingUseClient', data: {feature: 'useState'}}],
    },
    {
      name: 'report anchors on the offending node, not the whole file',
      code: 'function C() {\n  const t = useTheme();\n  return t;\n}',
      filename: 'C.tsx',
      output:
        directive + 'function C() {\n  const t = useTheme();\n  return t;\n}',
      errors: [
        {
          messageId: 'missingUseClient',
          data: {feature: 'useTheme'},
          line: 2,
          column: 13,
        },
      ],
    },
    {
      name: 'two detectors trip, but exactly one report + one fix',
      code: 'function C(){useEffect(()=>{});return <button onClick={fn} />;}',
      filename: 'C.tsx',
      output:
        directive +
        'function C(){useEffect(()=>{});return <button onClick={fn} />;}',
      errors: [{messageId: 'missingUseClient', data: {feature: 'useEffect'}}],
    },
  ],
});
