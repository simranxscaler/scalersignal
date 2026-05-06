import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Landing() {
  const { user, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [authLoading, setAuthLoading] = useState(null) // 'signin' | 'signup' | null

  // If already signed in, go straight to app
  useEffect(() => {
    if (user) navigate('/app/dashboard')
  }, [user])

  async function handleAuth(type) {
    setAuthLoading(type)
    try {
      await loginWithGoogle()
      navigate('/app/dashboard')
    } catch (e) {
      setAuthLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-x-hidden">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center px-8 py-5"
        style={{ background: 'linear-gradient(to bottom, rgba(3,7,18,0.95), transparent)' }}>
        <div className="flex items-center gap-2.5">
          <img
            src="https://d2beiqkhq929f0.cloudfront.net/public_assets/assets/000/194/804/original/Scaler.png?1778073683"
            alt="Scaler"
            className="w-7 h-7 object-contain brightness-0 invert"
          />
          <span className="text-white font-semibold text-sm tracking-widest uppercase">Scaler Signal</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center min-h-screen text-center px-6 pt-24 pb-20">
        {/* Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,65,202,0.18) 0%, transparent 70%)' }} />

        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-white/60 mb-8 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
            Built for Scaler BDAs
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6"
            style={{ background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.55) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Walk into every<br />call prepared.
          </h1>

          <p className="text-lg md:text-xl text-white/50 leading-relaxed max-w-xl mx-auto mb-12">
            AI that briefs you before the call and builds trust after it —
            so more leads take the entrance test.
          </p>

          {/* CTA buttons — Apple pill style */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => handleAuth('signup')}
              disabled={!!authLoading}
              className="flex items-center gap-2.5 bg-white text-[#030712] font-semibold text-sm px-8 py-3.5 rounded-full hover:bg-white/90 transition-all disabled:opacity-50 shadow-lg shadow-white/10"
            >
              {authLoading === 'signup' ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : null}
              Create Account
            </button>
            <button
              onClick={() => handleAuth('signin')}
              disabled={!!authLoading}
              className="flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white border border-white/15 hover:border-white/30 px-8 py-3.5 rounded-full transition-all disabled:opacity-50 backdrop-blur-sm"
            >
              {authLoading === 'signin' ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : null}
              Sign In
            </button>
          </div>

          <p className="mt-6 text-xs text-white/25">Sign in with your Scaler Google account</p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-32">
        <p className="text-center text-xs text-white/30 uppercase tracking-widest mb-16">Two moments. Maximum lift.</p>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Pre-call nudge */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-8 hover:bg-white/[0.05] transition-colors">
            <div className="w-10 h-10 rounded-2xl bg-[#0041CA]/20 flex items-center justify-center mb-6">
              <svg className="w-5 h-5 text-[#4d8aff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <div className="text-xs text-[#4d8aff] font-semibold uppercase tracking-widest mb-3">Pre-Call BDA Nudge</div>
            <h3 className="text-xl font-semibold text-white mb-3 leading-snug">Know the lead before you dial</h3>
            <p className="text-white/40 text-sm leading-relaxed">
              The moment a lead is added, you get a scannable WhatsApp brief — who they are, why they're looking,
              what objections to expect, and a suggested opening line. Sent instantly, no approval needed.
            </p>
            <div className="mt-6 space-y-2">
              {['Who they are in plain English', 'Angles that will land', 'Objections + one-line handles', 'Suggested opening hook'].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-white/50">
                  <svg className="w-3.5 h-3.5 text-[#4d8aff] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Post-call PDF */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-8 hover:bg-white/[0.05] transition-colors">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/15 flex items-center justify-center mb-6">
              <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div className="text-xs text-orange-400 font-semibold uppercase tracking-widest mb-3">Post-Call Lead PDF</div>
            <h3 className="text-xl font-semibold text-white mb-3 leading-snug">A PDF that builds trust to take the test</h3>
            <p className="text-white/40 text-sm leading-relaxed">
              After the call, upload the transcript or audio. The agent extracts every question and objection,
              generates a personalised PDF that answers them with real evidence, and sends it to the lead — after you approve.
            </p>
            <div className="mt-6 space-y-2">
              {["Answers this lead's actual questions", 'ROI calc for their specific background', 'Visibly different lead to lead', 'BDA approves before anything sends'].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-white/50">
                  <svg className="w-3.5 h-3.5 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Flow strip */}
        <div className="mt-5 bg-white/[0.03] border border-white/[0.07] rounded-3xl p-8">
          <p className="text-xs text-white/30 uppercase tracking-widest mb-8 text-center">How it works</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { step: '01', label: 'Add lead profile', sub: 'Name, background, intent, LinkedIn' },
              { step: '02', label: 'Nudge sent to BDA', sub: 'WhatsApp brief before the call' },
              { step: '03', label: 'Upload call transcript', sub: 'Text or audio — Whisper transcribes' },
              { step: '04', label: 'PDF approved & sent', sub: 'BDA reviews, lead gets it on WhatsApp' },
            ].map(({ step, label, sub }) => (
              <div key={step} className="text-center">
                <div className="text-3xl font-bold text-white/8 mb-3 tabular-nums">{step}</div>
                <p className="text-sm font-medium text-white/70 mb-1">{label}</p>
                <p className="text-xs text-white/30 leading-relaxed">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">Ready to start?</h2>
          <p className="text-white/40 mb-8 text-sm">Sign in with your Scaler Google account to access the BDA workspace.</p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => handleAuth('signup')}
              disabled={!!authLoading}
              className="bg-white text-[#030712] font-semibold text-sm px-8 py-3.5 rounded-full hover:bg-white/90 transition-all disabled:opacity-50"
            >
              Create Account
            </button>
            <button
              onClick={() => handleAuth('signin')}
              disabled={!!authLoading}
              className="text-sm font-medium text-white/70 hover:text-white border border-white/15 hover:border-white/30 px-8 py-3.5 rounded-full transition-all disabled:opacity-50"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 text-center">
        <p className="text-xs text-white/20">© 2025 Scaler · Internal BDA Tool</p>
      </footer>
    </div>
  )
}
