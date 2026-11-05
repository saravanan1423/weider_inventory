import React, { useEffect, useRef, useState } from "react";
import {
  FileText,
  Plus,
  Eye,
  Save,
  X,
  Check,
  UserRound,
  Truck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import WorkspaceSidebar from "./components/WorkspaceSidebar";
import Field from "./components/Field";
import DatePicker from "./components/DatePicker";
import CollapsibleSection from "./components/CollapsibleSection";
import PartyForm from "./components/PartyForm";
import ItemsTable from "./components/ItemsTable";
import QuotationTerms from "./components/QuotationTerms";
import QuotationList from "./components/QuotationList";
import QuotationPreview from "./components/QuotationPreview";
import {
  newQuotation,
  totals,
  quoteValidityDate,
  updateQuotationField,
} from "./lib/quotation";
import { api } from "./lib/api";

export default function App() {
  const [quote, setQuote] = useState(newQuotation);
  const [view, setView] = useState("editor");
  const [quotes, setQuotes] = useState([]);
  const [nextNumber, setNextNumber] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const editorDrafts = useRef(new Map());
  const editorRequest = useRef(0);
  const [same, setSame] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewQuote, setPreviewQuote] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const previewRequest = useRef(0);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const current = {
    ...quote,
    validity: quoteValidityDate(quote),
    ...(same ? { shipTo: quote.billTo } : {}),
    number: quote.number || nextNumber,
  };
  const sum = totals(current);
  const previewCurrent = previewQuote || current;
  const orderedQuotes = [...quotes].sort((a, b) => a.id - b.id);
  const editorIndex = orderedQuotes.findIndex((saved) => saved.id === quote.id);
  const previousEditorId =
    editorIndex < 0
      ? orderedQuotes.at(-1)?.id
      : orderedQuotes[editorIndex - 1]?.id;
  const nextEditorId =
    editorIndex < 0 ? undefined : orderedQuotes[editorIndex + 1]?.id;
  const previewIndex = orderedQuotes.findIndex(
    (saved) => saved.id === previewCurrent.id,
  );
  const previousId =
    previewIndex < 0
      ? orderedQuotes.at(-1)?.id
      : orderedQuotes[previewIndex - 1]?.id;
  const nextId =
    previewIndex < 0 ? undefined : orderedQuotes[previewIndex + 1]?.id;

  function showPreview() {
    previewRequest.current += 1;
    setPreviewQuote(null);
    setPreviewError("");
    setPreviewLoading(false);
    setPreview(true);
  }
  function closePreview() {
    previewRequest.current += 1;
    setPreview(false);
    setPreviewQuote(null);
    setPreviewLoading(false);
    setPreviewError("");
  }
  async function navigatePreview(id) {
    if (!id || previewLoading) return;
    const requestId = ++previewRequest.current;
    setPreviewError("");
    if (id === quote.id) {
      setPreviewQuote(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const saved = await api(`/quotations/${id}`);
      if (requestId === previewRequest.current) setPreviewQuote(saved);
    } catch (error) {
      if (requestId === previewRequest.current) setPreviewError(error.message);
    } finally {
      if (requestId === previewRequest.current) setPreviewLoading(false);
    }
  }
  async function load() {
    try {
      const [savedQuotes, next] = await Promise.all([
        api("/quotations"),
        api("/quotations/next-number"),
      ]);
      const quotationsWithValidity = await Promise.all(
        savedQuotes.map(async (saved) => {
          // Older running Flask instances do not include validity in list responses.
          if (Object.prototype.hasOwnProperty.call(saved, "validity"))
            return saved;
          try {
            const details = await api(`/quotations/${saved.id}`);
            return { ...saved, validity: details.validity };
          } catch {
            return { ...saved, validityUnavailable: true };
          }
        }),
      );
      setQuotes(quotationsWithValidity);
      setNextNumber(next.number);
    } catch (error) {
      setError(error.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!preview) return;
    const handleKey = (event) => {
      if (event.key === "Escape") closePreview();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [preview]);
  const update = (key, value) =>
    setQuote((previous) => updateQuotationField(previous, key, value));
  const updateItem = (index, key, value) =>
    setQuote((previous) => ({
      ...previous,
      items: previous.items.map((item, n) =>
        n === index ? { ...item, [key]: value } : item,
      ),
    }));
  const newQuote = () => {
    editorRequest.current += 1;
    setQuoteLoading(false);
    if (quote.id) editorDrafts.current.set(quote.id, { quote, same });
    const draft = quote.id ? editorDrafts.current.get("new") : null;
    if (!quote.id) editorDrafts.current.delete("new");
    setQuote(draft?.quote || newQuotation());
    setSame(draft?.same || false);
    setView("editor");
    setError("");
    load();
  };
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await api("/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current),
      });
      setQuote(saved);
      if (!quote.id) editorDrafts.current.delete("new");
      editorDrafts.current.set(saved.id, { quote: saved, same });
      setNotice(`${saved.number} saved successfully`);
      await load();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function open(id) {
    if (!id) return;
    if (id === quote.id) {
      setView("editor");
      return;
    }
    const requestId = ++editorRequest.current;
    setQuoteLoading(true);
    try {
      const target = editorDrafts.current.get(id) || {
        quote: await api(`/quotations/${id}`),
        same: false,
      };
      if (requestId !== editorRequest.current) return;
      editorDrafts.current.set(quote.id || "new", { quote, same });
      setQuote(target.quote);
      setSame(target.same);
      setView("editor");
      setError("");
    } catch (error) {
      if (requestId === editorRequest.current) setError(error.message);
    } finally {
      if (requestId === editorRequest.current) setQuoteLoading(false);
    }
  }
  return (
    <div className="app erp-sidebar-layout flex h-screen w-full flex-col overflow-hidden md:flex-row">
      <WorkspaceSidebar
        view={view}
        count={quotes.length}
        newQuote={newQuote}
        setView={(value) => {
          setView(value);
          if (value === "list") load();
        }}
      />
      <main className="main">
        <header className="page-heading">
          <h1>
            <FileText size={28} strokeWidth={1.8} />
            {view === "editor" ? "Sales Quotation" : "Quotation Dashboard"}
          </h1>
          <div className="heading-actions">
            {view === "editor" && (
              <div
                className="quotation-record-navigation"
                role="group"
                aria-label="Browse saved quotations"
              >
                <button
                  type="button"
                  className="button"
                  aria-label="Previous quotation"
                  disabled={!previousEditorId || busy || quoteLoading}
                  onClick={() => open(previousEditorId)}
                >
                  <ChevronLeft size={18} />
                  Previous
                </button>
                <span className="quotation-record-position" aria-live="polite">
                  {quoteLoading
                    ? "Loading…"
                    : editorIndex >= 0
                      ? `${editorIndex + 1} / ${orderedQuotes.length}`
                      : "New"}
                </span>
                <button
                  type="button"
                  className="button"
                  aria-label="Next quotation"
                  disabled={!nextEditorId || busy || quoteLoading}
                  onClick={() => open(nextEditorId)}
                >
                  Next
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
            <button
              className="button new-button"
              onClick={newQuote}
              disabled={busy || quoteLoading}
            >
              <Plus size={18} />
              New Quote
            </button>
            {view === "editor" && (
              <>
                <button className="button" onClick={showPreview}>
                  <Eye size={18} />
                  Preview
                </button>
                <button
                  className="button primary"
                  type="submit"
                  form="quotation-form"
                  disabled={busy || quoteLoading}
                >
                  <Save size={18} />
                  {busy ? "Saving…" : "Save Quotation"}
                </button>
              </>
            )}
          </div>
        </header>
        {error && (
          <div className="alert" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {view === "editor" ? (
          <form id="quotation-form" onSubmit={save}>
            <CollapsibleSection
              className="quote-information"
              id="quotation-information-heading"
              title="Quotation Information"
              icon={FileText}
            >
              <div className="card quote-meta">
                <Field label="S.No">
                  <input
                    value={current.number || "…"}
                    readOnly
                    aria-label="Quotation number"
                  />
                </Field>
                <Field label="Date" required>
                  <DatePicker
                    value={quote.date}
                    onChange={(value) => update("date", value)}
                  />
                </Field>
                <Field
                  label="Delivery Time"
                  value={quote.deliveryTime}
                  onChange={(event) =>
                    update("deliveryTime", event.target.value)
                  }
                />
                <Field label="Quote Validity">
                  <DatePicker
                    value={current.validity}
                    onChange={(value) => update("validity", value)}
                    label="Choose quote validity date"
                    title="Select Validity Date"
                  />
                </Field>
              </div>
            </CollapsibleSection>
            <CollapsibleSection
              className="shipping-section"
              id="shipping-details-heading"
              title="Shipping Details"
              icon={Truck}
            >
              <div className="address-grid">
                <PartyForm
                  title="Bill To"
                  icon={UserRound}
                  value={current.billTo}
                  onChange={(value) => update("billTo", value)}
                />
                <PartyForm
                  title="Ship To"
                  icon={Truck}
                  value={current.shipTo}
                  disabled={same}
                  onChange={(value) => update("shipTo", value)}
                >
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={same}
                      onChange={(event) => {
                        if (!event.target.checked)
                          update("shipTo", { ...current.shipTo });
                        setSame(event.target.checked);
                      }}
                    />
                    Same as Bill To
                  </label>
                </PartyForm>
              </div>
            </CollapsibleSection>
            <div className="quotation-grid quotation-table-layout">
              <div className="quotation-detail">
                <ItemsTable
                  freight={current.freight}
                  onFreightTypeChange={(value) => update("freight", value)}
                  freightCharges={current.freightCharges}
                  onFreightChange={(value) => update("freightCharges", value)}
                  sum={sum}
                  items={current.items}
                  billState={current.billTo.state}
                  onChange={(items) => update("items", items)}
                />
                <QuotationTerms quote={current} updateItem={updateItem} />
              </div>
            </div>
          </form>
        ) : (
          <QuotationList
            quotes={quotes}
            search={search}
            setSearch={setSearch}
            open={open}
            newQuote={newQuote}
          />
        )}
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {preview && (
        <QuotationPreview
          q={previewCurrent}
          sum={totals(previewCurrent)}
          onClose={closePreview}
          onPrevious={() => navigatePreview(previousId)}
          onNext={() => navigatePreview(nextId)}
          hasPrevious={Boolean(previousId)}
          hasNext={Boolean(nextId)}
          loading={previewLoading}
          navigationError={previewError}
          positionLabel={
            previewIndex >= 0
              ? `${previewIndex + 1} of ${orderedQuotes.length}`
              : "Current draft"
          }
        />
      )}
    </div>
  );
}
