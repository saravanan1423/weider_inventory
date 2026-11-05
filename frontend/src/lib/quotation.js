import { addDays, readDate } from "./calendar.js";

export const currency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
export const round = (value) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
export const signedCurrency = (value) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${currency(Math.abs(value))}`;
export const party = () => ({
  name: "",
  address1: "",
  address2: "",
  city: "",
  district: "",
  state: "",
  pin: "",
  gst: "",
  contactName: "",
  phone: "",
  email: "",
});
export const newItem = () => ({
  name: "",
  hsn: "",
  quantity: 1,
  unit: "No's",
  price: "",
  discount: 0,
  tax: 18,
  warranty: "no",
  years: 1,
  coverage: "service",
});
export function newQuotation() {
  const date = new Date();
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return {
    date: localDate,
    billTo: party(),
    shipTo: party(),
    items: [newItem()],
    freight: "to_pay",
    freightCharges: 0,
    deliveryTime: "7–10 working days",
    validity: addDays(localDate, 15),
    notes: "",
  };
}
export function taxMode(state = "") {
  const normalized = state.toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return "unspecified";
  return ["tn", "tamilnadu"].includes(normalized) ? "intra" : "inter";
}
export function appliedTaxRate(item, state) {
  return taxMode(state) === "inter" ? 18 : Number(item.tax);
}
export function itemTax(item, state) {
  const net =
    Number(item.quantity) *
    Number(item.price) *
    (1 - Number(item.discount) / 100);
  const rate = appliedTaxRate(item, state);
  const half = taxMode(state) === "intra" ? round((net * rate) / 200) : 0;
  const tax =
    taxMode(state) === "intra" ? round(half * 2) : round((net * rate) / 100);
  return { net, rate, tax, cgst: half, sgst: half };
}
export function lineTotal(item, state) {
  const { net, tax } = itemTax(item, state);
  return round(net + tax);
}
export function totals(quote) {
  const mode = taxMode(quote.billTo?.state);
  const buckets = new Map();
  let subtotal = 0,
    discount = 0,
    tax = 0;
  quote.items.forEach((item) => {
    const gross = Number(item.quantity) * Number(item.price);
    const reduction = (gross * Number(item.discount)) / 100;
    subtotal += gross;
    discount += reduction;
    const amounts = itemTax(item, quote.billTo?.state);
    tax += amounts.tax;
    buckets.set(
      amounts.rate,
      round(
        (buckets.get(amounts.rate) || 0) +
          (mode === "intra" ? amounts.cgst : amounts.tax),
      ),
    );
  });
  const taxBreakdown = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([rate, amount]) =>
      mode === "intra"
        ? [
            { label: `CGST @ ${rate / 2}%`, amount },
            { label: `SGST @ ${rate / 2}%`, amount },
          ]
        : [
            {
              label: `${mode === "inter" ? "IGST" : "GST"} @ ${rate}%`,
              amount,
            },
          ],
    );
  tax = round(tax);
  const freight = Number(quote.freightCharges);
  const unroundedTotal = round(subtotal - discount + tax + freight);
  const total = Math.round(unroundedTotal);
  const roundOff = round(total - unroundedTotal) || 0;
  return {
    subtotal,
    discount,
    taxable: subtotal - discount,
    tax,
    taxMode: mode,
    taxBreakdown,
    cgst: mode === "intra" ? round(tax / 2) : 0,
    sgst: mode === "intra" ? round(tax / 2) : 0,
    igst: mode === "inter" ? tax : 0,
    freight,
    unroundedTotal,
    roundOff,
    total,
  };
}

export function quoteValidityDate(quote) {
  return readDate(quote.validity) ? quote.validity : addDays(quote.date, 15);
}

export function updateQuotationField(quote, key, value) {
  if (key === "date") {
    const followsDate =
      !readDate(quote.validity) || quote.validity === addDays(quote.date, 15);
    return {
      ...quote,
      date: value,
      validity: followsDate ? addDays(value, 15) : quote.validity,
    };
  }
  return { ...quote, [key]: value };
}
