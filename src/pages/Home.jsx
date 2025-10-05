import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowUpCircle } from "react-icons/fi";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import "./Home.css";

import MascotGuideButton from "../tour/MascotGuideButton";
import { buildStep, useMascotTour } from "../tour/useMascotTour";
import "../tour/mascot.css";

const logo = `${process.env.PUBLIC_URL}/images/photon.png`;

export default function Home() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Fix Code");
  const [chatInput, setChatInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showFab, setShowFab] = useState(() => !localStorage.getItem("seen_home_tour"));

  const samples = {
    "Fix Code": {
      user: "How can I fix my transaction function? It fails on empty input.",
      ai: "You should check for empty input at the start and raise an exception or return early.",
      code: `def process_transaction(amount):
    if amount is None or amount == "":
        raise ValueError("Invalid amount.")
    # proceed with transaction`,
    },
    Suggestions: {
      user: "Any suggestions to optimize my loop?",
      ai: "Try using list comprehensions for better performance and readability.",
      code: `squares = [i * i for i in range(10)]`,
    },
    "Explain Code": {
      user: "Can you explain what this class does?",
      ai: "This class defines a simple counter with methods to increment and get the current count.",
      code: `class Counter:
    def __init__(self):
        self.count = 0
    def increment(self):
        self.count += 1
    def get(self):
        return self.count`,
    },
    "Explain Error": {
      user: "Why am I getting a 'TypeError: unsupported operand types'?",
      ai: "You're trying to add a string and a number. Convert types before operations.",
      code: `name = "John"
age = 25
print(name + str(age))`,
    },
  };

  // navigate to Assistant, optionally auto-sending
  const goAssistant = (q, { autoSend = false } = {}) => {
    const query = (q ?? chatInput).trim();
    if (query) navigate("/assistant", { state: { query, autoSend } });
    else navigate("/assistant");
  };

  // ---- Tour ----
  const getTabsAnchorSelector = () => {
    const active = document.querySelector("#home-tabs .pill.active");
    return active ? "#home-tabs .pill.active" : "#home-tabs .pill:nth-child(1)";
  };

  const steps = [
    buildStep(
      "#home-input",
      "smile",
      "Type your question here. Press <b>Enter</b> or click <b>Send</b> to ask me in the Assistant.",
      { side: "bottom" }
    ),
    buildStep(
      "#home-send",
      "wink",
      "This sends your text and opens the Assistant. I’ll reply right away!",
      { side: "bottom" }
    ),
    buildStep(
      "#home-open",
      "happy",
      "Prefer a blank slate? This opens the Assistant using your current text.",
      { side: "bottom" }
    ),
    buildStep(
      getTabsAnchorSelector(),
      "smile",
      "These are sample topics—just tabs. They won’t change your text.",
      { side: "bottom", align: "center" }
    ),
    buildStep(
      "#home-sample-card",
      "happy",
      "Click this card to try a sample question. I’ll send it to the Assistant for you.",
      { side: "top" }
    ),
  ];

  const { start: startHomeTourRaw } = useMascotTour(steps, {
    stagePadding: 10,
    onDestroyed: () => localStorage.setItem("seen_home_tour", "1"),
  });

  const startHomeTour = () => startHomeTourRaw();
  const startFromFab = () => {
    localStorage.setItem("seen_home_tour", "1");
    setShowFab(false);
    startHomeTourRaw();
  };

  return (
    <div className="home">
      <div className="bg-blobs" />

      <header className="navbar glass">
        <div className="brand">
          <img src={logo} alt="Photon" className="logo" />
          <strong>Photon</strong>
        </div>

        {/* Guide me button restored here */}
        <button className="btn ghost small" onClick={startHomeTour}>
          Guide me
        </button>
      </header>

      <section className="hero">
        <h1>What's on the agenda today?</h1>

        {/* prompt bar */}
        <div className="promptbar glass">
          <input
            id="home-input"
            className="prompt-input"
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask anything"
            disabled={busy}
            onKeyDown={(e) => e.key === "Enter" && goAssistant(undefined, { autoSend: true })}
          />
          <button
            id="home-send"
            className="iconbtn"
            onClick={() => goAssistant(undefined, { autoSend: true })}
            title="Send to Assistant"
            disabled={busy}
            aria-label="Send to Assistant"
          >
            <FiArrowUpCircle />
          </button>
        </div>

        {/* CTA buttons */}
        <div className="cta">
          <button
            id="home-open"
            className="btn primary"
            onClick={() => goAssistant(chatInput || samples[activeTab].user, { autoSend: false })}
            disabled={busy}
          >
            Open Assistant
          </button>

          <button
            id="home-workspace"
            className="btn primary"
            onClick={() => navigate("/workspace")}
            disabled={busy}
          >
            Open Workspace
          </button>
        </div>
      </section>

      <section className="samples">
        <h3>Samples</h3>

        <div id="home-tabs" className="pills">
          {Object.keys(samples).map((tab) => (
            <button
              key={tab}
              className={`pill ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
              disabled={busy}
            >
              {tab}
            </button>
          ))}
        </div>

        <div
          id="home-sample-card"
          className="card glass"
          onClick={() => goAssistant(samples[activeTab].user, { autoSend: true })}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && goAssistant(samples[activeTab].user, { autoSend: true })}
        >
          <div className="row">
            <div className="label">User</div>
            <p>{samples[activeTab].user}</p>
          </div>
          <div className="row">
            <div className="label">AI</div>
            <p>{samples[activeTab].ai}</p>
          </div>

          <div className="code">
            <SyntaxHighlighter
              language="python"
              style={vscDarkPlus}
              wrapLongLines
              customStyle={{ background: "transparent", margin: 0, padding: "14px 16px" }}
              codeTagProps={{ style: { background: "transparent" } }}
            >
              {samples[activeTab].code}
            </SyntaxHighlighter>
          </div>
        </div>
      </section>

      {showFab && (
        <MascotGuideButton
          steps={steps}
          position="br"
          pulse
          onStart={startFromFab}
        />
      )}
    </div>
  );
}
