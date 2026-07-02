import type {TSESLint, TSESTree} from '@typescript-eslint/utils';

/**
 * Return true if the file's leading directive prologue already contains a
 * `'use client'` or `'use server'` directive. ESTree marks prologue
 * string-literal statements with a `.directive` property; we scan through the
 * prologue (so `'use strict'` followed by `'use client'` is still detected) and
 * stop at the first non-directive statement.
 */
export function hasClientOrServerDirective(
  body: ReadonlyArray<TSESTree.ProgramStatement>,
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
 * Return the `'use client'` prologue directive statement if one is present, or
 * `null`. Unlike {@link hasClientOrServerDirective} this ignores `'use server'`:
 * an unnecessary-directive check must key on `'use client'` specifically, and it
 * returns the statement node so the directive can be pointed at (and removed).
 */
export function findUseClientDirective(
  body: ReadonlyArray<TSESTree.ProgramStatement>,
): TSESTree.ExpressionStatement | null {
  for (const statement of body) {
    if (
      statement.type !== 'ExpressionStatement' ||
      typeof statement.directive !== 'string'
    ) {
      // Prologue ended at the first non-directive statement.
      return null;
    }
    if (statement.directive === 'use client') {
      return statement;
    }
  }
  return null;
}

/**
 * Remove a `'use client'` directive statement along with the whitespace on its
 * line, so the line disappears cleanly. This backs the removal *suggestion* for
 * an unnecessary directive; it is intentionally NOT an auto-fix, because the
 * detectors can't see every reason a file might legitimately be a client
 * boundary (e.g. it renders an imported client-only component).
 *
 * The directive statement's range includes its trailing `;`; we then consume the
 * rest of that line plus any following blank lines. Prologue directives and the
 * statements after them all sit at column 0, so this never eats another
 * statement's indentation.
 */
export function removeUseClientFix(
  fixer: TSESLint.RuleFixer,
  sourceCode: Readonly<TSESLint.SourceCode>,
  statement: TSESTree.ExpressionStatement,
): TSESLint.RuleFix {
  const text = sourceCode.getText();
  const start = statement.range[0];
  let end = statement.range[1];
  const trailing = /^[ \t]*\r?\n(?:[ \t]*\r?\n)*/.exec(text.slice(end));
  if (trailing) {
    end += trailing[0].length;
  }
  return fixer.removeRange([start, end]);
}

/**
 * The shared auto-fixer used by every detector: insert `'use client';` at the
 * top of the file, but *after* any shebang and any leading comment block.
 *
 * `'use client'` still becomes the first statement (a directive), while leading
 * license headers and `eslint-disable` block comments keep their original
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
