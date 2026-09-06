import { useState, useMemo } from "react";
import "./App.css";

const BACKEND_URL = "http://localhost:5000";

// nearest partner PHC for redistribution lookups
const NEAREST = {
  "Rau PHC": { name: "Mhow PHC", distanceKm: 12 },
  "Mhow PHC": { name: "Rau PHC", distanceKm: 12 },
  "Sanwer PHC": { name: "Depalpur PHC", distanceKm: 16 },
  "Depalpur PHC": { name: "Sanwer PHC", distanceKm: 16 },
};

// starting inventory — matches the example numbers from planning
const initialInventory = {
  "Rau PHC": { Paracetamol: { stock: 80, dailyUse: 50 } },
  "Mhow PHC": { Paracetamol: { stock: 600, dailyUse: 30 } },
  "Sanwer PHC": { ORS: { stock: 500, dailyUse: 80 } },
  "Depalpur PHC": { Amoxicillin: { stock: 300, dailyUse: 20 } },
};

const EXAMPLES = [
  "Rau PHC mein Paracetamol ki 80 tablets bachi hain aur roz 50 tablets use hoti hain.",
  "Sanwer PHC ORS down to 60 packets, roughly 80 used per day",
  "Depalpur PHC Amoxicillin almost finished, only 15 left, we use about 20 a day",
];

function riskLevel(daysLeft) {
  if (daysLeft <= 3) return "critical";
  if (daysLeft <= 7) return "warning";
  return "healthy";
}

const RISK_LABEL = { critical: "🔴 Critical", warning: "🟡 Warning", healthy: "🟢 Healthy" };

export default function App() {
  const [inventory, setInventory] = useState(initialInventory);
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastParsed, setLastParsed] = useState(null);

  // flat list of every PHC + medicine currently tracked, with days-left and risk
  const rows = useMemo(() => {
    const list = [];
    for (const phc of Object.keys(inventory)) {
      for (const medicine of Object.keys(inventory[phc])) {
        const { stock, dailyUse } = inventory[phc][medicine];
        const daysLeft = dailyUse > 0 ? Math.round((stock / dailyUse) * 10) / 10 : Infinity;
        list.push({ phc, medicine, stock, dailyUse, daysLeft, risk: riskLevel(daysLeft) });
      }
    }
    return list;
  }, [inventory]);

  // redistribution suggestions for every row currently at critical risk
  const alerts = useMemo(() => {
    return rows
      .filter((r) => r.risk === "critical")
      .map((r) => {
        const partner = NEAREST[r.phc];
        const partnerStock = partner ? inventory[partner.name]?.[r.medicine] : null;
        if (!partnerStock) {
          return { ...r, hasSuggestion: false };
        }
        const partnerDaysLeft = partnerStock.dailyUse > 0 ? partnerStock.stock / partnerStock.dailyUse : Infinity;
        const hasSurplus = partnerDaysLeft > 10;
        const moveQty = hasSurplus
          ? Math.min(r.dailyUse * 7, Math.floor(partnerStock.stock / 2))
          : 0;
        return {
          ...r,
          hasSuggestion: hasSurplus,
          partnerName: partner.name,
          distanceKm: partner.distanceKm,
          moveQty,
        };
      });
  }, [rows, inventory]);

  async function handleParse() {
    if (!report.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/parsedreport',  {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not parse that report");
      }
      setInventory((prev) => ({
        ...prev,
        [data.phc]: {
          ...prev[data.phc],
          [data.medicine]: { stock: data.stock, dailyUse: data.dailyUse || prev[data.phc]?.[data.medicine]?.dailyUse || 1 },
        },
      }));
      setLastParsed(data);
      setReport("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <p className="kicker">LIVE DEMO</p>
        <h1>ArogyaGrid</h1>
        <p className="subtitle">AI-powered rural medicine intelligence</p>
      </header>

      <section className="card">
        <h2>AI PHC report</h2>
        <textarea
          value={report}
          onChange={(e) => setReport(e.target.value)}
          placeholder="e.g. Rau PHC mein Paracetamol ki 80 tablets bachi hain aur roz 50 tablets use hoti hain."
          rows={3}
        />
        <div className="example-row">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="chip" onClick={() => setReport(ex)}>
              {ex.length > 40 ? ex.slice(0, 40) + "…" : ex}
            </button>
          ))}
        </div>
        <button className="primary-btn" onClick={handleParse} disabled={loading || !report.trim()}>
          {loading ? "Processing with Gemini…" : "Process with Gemini"}
        </button>
        {error && <p className="error">{error}</p>}
        {lastParsed && (
          <p className="parsed-result">
            Parsed: {lastParsed.phc} · {lastParsed.medicine} · stock {lastParsed.stock} · {lastParsed.dailyUse}/day
          </p>
        )}
      </section>

      <section>
        <h2>Dashboard</h2>
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>PHC</th>
              <th>Medicine</th>
              <th>Stock</th>
              <th>Daily use</th>
              <th>Days left</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`row-${r.risk}`}>
                <td>{r.phc}</td>
                <td>{r.medicine}</td>
                <td>{r.stock}</td>
                <td>{r.dailyUse}</td>
                <td>{r.daysLeft}</td>
                <td>{RISK_LABEL[r.risk]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>🚚 Redistribution recommendations</h2>
        {alerts.length === 0 && <p className="muted">No critical stock-out risks right now.</p>}
        {alerts.map((a, i) => (
          <div key={i} className="alert-card">
            <p className="alert-title">
              {a.phc} — {a.medicine}: {a.daysLeft} day{a.daysLeft === 1 ? "" : "s"} left (CRITICAL)
            </p>
            {a.hasSuggestion ? (
              <p>
                Move <strong>{a.moveQty}</strong> {a.medicine} from <strong>{a.partnerName}</strong> to{" "}
                <strong>{a.phc}</strong> ({a.distanceKm} km away). Reason: {a.phc} has only {a.daysLeft} days of stock
                remaining.
              </p>
            ) : (
              <p>No surplus data available at the nearest PHC ({a.partnerName || "unknown"}) for this medicine yet.</p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}