const small = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function words(value) {
  if (value < 20) return small[value];
  if (value < 100)
    return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${small[value % 10]}` : ""}`;
  for (const [unit, label] of [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
    [100, "Hundred"],
  ]) {
    if (value >= unit)
      return `${words(Math.floor(value / unit))} ${label}${value % unit ? ` ${words(value % unit)}` : ""}`;
  }
}

export function amountInWords(value) {
  const paiseTotal = Math.round(Math.abs(Number(value || 0)) * 100);
  const rupees = Math.floor(paiseTotal / 100);
  const paise = paiseTotal % 100;
  return `${Number(value) < 0 ? "Minus " : ""}${words(rupees)} Rupees${paise ? ` and ${words(paise)} Paise` : ""} Only`;
}
