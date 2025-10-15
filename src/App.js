import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Wrench,
  Calculator,
  Printer,
  Download,
  Wand2,
  PlusCircle,
  Trash2,
  Info,
  DollarSign,
  Lock,
  Unlock,
  Upload,
} from "lucide-react";

/**
 * HVAC Flat-Rate Pricing — Tech Hours Visible + Catalog Import (JS)
 * - Techs see issue list + troubleshooting + Labor Hours input + Total.
 * - Manager PIN unlocks rates/fees/markup/tax controls.
 * - Import catalog JSON exported from the Excel converter.
 */

// --- Fallback sample so UI has data before you import a catalog ---
const SAMPLE = {
  "Gas Furnace – No Heat": [
    {
      id: "gf-igniter",
      issue: "Failed Hot Surface Igniter",
      symptoms: "Inducer runs; no ignition; retries then lockout",
      cause: "Cracked/worn igniter",
      diagnostics: "Measure ohms; inspect for hairline cracks",
      suggested: "Replace HSI igniter",
      defaultLaborHrs: 0.7,
      defaultPartsCost: 65,
      defaultQty: 1,
    },
    {
      id: "gf-flame-sensor",
      issue: "Dirty/Failed Flame Sensor",
      symptoms: "Burners light 3–10s then shut off",
      cause: "Oxidation on sensor",
      diagnostics: "Clean with fine abrasive; verify µA",
      suggested: "Clean/replace flame sensor",
      defaultLaborHrs: 0.5,
      defaultPartsCost: 25,
      defaultQty: 1,
    },
  ],
  "Central A/C – No Cool": [
    {
      id: "ac-cap",
      issue: "Dual Run Capacitor Failure",
      symptoms: "Fan/compressor struggle; needs push",
      cause: "Weak/bad dual cap",
      diagnostics: "µF test vs nameplate",
      suggested: "Replace dual run capacitor",
      defaultLaborHrs: 0.5,
      defaultPartsCost: 28,
      defaultQty: 1,
    },
  ],
};

