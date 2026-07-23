const toHundredths = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return BigInt(Math.round(number * 100));
};

const formatHundredths = (value: bigint) => {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
};

export function isPaymentRatioTotalValid(ratios: unknown[]) {
  const values = ratios.map(toHundredths);
  return values.length > 0
    && values.every((value) => value !== null && value > 0n)
    && values.reduce<bigint>((total, value) => total + (value ?? 0n), 0n) === 10000n;
}

export function calculateStagePlannedAmounts(contractAmount: unknown, ratios: unknown[]) {
  const contractCents = toHundredths(contractAmount);
  const ratioValues = ratios.map(toHundredths);
  if (contractCents === null || contractCents <= 0n) return ratios.map(() => '');

  const amounts = ratioValues.map((ratio) => {
    if (ratio === null || ratio <= 0n) return 0n;
    return (contractCents * ratio + 5000n) / 10000n;
  });
  if (isPaymentRatioTotalValid(ratios) && amounts.length > 0) {
    const previousTotal = amounts.slice(0, -1).reduce((total, amount) => total + amount, 0n);
    amounts[amounts.length - 1] = contractCents - previousTotal;
  }
  return amounts.map((amount, index) => ratioValues[index] === null || ratioValues[index] <= 0n ? '' : formatHundredths(amount));
}

export function deriveStagePaymentRatios(contractAmount: unknown, plannedAmounts: unknown[]) {
  const contractCents = toHundredths(contractAmount);
  const amountValues = plannedAmounts.map(toHundredths);
  if (contractCents === null || contractCents <= 0n) return plannedAmounts.map(() => '');

  const ratios = amountValues.map((amount) => {
    if (amount === null || amount <= 0n) return 0n;
    return (amount * 10000n + contractCents / 2n) / contractCents;
  });
  if (ratios.length > 0 && amountValues.every((amount) => amount !== null && amount >= 0n)) {
    const previousTotal = ratios.slice(0, -1).reduce((total, ratio) => total + ratio, 0n);
    ratios[ratios.length - 1] = 10000n - previousTotal;
  }
  return ratios.map((ratio, index) => amountValues[index] === null || amountValues[index] <= 0n ? '' : formatHundredths(ratio));
}
