export type AlphaNumericSortValue = string | number | null | undefined;

const getSortCategory = (value: AlphaNumericSortValue) => {
  const firstCharacter =
    Array.from(
      String(value ?? '')
        .trim()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
    )[0] ?? '';
  if (/^\p{L}$/u.test(firstCharacter)) return 0;
  if (/^\p{N}$/u.test(firstCharacter)) return 1;
  return 2;
};

export const compareAlphaNumericFirst = (
  left: AlphaNumericSortValue,
  right: AlphaNumericSortValue,
  direction: 'asc' | 'desc'
) => {
  const categoryDifference = getSortCategory(left) - getSortCategory(right);
  if (categoryDifference !== 0) return categoryDifference;

  const comparison =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left ?? '').localeCompare(String(right ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
  return direction === 'asc' ? comparison : -comparison;
};

export const sortByTrackTitle = <T extends { name: string }>(
  tracks: readonly T[],
  direction: 'asc' | 'desc'
): T[] =>
  [...tracks].sort((left, right) =>
    compareAlphaNumericFirst(left.name.trim(), right.name.trim(), direction)
  );
