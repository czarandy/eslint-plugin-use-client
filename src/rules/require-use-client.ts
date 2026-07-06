import type {TSESLint, TSESTree} from '@typescript-eslint/utils';

import {getCalleeName} from '../util/callee.js';
import {
  findUseClientDirective,
  hasClientOrServerDirective,
  insertUseClientFix,
  removeUseClientFix,
} from '../util/directive.js';

export type MessageIds =
  | 'missingUseClient'
  | 'missingUseClientModule'
  | 'unnecessaryUseClient'
  | 'removeUseClient';

export type Options = [
  {
    hooks?: boolean;
    createContext?: boolean;
    browserApis?: boolean | string[];
    eventHandlers?: boolean;
    removeUnnecessary?: boolean;
    allowedHooks?: string[];
    additionalHooks?: string;
    clientOnlyModules?: string[];
  },
];

const DEFAULT_BROWSER_APIS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
];

type Trigger = {
  node: TSESTree.Node;
  feature: string;
  messageId: 'missingUseClient' | 'missingUseClientModule';
};

export const requireUseClient: TSESLint.RuleModule<MessageIds, Options> = {
  defaultOptions: [{}],
  meta: {
    type: 'problem',
    docs: {
      description:
        "Require a top-of-file 'use client' directive in files that use client-only React features (hooks, use(), createContext, browser APIs, or event handlers), and flag a 'use client' directive in files that use none of them.",
    },
    fixable: 'code',
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        properties: {
          hooks: {type: 'boolean'},
          createContext: {type: 'boolean'},
          browserApis: {
            oneOf: [
              {type: 'boolean'},
              {type: 'array', items: {type: 'string'}, uniqueItems: true},
            ],
          },
          eventHandlers: {type: 'boolean'},
          removeUnnecessary: {type: 'boolean'},
          allowedHooks: {
            type: 'array',
            items: {type: 'string'},
            uniqueItems: true,
          },
          additionalHooks: {type: 'string'},
          clientOnlyModules: {
            type: 'array',
            items: {type: 'string'},
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingUseClient:
        'This file uses the client-only React feature "{{feature}}" but is missing the "\'use client\'" directive. Add it to the top of the file.',
      missingUseClientModule:
        'This file imports the client-only module "{{feature}}" but is missing the "\'use client\'" directive. Add it to the top of the file.',
      unnecessaryUseClient:
        'This file has a "\'use client\'" directive but does not use any client-only React feature. Remove it so the module can render on the server.',
      removeUseClient: "Remove the unnecessary 'use client' directive.",
    },
  },
  create(context) {
    // context.options is typed as a fixed tuple, but at runtime ESLint passes
    // an empty array when the rule is configured without options, so options[0]
    // can be undefined despite the type. The `?? {}` fallback is required.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const options = context.options[0] ?? {};
    const checkHooks = options.hooks ?? true;
    const checkCreateContext = options.createContext ?? true;
    const checkEventHandlers = options.eventHandlers ?? true;
    const checkUnnecessary = options.removeUnnecessary ?? true;
    const allowedHooks = new Set(options.allowedHooks ?? []);
    const additionalHooks = options.additionalHooks
      ? new RegExp(options.additionalHooks)
      : null;
    const clientOnlyModules = options.clientOnlyModules ?? [];

    const browserApisOption = options.browserApis ?? true;
    const checkBrowserApis = browserApisOption !== false;
    const browserApis = new Set(
      Array.isArray(browserApisOption)
        ? browserApisOption
        : DEFAULT_BROWSER_APIS,
    );

    const sourceCode = context.sourceCode;

    let hasDirective = false;
    let useClientNode: TSESTree.ExpressionStatement | null = null;
    let firstTrigger: Trigger | null = null;

    /** Record the first offending node; later detectors become no-ops. */
    function record(
      node: TSESTree.Node,
      feature: string,
      messageId: Trigger['messageId'] = 'missingUseClient',
    ): void {
      firstTrigger ??= {node, feature, messageId};
    }

    /**
     * If `source` names one of the configured `clientOnlyModules`, return the
     * matching pattern, else `null`. A pattern matches its own bare specifier
     * and any subpath (`framer-motion` matches `framer-motion/dom`), so listing
     * a package covers its deep imports too.
     */
    function matchClientOnlyModule(source: string): string | null {
      for (const module of clientOnlyModules) {
        if (source === module || source.startsWith(`${module}/`)) {
          return module;
        }
      }
      return null;
    }

    /**
     * Flag a static `import`/`export ... from` of a client-only module. Skips
     * type-only imports/re-exports — they pull no runtime code and so create no
     * client boundary.
     */
    function checkModuleSource(
      node:
        | TSESTree.ImportDeclaration
        | TSESTree.ExportAllDeclaration
        | TSESTree.ExportNamedDeclaration,
    ): void {
      if (firstTrigger || clientOnlyModules.length === 0) {
        return;
      }
      const kind =
        node.type === 'ImportDeclaration' ? node.importKind : node.exportKind;
      if (kind === 'type') {
        return;
      }
      const {source} = node;
      if (source === null || typeof source.value !== 'string') {
        return;
      }
      const matched = matchClientOnlyModule(source.value);
      if (matched) {
        record(source, matched, 'missingUseClientModule');
      }
    }

    /** Classify a callee name as a hook/createContext trigger, or null. */
    function classifyCall(name: string | null): string | null {
      if (name === null || allowedHooks.has(name)) {
        return null;
      }
      if (checkHooks) {
        // React 19 `use(...)`, then the standard `use[A-Z]` convention, then
        // any user-supplied `additionalHooks` pattern.
        if (name === 'use') {
          return 'use';
        }
        if (/^use[A-Z]/.test(name)) {
          return name;
        }
        if (additionalHooks?.test(name)) {
          return name;
        }
      }
      if (checkCreateContext && name === 'createContext') {
        return 'createContext';
      }
      return null;
    }

    /** True if `name` is declared as a local binding at `node` (shadows a global). */
    function isLocallyDeclared(name: string, node: TSESTree.Node): boolean {
      let scope: ReturnType<typeof sourceCode.getScope> | null =
        sourceCode.getScope(node);
      while (scope) {
        const variable = scope.set.get(name);
        if (variable && variable.defs.length > 0) {
          return true;
        }
        scope = scope.upper;
      }
      return false;
    }

    return {
      Program(node): void {
        hasDirective = hasClientOrServerDirective(node.body);
        useClientNode = findUseClientDirective(node.body);
      },

      // NOTE: the detectors keep scanning even when a directive is present. The
      // missing-directive report is suppressed at `Program:exit` when
      // `hasDirective` is set, but the unnecessary-directive report needs to know
      // whether *any* client feature was used — so `firstTrigger` must be
      // populated regardless. Detection still stops after the first trigger.
      ImportDeclaration(node): void {
        checkModuleSource(node);
      },

      ExportAllDeclaration(node): void {
        checkModuleSource(node);
      },

      ExportNamedDeclaration(node): void {
        checkModuleSource(node);
      },

      CallExpression(node): void {
        if (firstTrigger) {
          return;
        }
        const feature = classifyCall(getCalleeName(node.callee));
        if (feature) {
          record(node.callee, feature);
        }
      },

      MemberExpression(node): void {
        if (firstTrigger || !checkBrowserApis) {
          return;
        }
        const {object} = node;
        if (
          object.type === 'Identifier' &&
          browserApis.has(object.name) &&
          !isLocallyDeclared(object.name, node)
        ) {
          record(object, object.name);
        }
      },

      JSXAttribute(node): void {
        if (firstTrigger || !checkEventHandlers) {
          return;
        }
        if (
          node.name.type === 'JSXIdentifier' &&
          /^on[A-Z]/.test(node.name.name) &&
          node.value?.type === 'JSXExpressionContainer'
        ) {
          record(node.name, node.name.name);
        }
      },

      'Program:exit'(): void {
        if (hasDirective) {
          // The file already opts into a directive. If it's a `'use client'`
          // that no client-only feature justifies, flag it as unnecessary (and
          // offer removal as a suggestion, not an auto-fix — see
          // `removeUseClientFix`).
          if (checkUnnecessary && useClientNode && firstTrigger === null) {
            const directiveNode: TSESTree.ExpressionStatement = useClientNode;
            context.report({
              node: directiveNode,
              messageId: 'unnecessaryUseClient',
              suggest: [
                {
                  messageId: 'removeUseClient',
                  fix: fixer =>
                    removeUseClientFix(fixer, sourceCode, directiveNode),
                },
              ],
            });
          }
          return;
        }
        if (firstTrigger === null) {
          return;
        }
        const trigger: Trigger = firstTrigger;
        context.report({
          // Anchor on the offending node (the call/member/attribute/import),
          // NOT the Program node, so the editor squiggle points at the violating
          // code instead of the whole file.
          node: trigger.node,
          messageId: trigger.messageId,
          data: {feature: trigger.feature},
          fix: fixer => insertUseClientFix(fixer, sourceCode),
        });
      },
    };
  },
};
