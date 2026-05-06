export default function NudgePreview({ nudge }) {
  return (
    <div className="bg-white border border-scaler-border rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500"></span>
        <h3 className="text-sm font-semibold text-scaler-oxford">BDA Pre-Call Nudge</h3>
        <span className="ml-auto text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">Sent to BDA</span>
      </div>

      <div className="bg-[#075E54]/10 border border-[#075E54]/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#075E54] flex items-center justify-center text-xs font-bold text-white">AI</div>
          <span className="text-xs text-scaler-slate">Scaler Signal · WhatsApp</span>
        </div>
        <div className="bg-[#DCF8C6] rounded-lg rounded-tl-none p-3 max-w-sm">
          <p className="text-[#1A1A1A] text-sm whitespace-pre-wrap leading-relaxed">{nudge}</p>
        </div>
      </div>

      <p className="text-xs text-scaler-slate">No approval needed — this is internal BDA prep, not lead-facing.</p>
    </div>
  )
}
