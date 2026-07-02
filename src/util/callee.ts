import type {TSESTree} from '@typescript-eslint/utils';

/**
 * Resolve the simple name of a call expression's callee.
 *
 * - `useState(...)`        -> "useState"   (Identifier)
 * - `React.useState(...)`  -> "useState"   (non-computed MemberExpression)
 * - `obj['useState']()`    -> null         (computed member, out of scope)
 * - `foo()()`              -> null         (call-of-call, out of scope)
 */
export function getCalleeName(
  callee: TSESTree.Expression | TSESTree.Super,
): string | null {
  if (callee.type === 'Identifier') {
    return callee.name;
  }
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier'
  ) {
    return callee.property.name;
  }
  return null;
}
