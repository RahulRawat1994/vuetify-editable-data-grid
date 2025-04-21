/**
 * Formats a number according to the specified options.
 *
 * @param {number} value - The number to format.
 * @param {Object} [options={}] - Optional settings for formatting.
 * @param {number} [options.minimumFractionDigits=0] - The minimum number of fraction digits to use.
 * @param {number} [options.maximumFractionDigits=2] - The maximum number of fraction digits to use.
 * @returns {string} - The formatted number as a string.
 */
interface FormatNumberOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function formatNumber(value: string | number | bigint, options: FormatNumberOptions = {}) {
  const { minimumFractionDigits = 0, maximumFractionDigits = 2 } = options;

  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits,
    maximumFractionDigits
  }).format(numericValue);
}