function currency(n) {
  if (Number.isNaN(n)) return "$0.00";
  return Number(n).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function downloadCSV(filename, rows) {
  const csv = rows
    .map((r) =>
      r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export default function App() {
  // Catalog (from localStorage or SAMPLE). Shape: { "Category": [Issue, ...], ... }
  const [catalog, setCatalog] = useState(() => {
    try {
      const raw = localStorage.getItem("hvac_catalog_json");
      return raw ? JSON.parse(raw) : SAMPLE;
    } catch {
      return SAMPLE;
    }
  });

  const categories = Object.keys(catalog);
  const [category, setCategory] = useState(categories[0] || "");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const issues = (catalog[category] || []).filter((i) =>
    [i.issue, i.symptoms, i.cause, i.suggested, i.sku, i.code]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  const selected = issues.find((i) => i.id === selectedId) || issues[0];

  // Global pricing (persisted). Techs can't see or change these; managers can unlock via PIN.
  const [stdRate, setStdRate] = useState(
    () => Number(localStorage.getItem("hvac_std_rate")) || 165
  );
  const [afterRate, setAfterRate] = useState(
    () => Number(localStorage.getItem("hvac_after_rate")) || 267.5
  );
  const [afterHours, setAfterHours] = useState(
    () => localStorage.getItem("hvac_after_hours") === "1" || false
  );
  const [dayStart, setDayStart] = useState(
    () => localStorage.getItem("hvac_day_start") || "08:00"
  );
  const [dayEnd, setDayEnd] = useState(
    () => localStorage.getItem("hvac_day_end") || "16:30"
  );
  const [tripFee, setTripFee] = useState(
    () => Number(localStorage.getItem("hvac_trip_fee")) || 89
  );
  const [taxPct, setTaxPct] = useState(
    () => Number(localStorage.getItem("hvac_tax_pct")) || 0
  );
  const [partsMarkupPct, setPartsMarkupPct] = useState(
    () => Number(localStorage.getItem("hvac_parts_markup")) || 35
  );

  // Manager PIN (controls visibility of rates/fees/inputs except Hours)
  const [pin, setPin] = useState(() => localStorage.getItem("hvac_pin") || "");
  const [pinInput, setPinInput] = useState("");
  const [managerUnlocked, setManagerUnlocked] = useState(false);

  useEffect(() => {
    localStorage.setItem("hvac_std_rate", String(stdRate));
    localStorage.setItem("hvac_after_rate", String(afterRate));
    localStorage.setItem("hvac_after_hours", afterHours ? "1" : "0");
    localStorage.setItem("hvac_day_start", dayStart);
    localStorage.setItem("hvac_day_end", dayEnd);
    localStorage.setItem("hvac_trip_fee", String(tripFee));
    localStorage.setItem("hvac_tax_pct", String(taxPct));
    localStorage.setItem("hvac_parts_markup", String(partsMarkupPct));
  }, [
    stdRate,
    afterRate,
    afterHours,
    dayStart,
    dayEnd,
    tripFee,
    taxPct,
    partsMarkupPct,
  ]);

  // Line item inputs
  // Techs can always change Labor Hours; everything else is hidden unless manager unlocks.
  const [laborHrs, setLaborHrs] = useState(selected?.defaultLaborHrs ?? 1);
  const [parts, setParts] = useState(selected?.defaultPartsCost ?? 0);
  const [qty, setQty] = useState(selected?.defaultQty ?? 1);

  useEffect(() => {
    setLaborHrs(selected?.defaultLaborHrs ?? 1);
    setParts(selected?.defaultPartsCost ?? 0);
    setQty(selected?.defaultQty ?? 1);
  }, [selected?.id]);

  const effectiveLaborRate = afterHours ? afterRate : stdRate;

  const calc = useMemo(() => {
    const partsSubtotal =
      Number(parts) * Number(qty) * (1 + Number(partsMarkupPct) / 100);
    const laborSubtotal = Number(laborHrs) * Number(effectiveLaborRate);
    const subtotal = Number(tripFee) + partsSubtotal + laborSubtotal;
    const tax = subtotal * (Number(taxPct) / 100);
    const total = subtotal + tax;
    return { partsSubtotal, laborSubtotal, subtotal, tax, total };
  }, [
    parts,
    qty,
    partsMarkupPct,
    laborHrs,
    effectiveLaborRate,
    tripFee,
    taxPct,
  ]);

  // Saved quotes (techs see Total only; managers see full detail table)
  const [saved, setSaved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("hvac_quotes") || "[]");
    } catch {
      return [];
    }
  });

  function saveQuote() {
    if (!selected) return;
    const q = {
      ts: Date.now(),
      category,
      issue: selected.issue,
      laborRate: effectiveLaborRate,
      laborHrs,
      tripFee,
      parts,
      qty,
      partsMarkupPct,
      taxPct,
      total: calc.total,
    };
    const next = [q, ...saved].slice(0, 200);
    setSaved(next);
    localStorage.setItem("hvac_quotes", JSON.stringify(next));
  }

  function exportQuotes() {
    const rows = [
      [
        managerUnlocked ? "Date" : "Date",
        "Category",
        "Issue",
        ...(managerUnlocked
          ? ["Labor Rate", "Hours", "Trip", "Parts", "Qty", "Markup%", "Tax%"]
          : []),
        "Total",
      ],
      ...saved.map((s) => [
        new Date(s.ts).toLocaleString(),
        s.category,
        s.issue,
        ...(managerUnlocked
          ? [
              String(s.laborRate),
              String(s.laborHrs),
              String(s.tripFee),
              String(s.parts),
              String(s.qty),
              String(s.partsMarkupPct),
              String(s.taxPct),
            ]
          : []),
        String(Math.round(s.total * 100) / 100),
      ]),
    ];
    downloadCSV("hvac_quotes.csv", rows);
  }

  function removeSaved(ts) {
    const next = saved.filter((s) => s.ts !== ts);
    setSaved(next);
    localStorage.setItem("hvac_quotes", JSON.stringify(next));
  }

  async function handleImport(file) {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object")
        throw new Error("Invalid catalog JSON");
      setCatalog(parsed);
      localStorage.setItem("hvac_catalog_json", text);
      const first = Object.keys(parsed)[0];
      if (first) {
        setCategory(first);
        setSelectedId(null);
        setQuery("");
      }
    } catch (e) {
      alert(
        "Invalid catalog JSON. Please export from the Excel converter I gave you."
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <header className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              HVAC Flat-Rate Pricing
            </h1>
            <p className="text-slate-600">
              Techs see Total + Labor Hours only. Managers can unlock controls
              with a PIN.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
            <label className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 bg-white hover:bg-slate-50 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Import Catalog JSON</span>
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(f);
                }}
              />
            </label>
            <button
              onClick={saveQuote}
              className="inline-flex items-center gap-2 rounded-2xl shadow px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <PlusCircle className="w-4 h-4" /> Save Quote
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-2xl shadow px-3 py-2 bg-white border hover:bg-slate-50"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button
              onClick={exportQuotes}
              className="inline-flex items-center gap-2 rounded-2xl shadow px-3 py-2 bg-white border hover:bg-slate-50"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </header>

        {/* PIN + Manager toggle */}
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {pin ? (
              managerUnlocked ? (
                <button
                  onClick={() => setManagerUnlocked(false)}
                  className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-emerald-600 text-white"
                >
                  <Unlock className="w-4 h-4" /> Manager Unlocked
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    placeholder="PIN"
                    className="rounded-xl border px-3 py-2 w-28"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                  />
                  <button
                    onClick={() => {
                      if (pinInput === pin) {
                        setManagerUnlocked(true);
                        setPinInput("");
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-white border"
                  >
                    <Lock className="w-4 h-4" /> Unlock
                  </button>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  placeholder="Set New PIN (min 4)"
                  className="rounded-xl border px-3 py-2 w-48"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                />
                <button
                  onClick={() => {
                    const p = (pinInput || "").trim();
                    if (p.length >= 4) {
                      localStorage.setItem("hvac_pin", p);
                      setPin(p);
                      setManagerUnlocked(true);
                      setPinInput("");
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-white border"
                >
                  <Lock className="w-4 h-4" /> Set PIN
                </button>
              </div>
            )}
            <div className="text-xs text-slate-500">
              Tech mode hides rates, parts, markup, and tax. “Hours” stays
              visible.
            </div>
          </div>

          {managerUnlocked ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
                <Control label="Std Labor Rate ($/hr)">
                  <input
                    type="number"
                    className="w-full rounded-xl border px-3 py-2"
                    value={stdRate}
                    onChange={(e) => setStdRate(Number(e.target.value))}
                  />
                </Control>
                <Control label="After-Hours Rate ($/hr)">
                  <input
                    type="number"
                    className="w-full rounded-xl border px-3 py-2"
                    value={afterRate}
                    onChange={(e) => setAfterRate(Number(e.target.value))}
                  />
                </Control>
                <Control label="Business Hours Start">
                  <input
                    type="time"
                    className="w-full rounded-xl border px-3 py-2"
                    value={dayStart}
                    onChange={(e) => setDayStart(e.target.value)}
                  />
                </Control>
                <Control label="Business Hours End">
                  <input
                    type="time"
                    className="w-full rounded-xl border px-3 py-2"
                    value={dayEnd}
                    onChange={(e) => setDayEnd(e.target.value)}
                  />
                </Control>
                <Control label="After Hours?">
                  <div className="flex items-center gap-2">
                    <input
                      id="afterhours"
                      type="checkbox"
                      className="rounded"
                      checked={afterHours}
                      onChange={(e) => setAfterHours(e.target.checked)}
                    />
                    <label
                      htmlFor="afterhours"
                      className="text-sm text-slate-700"
                    >
                      Use after-hours
                    </label>
                  </div>
                </Control>
                <Control label="Trip Fee ($)">
                  <input
                    type="number"
                    className="w-full rounded-xl border px-3 py-2"
                    value={tripFee}
                    onChange={(e) => setTripFee(Number(e.target.value))}
                  />
                </Control>
                <Control label="Sales Tax (%)">
                  <input
                    type="number"
                    className="w-full rounded-xl border px-3 py-2"
                    value={taxPct}
                    onChange={(e) => setTaxPct(Number(e.target.value))}
                  />
                </Control>
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Active labor rate:{" "}
                <span className="font-medium">
                  {currency(effectiveLaborRate)}
                </span>{" "}
                {afterHours ? "(After Hours)" : "(Standard)"}
              </div>
            </>
          ) : (
            <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
              Tech Mode: pricing inputs are hidden (except Labor Hours in the
              job panel).
            </div>
          )}
        </section>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Catalog */}
          <section className="bg-white rounded-2xl shadow p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSelectedId(null);
                  setQuery("");
                }}
                className="rounded-xl border px-3 py-2"
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search issues, symptoms, causes, SKU…"
                  className="w-full rounded-xl border pl-9 pr-3 py-2"
                />
              </div>
            </div>

            <ul className="divide-y">
              {issues.map((i) => (
                <li
                  key={i.id || i.issue}
                  className={`py-3 cursor-pointer ${
                    selected?.id === i.id ? "bg-slate-50" : ""
                  }`}
                  onClick={() => setSelectedId(i.id || null)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{i.issue}</div>
                      <div className="text-sm text-slate-600">{i.symptoms}</div>
                    </div>
                    <Wrench className="w-4 h-4 text-slate-400" />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Details & pricing */}
          <section className="bg-white rounded-2xl shadow p-3 sm:p-4">
            {selected && (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{selected.issue}</h2>
                    <p className="text-sm text-slate-600">{category}</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl px-2 py-1 border text-slate-700 bg-slate-50">
                    <Info className="w-4 h-4" /> Troubleshooting
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <Tip title="Quick Symptoms" text={selected.symptoms || ""} />
                  <Tip title="Likely Cause/Parts" text={selected.cause || ""} />
                  <Tip
                    title="Diagnostic Notes"
                    text={selected.diagnostics || ""}
                  />
                  <Tip
                    title="Suggested Line Item"
                    text={selected.suggested || ""}
                  />
                </div>

                <div className="border-t pt-3">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Calculator className="w-4 h-4" /> Price
                  </h3>

                  {/* TECH VIEW: only Hours input + Total/Included lines */}
                  {!managerUnlocked && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <Control label="Labor Hours">
                          <input
                            type="number"
                            step="0.1"
                            className="w-full rounded-xl border px-3 py-2"
                            value={laborHrs}
                            onChange={(e) =>
                              setLaborHrs(Number(e.target.value))
                            }
                          />
                        </Control>
                        {/* Parts and Qty are kept internal (from catalog defaults) */}
                      </div>
                      <div className="mt-3 grid sm:grid-cols-3 gap-2 text-sm">
                        <Summary
                          label="Total"
                          value={currency(calc.total)}
                          emphasize
                        />
                        <Summary label="Trip" value="Included" />
                        <Summary label="Tax" value="Included" />
                      </div>
                    </>
                  )}

                  {/* MANAGER VIEW: full builder */}
                  {managerUnlocked && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                        <Control label="Labor Hours">
                          <input
                            type="number"
                            step="0.1"
                            className="w-full rounded-xl border px-3 py-2"
                            value={laborHrs}
                            onChange={(e) =>
                              setLaborHrs(Number(e.target.value))
                            }
                          />
                        </Control>
                        <Control label="Parts Cost ($)">
                          <input
                            type="number"
                            className="w-full rounded-xl border px-3 py-2"
                            value={parts}
                            onChange={(e) => setParts(Number(e.target.value))}
                          />
                        </Control>
                        <Control label="Quantity">
                          <input
                            type="number"
                            className="w-full rounded-xl border px-3 py-2"
                            value={qty}
                            onChange={(e) => setQty(Number(e.target.value))}
                          />
                        </Control>
                        <Control label="Parts Markup (%)">
                          <input
                            type="number"
                            className="w-full rounded-xl border px-3 py-2"
                            value={partsMarkupPct}
                            onChange={(e) =>
                              setPartsMarkupPct(Number(e.target.value))
                            }
                          />
                        </Control>
                        <Control label="Trip Fee ($)">
                          <input
                            type="number"
                            className="w-full rounded-xl border px-3 py-2"
                            value={tripFee}
                            onChange={(e) => setTripFee(Number(e.target.value))}
                          />
                        </Control>
                        <Control label="Sales Tax (%)">
                          <input
                            type="number"
                            className="w-full rounded-xl border px-3 py-2"
                            value={taxPct}
                            onChange={(e) => setTaxPct(Number(e.target.value))}
                          />
                        </Control>
                      </div>

                      <div className="mt-3 grid sm:grid-cols-5 gap-2 text-sm">
                        <Summary
                          label="Labor"
                          value={`${laborHrs} hr × ${currency(
                            effectiveLaborRate
                          )} = ${currency(calc.laborSubtotal)}`}
                        />
                        <Summary
                          label="Parts"
                          value={`${qty} × ${currency(
                            parts
                          )} → markup ${partsMarkupPct}% = ${currency(
                            calc.partsSubtotal
                          )}`}
                        />
                        <Summary label="Trip" value={currency(tripFee)} />
                        <Summary
                          label="Tax"
                          value={`${taxPct}% = ${currency(calc.tax)}`}
                        />
                        <Summary
                          label="Total"
                          value={currency(calc.total)}
                          emphasize
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={saveQuote}
                    className="inline-flex items-center gap-2 rounded-2xl shadow px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <DollarSign className="w-4 h-4" /> Save this price
                  </button>
                  <button
                    onClick={() => {
                      setLaborHrs(selected.defaultLaborHrs ?? 1);
                      setParts(selected.defaultPartsCost ?? 0);
                      setQty(selected.defaultQty ?? 1);
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl shadow px-3 py-2 bg-white border hover:bg-slate-50"
                  >
                    <Wand2 className="w-4 h-4" /> Reset to defaults
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Saved quotes */}
        <section className="mt-6 bg-white rounded-2xl shadow p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Saved Quotes</h3>
            <div className="text-sm text-slate-500">Stored on this device</div>
          </div>
          {saved.length === 0 ? (
            <p className="text-slate-600 text-sm">No quotes yet.</p>
          ) : (
            <div className="overflow-x-auto">
              {managerUnlocked ? (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-600">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Issue</th>
                      <th className="py-2 pr-4">Labor Rate</th>
                      <th className="py-2 pr-4">Hours</th>
                      <th className="py-2 pr-4">Trip</th>
                      <th className="py-2 pr-4">Parts</th>
                      <th className="py-2 pr-4">Qty</th>
                      <th className="py-2 pr-4">Markup%</th>
                      <th className="py-2 pr-4">Tax%</th>
                      <th className="py-2 pr-4">Total</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saved.map((s) => (
                      <tr key={s.ts} className="border-t">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {new Date(s.ts).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4">{s.category}</td>
                        <td className="py-2 pr-4">{s.issue}</td>
                        <td className="py-2 pr-4">{currency(s.laborRate)}</td>
                        <td className="py-2 pr-4">{s.laborHrs}</td>
                        <td className="py-2 pr-4">{currency(s.tripFee)}</td>
                        <td className="py-2 pr-4">{currency(s.parts)}</td>
                        <td className="py-2 pr-4">{s.qty}</td>
                        <td className="py-2 pr-4">{s.partsMarkupPct}%</td>
                        <td className="py-2 pr-4">{s.taxPct}%</td>
                        <td className="py-2 pr-4 font-semibold">
                          {currency(s.total)}
                        </td>
                        <td className="py-2 pr-4">
                          <button
                            onClick={() => removeSaved(s.ts)}
                            className="inline-flex items-center gap-1 rounded-xl px-2 py-1 border hover:bg-slate-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-600">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Issue</th>
                      <th className="py-2 pr-4">Total</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saved.map((s) => (
                      <tr key={s.ts} className="border-t">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {new Date(s.ts).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4">{s.category}</td>
                        <td className="py-2 pr-4">{s.issue}</td>
                        <td className="py-2 pr-4 font-semibold">
                          {currency(s.total)}
                        </td>
                        <td className="py-2 pr-4">
                          <button
                            onClick={() => removeSaved(s.ts)}
                            className="inline-flex items-center gap-1 rounded-xl px-2 py-1 border hover:bg-slate-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>

        <footer className="text-xs text-slate-500 mt-6">
          © {new Date().getFullYear()} – Internal use only.
        </footer>
      </div>
    </div>
  );
}

function Control({ label, children }) {
  return (
    <label className="text-sm">
      <div className="text-slate-600 mb-1">{label}</div>
      {children}
    </label>
  );
}
function Tip({ title, text }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border p-3 bg-slate-50"
    >
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
        {title}
      </div>
      <div className="text-slate-800 text-sm leading-relaxed">{text}</div>
    </motion.div>
  );
}
function Summary({ label, value, emphasize }) {
  return (
    <div
      className={`rounded-xl border p-2 ${
        emphasize ? "bg-emerald-50 border-emerald-200" : "bg-slate-50"
      }`}
    >
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`font-medium ${
          emphasize ? "text-emerald-700" : "text-slate-800"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
