import type {TSESLint, TSESTree} from '@typescript-eslint/utils';

/**
 * Return true if the file's leading directive prologue already contains a
 * `'use client'` or `'use server'` directive. ESTree marks prologue
 * string-literal statements with a `.directive` property; we scan through the
 * prologue (so `'use strict'` followed by `'use client'` is still detected) and
 * stop at the first non-directive statement.
 */
export function hasClientOrServerDirective(
  body: readonly TSESTree.ProgramStatement[],
): boolean {
  for (const statement of body) {
    if (
      statement.type !== 'ExpressionStatement' ||
      typeof statement.directive !== 'string'
    ) {
      // Prologue ended at the first non-directive statement.
      return false;
    }
    if (
      statement.directive === 'use client' ||
      statement.directive === 'use server'
    ) {
      return true;
    }
  }
  return false;
}

/**
 * The shared auto-fixer used by every detector: insert `'use client';` at the
 * top of the file.
 *
 * - If the file starts with a shebang (`#!`), insert right after that line so
 *   the hashbang stays on line 1.
 * - Otherwise insert at absolute offset 0 — above any leading license comment
 *   or other directive (e.g. `'use strict'`), guaranteeing `'use client'` is the
 *   first directive in the prologue. A leading comment does not break the
 *   prologue, and ESLint strips/re-attaches the BOM around the fixed range, so
 *   inserting at [0, 0] is correct.
 */
export function insertUseClientFix(
  fixer: TSESLint.RuleFixer,
  sourceCode: Readonly<TSESLint.SourceCode>,
): TSESLint.RuleFix {
  const directive = "'use client';\n\n";
  const text = sourceCode.getText();
  if (text.startsWith('#!')) {
    const newlineIndex = text.indexOf('\n');
    const insertAt = newlineIndex === -1 ? text.length : newlineIndex + 1;
    return fixer.insertTextBeforeRange([insertAt, insertAt], directive);
  }
  return fixer.insertTextBeforeRange([0, 0], directive);
}
