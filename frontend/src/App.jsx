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
  Bell,
  Users,
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
import ApprovalRequests from "./components/ApprovalRequests";
import UserManagement from "./components/UserManagement";
import {
  newQuotation,
  totals,
  quoteValidityDate,
  updateQuotationField,
} from "./lib/quotation";
import { api } from "./lib/api";

export default function App({ user, userCanPrintApproved = true, onLogout }) {
  const admin = user?.role === "admin";
  const [requests, setRequests] = useState([]);
  const [dirty, setDirty] = useState(false);
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
  const canPreview =
    admin ||
    (userCanPrintApproved && quote.id && quote.status === "approved" && !dirty);
  const previewCurrent = previewQuote || current;
  const orderedQuotes = [...quotes].sort((a, b) => a.id - b.id);
  const editorIndex = orderedQuotes.findIndex((saved) => saved.id === quote.id);
  const previousEditorId =
    editorIndex < 0
      ? orderedQuotes.at(-1)?.id
      : orderedQuotes[editorIndex - 1]?.id;
  const nextEditorId =
    editorIndex < 0 ? undefined : orderedQuotes[editorIndex + 1]?.id;
  const previewQuotes = admin
    ? orderedQuotes
    : orderedQuotes.filter((q) => q.status === "approved");
  const previewIndex = previewQuotes.findIndex(
    (saved) => saved.id === previewCurrent.id,
  );
  const previousId =
    previewIndex < 0
      ? previewQuotes.at(-1)?.id
      : previewQuotes[previewIndex - 1]?.id;
  const nextId =
    previewIndex < 0 ? undefined : previewQuotes[previewIndex + 1]?.id;

  async function showPreview() {
    if (!canPreview) return;
    if (!admin) {
      try {
        const approved = await api(`/quotations/${quote.id}/preview`);
        setPreviewQuote(approved);
        setPreview(true);
        setPreviewError("");
      } catch (e) {
        setError(e.message);
      }
      return;
    }
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
      const saved = await api(`/quotations/${id}/preview`);
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
      setQuote((previous) => {
        const latest = quotationsWithValidity.find((q) => q.id === previous.id);
        return latest &&
          latest.revision === previous.revision &&
          latest.status !== previous.status
          ? { ...previous, status: latest.status }
          : previous;
      });
      setNextNumber(next.number);
      if (admin) setRequests((await api("/approval-requests")) || []);
    } catch (error) {
      setError(error.message);
    }
  }
  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
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
  const update = (key, value) => {
    setDirty(true);
    setQuote((previous) => updateQuotationField(previous, key, value));
  };
  const updateItem = (index, key, value) => {
    setDirty(true);
    setQuote((previous) => ({
      ...previous,
      items: previous.items.map((item, n) =>
        n === index ? { ...item, [key]: value } : item,
      ),
    }));
  };
  const newQuote = () => {
    editorRequest.current += 1;
    setQuoteLoading(false);
    if (quote.id) editorDrafts.current.set(quote.id, { quote, same, dirty });
    const draft = quote.id ? editorDrafts.current.get("new") : null;
    if (!quote.id) editorDrafts.current.delete("new");
    setQuote(draft?.quote || newQuotation());
    setSame(draft?.same || false);
    setDirty(draft?.dirty || false);
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
      setDirty(false);
      if (!quote.id) editorDrafts.current.delete("new");
      editorDrafts.current.set(saved.id, { quote: saved, same, dirty: false });
      setNotice(`${saved.number} submitted for approval`);
      await load();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function open(id, force = false) {
    if (!id) return;
    if (id === quote.id && dirty && !force) {
      setView("editor");
      return;
    }
    const requestId = ++editorRequest.current;
    setQuoteLoading(true);
    try {
      const cached = editorDrafts.current.get(id);
      const target =
        !force && cached?.dirty
          ? cached
          : {
              quote: await api(`/quotations/${id}`),
              same: false,
              dirty: false,
            };
      if (requestId !== editorRequest.current) return;
      editorDrafts.current.set(quote.id || "new", { quote, same, dirty });
      setQuote(target.quote);
      setSame(target.same);
      setDirty(target.dirty || false);
      setView("editor");
      setError("");
    } catch (error) {
      if (requestId === editorRequest.current) setError(error.message);
    } finally {
      if (requestId === editorRequest.current) setQuoteLoading(false);
    }
  }
  async function approve(target) {
    if (target.id === quote.id && dirty) {
      setError("Save your changes before approving this quotation.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const approved = await api(`/quotations/${target.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ revision: target.revision }),
      });
      if (approved.id === quote.id) {
        setQuote(approved);
        setDirty(false);
      }
      editorDrafts.current.delete(approved.id);
      setNotice(`${approved.number} approved`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function printPreview() {
    if (admin) {
      window.print();
      return;
    }
    try {
      const latest = await api(`/quotations/${previewCurrent.id}/preview`);
      if (latest.revision !== previewCurrent.revision) {
        closePreview();
        setError(
          "This quotation has changed. Reopen the latest approved preview before printing.",
        );
        return;
      }
      window.print();
    } catch (e) {
      closePreview();
      setError(e.message);
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
            {
              {
                editor: "Sales Quotation",
                list: "Quotation Dashboard",
                requests: "Approval Requests",
                users: "User Management",
              }[view]
            }
          </h1>
          <div className="heading-actions">
            {admin && (
              <>
                <button
                  className="button"
                  onClick={() => {
                    setView("requests");
                    load();
                  }}
                  aria-label={`Approval requests (${requests.length})`}
                >
                  <Bell size={18} />
                  <span className="notification-count">{requests.length}</span>
                </button>
                <button className="button" onClick={() => setView("users")}>
                  <Users size={18} />
                  Accounts
                </button>
              </>
            )}
            <div className="session-actions">
              <span>
                {user?.name} · {admin ? "Admin" : "User"}
              </span>
              <button className="button" onClick={onLogout}>
                Sign out
              </button>
            </div>
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
                <button
                  className="button"
                  onClick={showPreview}
                  disabled={!canPreview || quoteLoading}
                  title={
                    !canPreview
                      ? "Available after administrator approval. Save any changes and request approval again."
                      : "Preview quotation"
                  }
                >
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
                  {busy
                    ? "Saving…"
                    : admin
                      ? "Save Quotation"
                      : "Submit for Approval"}
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
        {view === "editor" && (
          <div className="workflow-banner">
            <span
              className={`workflow-status ${!dirty && quote.status === "approved" ? "approved" : ""}`}
            >
              {dirty
                ? "Unsaved changes"
                : quote.status === "approved"
                  ? "Approved"
                  : quote.id
                    ? "Pending approval"
                    : "New quotation"}
            </span>
            <p>
              {admin
                ? "Review the details, save any changes, then approve the quotation."
                : "Preview and PDF are available after approval. Saved changes require approval again."}
            </p>
            {quote.id && (
              <button
                type="button"
                className="button"
                disabled={busy || quoteLoading}
                onClick={() => {
                  if (
                    !dirty ||
                    window.confirm(
                      "Discard unsaved changes and reload this quotation?",
                    )
                  )
                    open(quote.id, true);
                }}
              >
                Reload saved quotation
              </button>
            )}
            {admin && quote.id && quote.status !== "approved" && (
              <button
                type="button"
                className="button primary"
                disabled={dirty || busy}
                onClick={() => approve(quote)}
              >
                Approve quotation
              </button>
            )}
          </div>
        )}
        {view === "requests" && admin ? (
          <ApprovalRequests
            requests={requests}
            open={open}
            approve={approve}
            busy={busy}
          />
        ) : view === "users" && admin ? (
          <UserManagement />
        ) : view === "editor" ? (
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
                        setDirty(true);
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
          onPrint={printPreview}
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
              ? `${previewIndex + 1} of ${previewQuotes.length}`
              : "Current draft"
          }
        />
      )}
    </div>
  );
}
