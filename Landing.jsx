import React, { useState } from 'react';
import {
  Brain,
  ArrowRight,
  Search,
  ShieldCheck,
  ScanSearch,
  X
} from 'lucide-react';

export default function Landing({ onEnter }) {
  const [showGuestDialog, setShowGuestDialog] = useState(false);

  const continueAsGuest = () => {
    setShowGuestDialog(false);
    onEnter();
  };

  return (
    <main className="landing-screen">
      <div className="landing-grid" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="orb orb-4" />
      <div className="orb orb-5" />
      <div className="orb orb-6" />
      <div className="orb orb-7" />
      <div className="orb orb-8" />
      <div className="orb orb-9" />

      <header className="landing-brand">
        <span className="landing-brand-icon"><Brain size={27} /></span>
        <span className="landing-brand-name">TruthLens <b>AI</b></span>
        <small>AI PLATFORM</small>
      </header>

      <section className="landing-hero">
        <div className="landing-kicker">TRUST · VERIFY · UNDERSTAND</div>
        <h1>
          How can I help you
          <span>investigate?</span>
        </h1>
        <p>
          Ask, verify, analyze, and discover what is known, what is missing,
          and what the evidence actually supports.
        </p>

        <button
          type="button"
          className="landing-start-button"
          onClick={() => setShowGuestDialog(true)}
        >
          Get Started <ArrowRight size={19} />
        </button>

        <div className="landing-feature-row">
          <div className="landing-feature">
            <Search size={21} />
            <span>Deep Research</span>
          </div>
          <div className="landing-feature">
            <ShieldCheck size={21} />
            <span>Evidence Verification</span>
          </div>
          <div className="landing-feature">
            <ScanSearch size={21} />
            <span>Information Gap Detection</span>
          </div>
        </div>
      </section>

      {showGuestDialog && (
        <div className="guest-dialog-backdrop" onClick={() => setShowGuestDialog(false)}>
          <section
            className="guest-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="guest-dialog-close"
              aria-label="Close"
              onClick={() => setShowGuestDialog(false)}
            >
              <X size={18} />
            </button>
            <span className="guest-dialog-icon"><Brain size={27} /></span>
            <div className="guest-dialog-label">WELCOME TO TRUTHLENS AI</div>
            <h2 id="guest-dialog-title">Continue as a guest</h2>
            <p>
              This is a prototype. Guest mode lets you explore investigations
              without creating an account. Your chat history and library items
              are saved locally in this browser.
            </p>
            <div className="guest-dialog-note">
              Authentication and personal accounts can be added in a later version.
            </div>
            <button type="button" className="landing-start-button guest-continue" onClick={continueAsGuest}>
              Continue as Guest <ArrowRight size={18} />
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
