import type {TSESLint, TSESTree} from '@typescript-eslint/utils';

import {getCalleeName} from '../util/callee.js';
import {
  hasClientOrServerDirective,
  insertUseClientFix,
} from '../util/directive.js';

export type MessageIds = 'missingUseClient';

export type Options = [
  {
    hooks?: boolean;
    createContext?: boolean;
    browserApis?: boolean | string[];
    eventHandlers?: boolean;
    allowedHooks?: string[];
    additionalHooks?: string;
  },
];

const DEFAULT_BROWSER_APIS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
];

type Trigger = {node: TSESTree.Node; feature: string};

export const requireUseClient: TSESLint.RuleModule<MessageIds, Options> = {
  defaultOptions: [{}],
  meta: {
    type: 'problem',
    docs: {
      description:
        "Require a top-of-file 'use client' directive in files that use client-only React features (hooks, use(), createContext, browser APIs, or event handlers).",
    },
    fixable: 'code',
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
          allowedHooks: {
            type: 'array',
            items: {type: 'string'},
            uniqueItems: true,
          },
          additionalHooks: {type: 'string'},
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingUseClient:
        'This file uses the client-only React feature "{{feature}}" but is missing the "\'use client\'" directive. Add it to the top of the file.',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const checkHooks = options.hooks ?? true;
    const checkCreateContext = options.createContext ?? true;
    const checkEventHandlers = options.eventHandlers ?? true;
    const allowedHooks = new Set(options.allowedHooks ?? []);
    const additionalHooks = options.additionalHooks
      ? new RegExp(options.additionalHooks)
      : null;

    const browserApisOption = options.browserApis ?? true;
    const checkBrowserApis = browserApisOption !== false;
    const browserApis = new Set(
      Array.isArray(browserApisOption)
        ? browserApisOption
        : DEFAULT_BROWSER_APIS,
    );

    const sourceCode = context.sourceCode;

    let hasDirective = false;
    let firstTrigger: Trigger | null = null;

    /** Record the first offending node; later detectors become no-ops. */
    function record(node: TSESTree.Node, feature: string): void {
      if (firstTrigger === null) {
        firstTrigger = {node, feature};
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
        if (additionalHooks && additionalHooks.test(name)) {
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
      },

      CallExpression(node): void {
        if (hasDirective || firstTrigger) {
          return;
        }
        const feature = classifyCall(getCalleeName(node.callee));
        if (feature) {
          record(node.callee, feature);
        }
      },

      MemberExpression(node): void {
        if (hasDirective || firstTrigger || !checkBrowserApis) {
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
        if (hasDirective || firstTrigger || !checkEventHandlers) {
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
        if (hasDirective || firstTrigger === null) {
          return;
        }
        const trigger: Trigger = firstTrigger;
        context.report({
          // Anchor on the offending node (the call/member/attribute), NOT the
          // Program node, so the editor squiggle points at the violating code
          // instead of the whole file.
          node: trigger.node,
          messageId: 'missingUseClient',
          data: {feature: trigger.feature},
          fix: (fixer) => insertUseClientFix(fixer, sourceCode),
        });
      },
    };
  },
};
