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
 * top of the file, but *after* any shebang and any leading comment block.
 *
 * `'use client'` still becomes the first statement (a directive), while leading
 * license headers and `/* eslint-disable *​/` directives keep their original
 * line positions. Inserting *above* a leading comment would displace it — which
 * silently breaks file-level `eslint-disable` comments that suppress rules
 * anchored to line 1.
 *
 * - A shebang (`#!`) stays on line 1.
 * - A contiguous run of leading comments (separated from the top only by
 *   whitespace) is preserved; the directive goes right after it.
 * - Otherwise the directive is inserted at absolute offset 0. ESLint strips and
 *   re-attaches the BOM around the fixed range, so inserting at [0, 0] is
 *   correct.
 */
export function insertUseClientFix(
  fixer: TSESLint.RuleFixer,
  sourceCode: Readonly<TSESLint.SourceCode>,
): TSESLint.RuleFix {
  const directive = "'use client';";
  const text = sourceCode.getText();

  // 1) Skip a shebang line.
  let offset = 0;
  if (text.startsWith('#!')) {
    const newlineIndex = text.indexOf('\n');
    offset = newlineIndex === -1 ? text.length : newlineIndex + 1;
  }

  // 2) Skip a contiguous block of leading comments. A comment counts as leading
  //    only if everything between the current offset and it is whitespace.
  let afterComments = offset;
  for (const comment of sourceCode.getAllComments()) {
    if (comment.range[0] < afterComments) {
      continue;
    }
    if (/\S/.test(text.slice(afterComments, comment.range[0]))) {
      break;
    }
    afterComments = comment.range[1];
  }

  if (afterComments > offset) {
    // After a leading comment block: newline + directive right below it.
    return fixer.insertTextAfterRange(
      [afterComments, afterComments],
      `\n${directive}`,
    );
  }
  if (offset > 0) {
    // After a shebang only: directive on its own line, then a blank line.
    return fixer.insertTextAfterRange([offset, offset], `${directive}\n\n`);
  }
  // Top of file.
  return fixer.insertTextBeforeRange([0, 0], `${directive}\n\n`);
}
