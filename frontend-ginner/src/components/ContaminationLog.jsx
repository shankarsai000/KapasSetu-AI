import React from 'react';
import { FileSpreadsheet, Flag, ShieldCheck } from 'lucide-react';

export default function ContaminationLog({ events, onToggleFalsePositive }) {
  const exportCsvAudit = () => {
    const headers = [
      'EventCode',
      'Timestamp',
      'MillID',
      'CameraLine',
      'ContaminantClass',
      'ConfidencePct',
      'LatencyMs',
      'HALCommand',
      'HardwareMode',
      'FalsePositive',
    ];
    const rows = (events || []).map((ev) => [
      ev.event_code,
      ev.timestamp,
      ev.mill_id,
      ev.camera_line_id,
      ev.contaminant_class,
      (ev.confidence * 100).toFixed(1),
      ev.inference_latency_ms,
      ev.action_command,
      ev.hardware_mode,
      ev.is_false_positive ? 'YES' : 'NO',
    ]);
    const csvContent = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kapassetu_bale_qa_audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-2xl border-2 border-slate-800 bg-slate-900/90 p-4 sm:p-5 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm sm:text-base font-black uppercase tracking-wide text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Spinning Mill Bale QA Compliance & Contamination Audit Log
          </h2>
          <p className="text-xs text-slate-400">
            Zero-plastic bale traceability ledger with operator false-positive feedback loop for ONNX model retraining.
          </p>
        </div>

        <button
          type="button"
          onClick={exportCsvAudit}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-cyan-300 flex items-center gap-1.5 transition"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export Bale QA CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase font-mono">
            <tr>
              <th className="px-3 py-2.5">HAL Event ID</th>
              <th className="px-3 py-2.5">Contaminant</th>
              <th className="px-3 py-2.5">Confidence</th>
              <th className="px-3 py-2.5">Latency</th>
              <th className="px-3 py-2.5">Relay Action</th>
              <th className="px-3 py-2.5">Driver Mode</th>
              <th className="px-3 py-2.5 text-right">QA Feedback</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/60">
            {(events || []).map((ev) => (
              <tr key={ev.id} className="hover:bg-slate-800/50">
                <td className="px-3 py-2.5 font-mono font-bold text-cyan-300">{ev.event_code}</td>
                <td className="px-3 py-2.5 font-bold text-white">{ev.contaminant_class}</td>
                <td className="px-3 py-2.5 font-mono text-amber-300">
                  {(ev.confidence * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2.5 font-mono text-emerald-300">
                  {ev.inference_latency_ms} ms
                </td>
                <td className="px-3 py-2.5 font-mono text-slate-300">{ev.action_command}</td>
                <td className="px-3 py-2.5 font-mono text-slate-400">{ev.hardware_mode}</td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onToggleFalsePositive(ev.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1 border transition ${
                      ev.is_false_positive
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Flag className="w-3 h-3" />
                    {ev.is_false_positive ? 'False Positive' : 'Verified True'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

