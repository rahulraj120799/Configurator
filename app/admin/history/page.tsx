"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { ConfiguratorShell } from "@/app/components/configurator-shell";
import { QuoteSummary, type QuoteGroup } from "@/app/components/quote-summary";
import type { PagedQuotes, QuoteHistoryItem } from "@/lib/cpq-api";

const PAGE_SIZES = [10, 25, 50, 100];

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

const formatDateTime = (value: string) => {
  const date = new Date(value);

  return {
    date: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
};

const formatFieldLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const quoteToGroup = (quote: QuoteHistoryItem): QuoteGroup => ({
  groupKey: "configuration",
  label: "Configuration",
  items: Object.entries(quote.submission?.config?.selections ?? {})
    .filter(([, value]) => value !== "" && value !== false && value != null)
    .map(([fieldKey, value]) => ({
      fieldKey,
      label: formatFieldLabel(fieldKey),
      value: value === true ? "Yes" : String(value),
    })),
} satisfies QuoteGroup);

export default function QuoteHistoryPage() {
  const [quotes, setQuotes] = useState<QuoteHistoryItem[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<QuoteHistoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quoteSearch, setQuoteSearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const deferredQuoteSearch = useDeferredValue(quoteSearch);
  const deferredGlobalSearch = useDeferredValue(globalSearch);
  const deferredEmailFilter = useDeferredValue(emailFilter);

  useEffect(() => {
    const loadQuotes = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/admin/quotes?page=0&size=100");
        const body = (await response.json()) as PagedQuotes & { message?: string };
        if (!response.ok) {
          throw new Error(body.message ?? "Failed to load quote history");
        }
        setQuotes(body.content);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load quote history");
      } finally {
        setIsLoading(false);
      }
    };

    void loadQuotes();
  }, []);

  const filteredQuotes = useMemo(() => {
    const quoteTerm = deferredQuoteSearch.trim().toLowerCase();
    const globalTerm = deferredGlobalSearch.trim().toLowerCase();
    const emailTerm = deferredEmailFilter.trim().toLowerCase();
    const minPrice = minimumPrice === "" ? null : Number(minimumPrice);
    const maxPrice = maximumPrice === "" ? null : Number(maximumPrice);

    return quotes.filter((quote) => {
      const globalValues = [
        quote.quoteNumber,
        quote.customerName,
        quote.customerEmail,
        quote.productName,
        quote.status,
      ].join(" ").toLowerCase();

      return (
        (!quoteTerm || quote.quoteNumber.toLowerCase().includes(quoteTerm)) &&
        (!globalTerm || globalValues.includes(globalTerm)) &&
        (!emailTerm || quote.customerEmail.toLowerCase().includes(emailTerm)) &&
        (minPrice === null || quote.totalPrice >= minPrice) &&
        (maxPrice === null || quote.totalPrice <= maxPrice)
      );
    });
  }, [quotes, deferredQuoteSearch, deferredGlobalSearch, deferredEmailFilter, minimumPrice, maximumPrice]);

  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageQuotes = filteredQuotes.slice((safePage - 1) * pageSize, safePage * pageSize);
  const firstPageButton = Math.min(
    Math.max(1, safePage - 4),
    Math.max(1, totalPages - 9)
  );
  const pageButtons = Array.from(
    { length: Math.min(10, totalPages) },
    (_, index) => firstPageButton + index
  );
  const filteredTotal = filteredQuotes.reduce(
    (total, quote) => total + quote.totalPrice,
    0
  );
  const activeFilterCount = [
    quoteSearch,
    globalSearch,
    emailFilter,
    minimumPrice,
    maximumPrice,
  ].filter((value) => value.trim() !== "").length;

  const updateFilter = (update: () => void) => {
    update();
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setQuoteSearch("");
    setGlobalSearch("");
    setEmailFilter("");
    setMinimumPrice("");
    setMaximumPrice("");
    setCurrentPage(1);
  };

  if (selectedQuote) {
    return (
      <ConfiguratorShell activeNav="admin-history">
        <QuoteSummary
          quoteNumber={selectedQuote.quoteNumber}
          customerName={selectedQuote.customerName}
          recipientEmail={selectedQuote.customerEmail}
          createdAt={selectedQuote.createdAt}
          status={selectedQuote.status}
          bodyType={selectedQuote.productName || selectedQuote.productSlug}
          totalPrice={selectedQuote.totalPrice}
          groups={[quoteToGroup(selectedQuote)]}
          onBack={() => setSelectedQuote(null)}
        />
      </ConfiguratorShell>
    );
  }

  return (
    <ConfiguratorShell activeNav="admin-history">
      <div className="min-h-screen bg-[#f4f7fb]">
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-6 py-7 lg:flex-row lg:items-end lg:justify-between lg:px-10">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-blue-700">
                <span className="h-px w-6 bg-orange-500" />
                Admin workspace
              </div>
              <h1 className="text-3xl font-bold text-slate-950">Quote History</h1>
              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Search customer submissions, review pricing, and open the full
                configuration behind every quote.
              </p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 shadow-sm sm:grid-cols-3">
              <div className="px-5 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Quotes</p>
                <p className="mt-1 text-xl font-bold text-slate-950">{filteredQuotes.length}</p>
              </div>
              <div className="px-5 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Quoted value</p>
                <p className="mt-1 text-xl font-bold text-emerald-700">
                  {formatCurrency(filteredTotal, quotes[0]?.currency ?? "USD")}
                </p>
              </div>
              <div className="col-span-2 border-t border-slate-200 px-5 py-3 sm:col-span-1 sm:border-t-0">
                <p className="text-xs font-semibold uppercase text-slate-500">Showing</p>
                <p className="mt-1 text-xl font-bold text-slate-950">
                  {pageQuotes.length}
                  <span className="ml-1 text-sm font-medium text-slate-400">rows</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1500px] px-6 py-6 lg:px-10">
          <div className="rounded-lg border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                  <Search className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">Find a quote</p>
                  <p className="text-xs text-slate-500">Combine fields to narrow the results.</p>
                </div>
              </div>
              {activeFilterCount > 0 ? (
                <button type="button" onClick={clearFilters} className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
                  Clear {activeFilterCount} {activeFilterCount === 1 ? "filter" : "filters"}
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-[1fr_1.35fr_1.35fr_0.8fr_0.8fr]">
              <label className="text-xs font-semibold text-slate-600">
                Quote number
                <input value={quoteSearch} onChange={(event) => updateFilter(() => setQuoteSearch(event.target.value))} placeholder="Q-2026..." className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-slate-50/60 px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/70" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Global search
                <input value={globalSearch} onChange={(event) => updateFilter(() => setGlobalSearch(event.target.value))} placeholder="Name, product, status..." className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-slate-50/60 px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/70" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Customer email
                <input value={emailFilter} onChange={(event) => updateFilter(() => setEmailFilter(event.target.value))} placeholder="customer@example.com" className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-slate-50/60 px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/70" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Min. price
                <input type="number" min="0" value={minimumPrice} onChange={(event) => updateFilter(() => setMinimumPrice(event.target.value))} placeholder="$0" className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-slate-50/60 px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/70" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Max. price
                <input type="number" min="0" value={maximumPrice} onChange={(event) => updateFilter(() => setMaximumPrice(event.target.value))} placeholder="No limit" className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-slate-50/60 px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/70" />
              </label>
            </div>
          </div>

          {error ? <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-sm font-bold text-slate-900">Submitted quotes</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {activeFilterCount > 0 ? `${filteredQuotes.length} matching results` : `${filteredQuotes.length} total records`}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                Rows per page
                <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1); }} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                  {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] border-collapse text-left">
                <thead className="bg-[#123c72] text-xs font-semibold uppercase text-blue-100">
                  <tr>
                    <th className="px-5 py-3.5">Quote Number</th><th className="px-5 py-3.5">Customer</th><th className="px-5 py-3.5">Email</th><th className="px-5 py-3.5">Total Price</th><th className="px-5 py-3.5">Created</th><th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr><td colSpan={6} className="px-5 py-16 text-center"><span className="inline-flex items-center gap-3 text-sm font-medium text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />Loading quote history...</span></td></tr>
                  ) : pageQuotes.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-16 text-center"><p className="text-sm font-semibold text-slate-700">No matching quotes</p><p className="mt-1 text-xs text-slate-500">Adjust or clear the filters to see more results.</p></td></tr>
                  ) : pageQuotes.map((quote) => {
                    const created = formatDateTime(quote.createdAt);

                    return (
                      <tr key={quote.id} className="group transition-colors hover:bg-blue-50/50">
                        <td className="whitespace-nowrap px-5 py-4"><span className="border-l-2 border-orange-400 pl-3 font-mono text-sm font-bold text-blue-700">{quote.quoteNumber}</span></td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">{quote.customerName}</td>
                        <td className="px-5 py-4 text-sm text-slate-500">{quote.customerEmail}</td>
                        <td className="px-5 py-4"><span className="inline-flex rounded-md bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/15">{formatCurrency(quote.totalPrice, quote.currency)}</span></td>
                        <td className="whitespace-nowrap px-5 py-4"><p className="text-sm font-semibold text-slate-800">{created.date}</p><p className="mt-0.5 text-xs text-slate-400">{created.time}</p></td>
                        <td className="px-5 py-4 text-right"><button type="button" onClick={() => setSelectedQuote(quote)} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100">View <ChevronRight className="h-3.5 w-3.5" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/70 px-5 py-4">
              <p className="text-sm text-slate-500">
                Showing <span className="font-semibold text-slate-800">{filteredQuotes.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredQuotes.length)}</span> of <span className="font-semibold text-slate-800">{filteredQuotes.length}</span>
              </p>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Previous page" disabled={safePage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                {pageButtons.map((page) => <button key={page} type="button" onClick={() => setCurrentPage(page)} className={`h-9 min-w-9 rounded-md px-2 text-sm font-semibold transition ${safePage === page ? "bg-blue-600 text-white shadow-sm" : "border border-slate-300 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"}`}>{page}</button>)}
                <button type="button" aria-label="Next page" disabled={safePage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ConfiguratorShell>
  );
}