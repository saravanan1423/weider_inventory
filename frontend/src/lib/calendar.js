export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function readDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
  );
  return dateKey(date) === value ? date : null;
}

export function addDays(value, days) {
  const date = readDate(value);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function monthDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const cells = Math.ceil((first.getDay() + count) / 7) * 7;
  return Array.from(
    { length: cells },
    (_, index) =>
      new Date(
        first.getFullYear(),
        first.getMonth(),
        index - first.getDay() + 1,
        12,
      ),
  );
}

export function shiftMonth(date, amount) {
  const first = new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
  const lastDay = new Date(
    first.getFullYear(),
    first.getMonth() + 1,
    0,
  ).getDate();
  first.setDate(Math.min(date.getDate(), lastDay));
  return first;
}
