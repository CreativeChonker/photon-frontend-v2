// src/pages/Workspace.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import axios from "axios";
import { FiPlay, FiZap, FiUpload, FiCamera } from "react-icons/fi";
import TerminalView from "../components/Terminal.jsx";
import { socket } from "../socket";
import "./Workspace.css";
import MascotGuideButton from "../tour/MascotGuideButton";
import { buildStep, useMascotTour } from "../tour/useMascotTour";
import "../tour/mascot.css";
import MobileActions from "../components/MobileActions";

const BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

const esc = (s) => String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function mergePromptAndInput(prevOut, promptText, userText) {
  const prev = String(prevOut ?? "");
  const prompt = String(promptText ?? "");
  const user = String(userText ?? "").replace(/\n+$/, "");
  if (!user) return prev;
  if (prompt) {
    const reTailPrompt = new RegExp(`(?:^|\\n)${esc(prompt)}\\s*$`);
    if (reTailPrompt.test(prev)) {
      return prev.replace(reTailPrompt, (m) => m.replace(/\s*$/, "") + ` ${user}\n`);
    }
  }
  return prev + (prompt ? `${prompt} ${user}\n` : `${user}\n`);
}

export default function Workspace({ code, setCode }) {
  const [terminalOutput, setTerminalOutput] = useState("");
  const [autoIndent, setAutoIndent] = useState(true);
  const [running, setRunning] = useState(false);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [accuracy, setAccuracy] = useState(0);
  const [accStatus, setAccStatus] = useState("Estimated from Vision confidence");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrPhase, setOcrPhase] = useState("Idle");
  const [uploadPct, setUploadPct] = useState(0);

  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastPromptRef = useRef("");
  const navigate = useNavigate();
  const suppressQ = useRef([]);

  useEffect(() => {
    const log = (msg) => setTerminalOutput((p) => p + msg + "\n");
    const onStdout = ({ text }) => {
      let chunk = String(text ?? "");
      const hadTrailing = /\r?\n$/.test(chunk);
      chunk = chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      if (suppressQ.current.length) {
        for (let i = 0; i < suppressQ.current.length; ) {
          const { token, prompt } = suppressQ.current[i];
          const tok = esc(token);
          const pr = prompt ? esc(prompt) : null;
          const before = chunk;
          if (pr) {
            const rePrTok = new RegExp(`(^|\\n)\\s*${pr}\\s*${tok}(?=\\n|$)`, "g");
            chunk = chunk.replace(rePrTok, (_m, pre) => pre);
            const rePromptOnly = new RegExp(`(^|\\n)\\s*${pr}\\s*(?=\\n|$)`, "g");
            chunk = chunk.replace(rePromptOnly, (_m, pre) => pre);
          }
          const reTokOnly = new RegExp(`(^|\\n)\\s*${tok}(?=\\n|$)`, "g");
          chunk = chunk.replace(reTokOnly, (_m, pre) => pre);
          if (chunk !== before) suppressQ.current.splice(i, 1);
          else i += 1;
        }
      }
      if (hadTrailing && !/\n$/.test(chunk)) chunk += "\n";
      setTerminalOutput((prev) => prev + chunk);
    };

    const onStdinReq = ({ prompt }) => {
      const p = prompt || "Input:";
      lastPromptRef.current = p;
      setPendingPrompt(p);
      setWaitingForInput(true);
    };

    const onExecEnd = () => {
      setRunning(false);
      setWaitingForInput(false);
      setPendingPrompt("");
      suppressQ.current = [];
    };

    socket.on("stdout", onStdout);
    socket.on("stdin_request", onStdinReq);
    socket.on("exec_end", onExecEnd);
    socket.on("connect", () => log("✓ Connected to runner"));
    socket.on("disconnect", (r) => log(`! Disconnected: ${r}`));
    socket.on("connect_error", (e) => log(`× Connect error: ${e?.message || e}`));

    return () => {
      socket.off("stdout", onStdout);
      socket.off("stdin_request", onStdinReq);
      socket.off("exec_end", onExecEnd);
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
    };
  }, []);

  const runOrRestart = useCallback(() => {
    setTerminalOutput("");
    setWaitingForInput(false);
    setPendingPrompt("");
    suppressQ.current = [];
    socket.emit("exec_start", { code: code || "", auto_indent: autoIndent });
    setRunning(true);
  }, [code, autoIndent]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runOrRestart();
      }
      if (e.key === "Escape" && running) {
        e.preventDefault();
        setRunning(false);
        setWaitingForInput(false);
        setPendingPrompt("");
        setTerminalOutput((p) => p + "\n[process aborted]\n");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runOrRestart, running]);

  const openUploadPicker = () => fileInputRef.current?.click();

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    try {
      setOcrLoading(true);
      setOcrPhase("Uploading");
      setUploadPct(0);
      setTerminalOutput((p) => p + `[ocr] uploading ${files.length} file(s)...\n`);

      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      form.append("auto_indent", String(autoIndent));
      form.append("engine", "auto");

      const { data } = await axios.post(`${BASE_URL}/process_images`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          if (!evt.total) return;
          const pct = Math.round((evt.loaded / evt.total) * 100);
          setUploadPct(pct);
          if (pct >= 100) setOcrPhase("Processing");
        },
      });

      const extracted = data?.extracted_text || "";
      const est = Number.isFinite(data?.estimated_accuracy) ? data.estimated_accuracy : 0;

      setAccuracy(Math.max(0, Math.min(100, est)));
      setAccStatus(
        data?.engine === "vision" ? "Google Vision" :
        data?.engine === "keras" ? "Keras OCR" :
        "Auto (Vision-first)"
      );

      if (extracted) {
        setCode(extracted);
        editorRef.current?.focus?.();
        setTerminalOutput((p) => p + `[ocr] done. inserted ${extracted.length} characters.\n`);
      } else {
        setTerminalOutput((p) => p + "[ocr] No text detected.\n");
      }
    } catch (err) {
      setAccuracy(0);
      setAccStatus("Network Error");
      setTerminalOutput((p) => p + `[ocr] error: ${err?.message || err}\n`);
    } finally {
      setOcrLoading(false);
      setOcrPhase("Idle");
      setUploadPct(0);
      e.target.value = "";
    }
  };

  const goToCamera = () => navigate("/camera");
  const goToAssistant = () => navigate("/assistant");

  const steps = [
    buildStep("#ws-run", "wink", "Run or restart your code. Tip: <b>Ctrl/⌘ + Enter</b>.", { side: "bottom" }),
    buildStep("#ws-editor", "smile", "This is the Monaco editor. Paste or type your code here.", { side: "right" }),
    buildStep("#ws-terminal", "happy", "Program output shows here. When input is needed, type beside the prompt.", { side: "top" }),
    buildStep("#ws-upload", "smile", "Upload image(s) of code to OCR them into the editor.", { side: "bottom" }),
    buildStep("#ws-camera", "smile", "Open your camera and capture code directly.", { side: "bottom" }),
    buildStep("#ws-assistant", "happy", "Open the Assistant for explanations, fixes, or suggestions.", { side: "bottom" }),
    buildStep("#ws-ocr", "wink", "OCR accuracy indicator for your last import.", { side: "top" }),
  ];
  const { start: startWsTour } = useMascotTour(steps, { stagePadding: 10, onDestroyed: () => localStorage.setItem("seen_ws_tour", "1") });
  const showFab = !localStorage.getItem("seen_ws_tour");

  return (
    <div className="workspace">
      <header className="workspace-header">
        <div className="brand">
          <Link to="/" className="brand-link">
            <img src={`${process.env.PUBLIC_URL}/images/photon.png`} alt="Photon" className="logo" />
          </Link>
          <h1>Workspace</h1>
        </div>

        {/* Desktop actions (hidden on mobile) */}
        <div className="header-actions">
          <label className="toggle" title="Toggle auto-indent">
            <input
              type="checkbox"
              checked={autoIndent}
              onChange={(e) => setAutoIndent(e.target.checked)}
            />
            <span>Auto-indent</span>
          </label>

          <button
            id="ws-upload"
            className="btn ghost"
            onClick={openUploadPicker}
            disabled={ocrLoading}
            title="Upload image(s) to OCR"
          >
            <FiUpload />
            <span>Upload</span>
          </button>

          <button
            id="ws-camera"
            className="btn ghost"
            onClick={goToCamera}
            disabled={ocrLoading}
            title="Open camera for OCR"
          >
            <FiCamera />
            <span>Camera</span>
          </button>

          <button
            id="ws-assistant"
            className="btn primary assistant"
            onClick={goToAssistant}
            disabled={ocrLoading}
            title="Open Photon Assistant"
          >
            <FiZap />
            <span>Photon Assistant</span>
          </button>
        </div>
      </header>



      <main className="workspace-main">
        <section id="ws-editor" className="editor-pane">
          {ocrLoading && (
            <div className="ocr-overlay">
              <div className="ocr-spinner" />
              <div className="ocr-msg">
                {ocrPhase === "Uploading" ? `Uploading… ${uploadPct}%` : "Processing…"}
              </div>
            </div>
          )}

          <Editor
            height="60vh"
            defaultLanguage="python"
            value={code}
            onChange={(val) => setCode(val ?? "")}
            onMount={(ed) => (editorRef.current = ed)}
            options={{ fontSize: 14, minimap: { enabled: false }, wordWrap: "on", automaticLayout: true }}
          />
        </section>

        <section className="terminal-pane">
          <div className="glass terminal-card">
            <div className="terminal-header">
              <span className="terminal-title">Terminal</span>
              <button id="ws-run" className="btn run-btn" onClick={runOrRestart} disabled={ocrLoading}>
                <FiPlay className="icon" /><span>{running ? "Restart" : "Run"}</span>
              </button>
            </div>

            <div id="ws-terminal" className="terminal">
              <TerminalView
                output={terminalOutput}
                waitingForInput={waitingForInput}
                prompt={pendingPrompt}
                onSendInput={(text) => {
                  const clean = String(text).replace(/\r?\n$/, "");
                  const promptNow = lastPromptRef.current || pendingPrompt;
                  if (clean) suppressQ.current.push({ token: clean, prompt: promptNow });
                  setTerminalOutput((prev) => mergePromptAndInput(prev, promptNow, clean));
                  socket.emit("stdin", { text });
                  setWaitingForInput(false);
                  setPendingPrompt("");
                  lastPromptRef.current = "";
                }}
              />
            </div>
          </div>

          <div id="ws-ocr" className="ocr-card glass">
            <div className="ocr-head">
              <div className="ocr-title-row">
                <span>OCR Accuracy</span>
                <button
                  className="ocr-info-btn"
                  onClick={() => {
                    const evt = new CustomEvent("photon:openOcrDetails");
                    window.dispatchEvent(evt);
                  }}
                >
                  Details
                </button>
              </div>
              <strong>{Math.round(accuracy)}%</strong>
            </div>
            <div className="ocr-sub">{ocrLoading ? (ocrPhase === "Uploading" ? "Uploading…" : "Processing…") : accStatus}</div>
            <div className="ocr-bar">
              <div
                className={`ocr-fill ${ocrLoading ? "indeterminate" : ""}`}
                style={!ocrLoading ? { width: `${Math.round(accuracy)}%` } : undefined}
              />
            </div>
          </div>
        </section>
      </main>

      {/* Mobile speed-dial actions (hidden on desktop) */}
      <MobileActions
        onUpload={openUploadPicker}
        onCamera={goToCamera}
        onGuide={startWsTour}
        autoIndent={autoIndent}
        setAutoIndent={setAutoIndent}
        disabled={ocrLoading}
      />

      {/* Tour FAB (unchanged) */}
      {showFab && (
        <MascotGuideButton
          steps={steps}
          position="br"
          pulse
          onStart={() => {
            localStorage.setItem("seen_ws_tour", "1");
            startWsTour();
          }}
        />
      )}

      {/* Hidden file input stays in DOM for mobile Upload from FAB */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesSelected}
        style={{ display: "none" }}
      />
    </div>
  );
}
