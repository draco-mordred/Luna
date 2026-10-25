export type AlphaNumericSortValue = string | number | null | undefined;

const startsWithAlphaNumeric = (value: AlphaNumericSortValue) =>
  /^[\p{L}\p{N}]/u.test(
    String(value ?? '')
      .trim()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
  );

export const compareAlphaNumericFirst = (
  left: AlphaNumericSortValue,
  right: AlphaNumericSortValue,
  direction: 'asc' | 'desc'
) => {
  const leftIsAlphaNumeric = startsWithAlphaNumeric(left);
  const rightIsAlphaNumeric = startsWithAlphaNumeric(right);
  if (leftIsAlphaNumeric !== rightIsAlphaNumeric) return leftIsAlphaNumeric ? -1 : 1;

  const comparison =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left ?? '').localeCompare(String(right ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
  return direction === 'asc' ? comparison : -comparison;
};
