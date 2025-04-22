export function formatNumber(value, options = {}) {
    const { minimumFractionDigits = 0, maximumFractionDigits = 2 } = options;
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat(undefined, {
        minimumFractionDigits,
        maximumFractionDigits
    }).format(numericValue);
}
