// src/pages/Assistant.jsx
import React, { useEffect, useRef, useState } from "react";
import { FiArrowUpCircle } from "react-icons/fi";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "./Assistant.css";
import axios from "axios";

const BASE_URL = "https://photon-rz68.onrender.com";
const AVATAR = `${process.env.PUBLIC_URL}/images/photon.png`;

function CodeBlock({ lang, content, onCopy, copied }) {
  return (
    <div className="code-card">
      <div className="code-card-bar">
        <span className="code-lang">{lang || "code"}</span>
        <button className="btn ghost xsmall" onClick={onCopy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="code-pre">
        <code>{content}</code>
      </pre>
    </div>
  );
}

const TypingDots = () => (
  <div className="typing-line">
    <div className="typing-dots">
      <span />
      <span />
      <span />
    </div>
  </div>
);

export default function Assistant({ code, setCode }) {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("photon_chat");
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const endOfChatRef = useRef(null);
  const textareaRef = useRef(null);
  const didAutoSend = useRef(false);

  // persist chat
  useEffect(() => {
    localStorage.setItem("photon_chat", JSON.stringify(messages));
  }, [messages]);

  // auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [input]);

  const scrollToBottom = () =>
    endOfChatRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    scrollToBottom();
  }, []); // first mount

  useEffect(() => {
    scrollToBottom();
  }, [location.pathname]);

  const onCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCode?.(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const parseContent = (text) => {
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    const chunks = [];
    let last = 0;
    while ((match = regex.exec(text))) {
      if (match.index > last) chunks.push({ type: "text", content: text.slice(last, match.index) });
      chunks.push({ type: "code", lang: match[1], content: match[2] });
      last = regex.lastIndex;
    }
    if (last < text.length) chunks.push({ type: "text", content: text.slice(last) });
    return chunks;
  };

  const renderMessage = (msg, i) => {
    if (msg.from === "user") {
      return (
        <div key={i} className="user-bubble">
          {msg.content}
        </div>
      );
    }
    const chunks = parseContent(msg.content);
    return (
      <div key={i} className="ai-line">
        <img className="ai-avatar" src={AVATAR} alt="Photon" />
        <div className="ai-bubble">
          {chunks.map((ch, j) =>
            ch.type === "code" ? (
              <CodeBlock
                key={j}
                lang={ch.lang}
                content={ch.content}
                onCopy={() => onCopy(ch.content, `${i}-${j}-copy`)}
                copied={copiedKey === `${i}-${j}-copy`}
              />
            ) : (
              <p key={j}>{ch.content}</p>
            )
          )}
        </div>
      </div>
    );
  };

  // streaming typewriter
  const streamIntoLastMessage = (fullText) => {
    const STEP = 3;
    const MIN = 8, MAX = 14;
    let i = 0;
    setIsTyping(true);
    setMessages((prev) => [...prev, { from: "ai", content: "" }]);
    scrollToBottom();

    const tick = () => {
      i += STEP;
      setMessages((prev) => {
        const out = [...prev];
        const last = out[out.length - 1];
        if (last?.from === "ai") last.content = fullText.slice(0, i);
        return out;
      });
      if (i < fullText.length) {
        setTimeout(tick, MIN + Math.random() * (MAX - MIN));
      } else {
        setIsTyping(false);
        scrollToBottom();
      }
    };
    tick();
  };

  const sendMessage = async (prompt) => {
    if (!prompt?.trim()) return;
    setMessages((prev) => [...prev, { from: "user", content: prompt }]);
    setInput("");

    try {
      const { data } = await axios.post(`${BASE_URL}/ask_ai`, {
        message: prompt,
        context_code: code,
      });
      streamIntoLastMessage(String(data?.response ?? ""));
    } catch {
      setMessages((prev) => [...prev, { from: "ai", content: "⚠️ Failed to fetch AI response." }]);
      setIsTyping(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // quick prompts
  const handleQuick = (q) => sendMessage(q);

  // auto-send from Home (with state)
  useEffect(() => {
    const st = location.state;
    const q = st?.query;
    const auto = st?.autoSend === true;
    if (!didAutoSend.current && q && auto) {
      didAutoSend.current = true;
      sendMessage(q);
      navigate(".", { replace: true, state: null });
    }
  }, [location.state, navigate]);

  return (
    <div className="page-shell assistant-page">
      {/* Sticky, centered header wrapper */}
      <div className="assistant-header-wrap">
        <header className="workspace-header">
          <div className="brand">
            <Link to="/" className="brand-link" aria-label="Go home">
              <img
                src={`${process.env.PUBLIC_URL}/images/photon.png`}
                alt="Photon"
                className="assistant-logo"
              />
            </Link>
            <h1 className="brand-title">Assistant</h1>
          </div>

          <button className="btn primary assistant" onClick={() => navigate("/workspace")}>
            Workspace
          </button>
        </header>
      </div>

      {/* Chat */}
      <main className="assistant-container">
        <div className="chat-body">
          {messages.map((m, i) => {
            // hide the empty placeholder bubble while streaming
            if (i === messages.length - 1 && isTyping && m.from === "ai" && !m.content.trim()) {
              return null;
            }
            return renderMessage(m, i);
          })}

          {isTyping && (
            <div className="ai-line typing">
              <img className="ai-avatar" src={AVATAR} alt="Photon" />
              <div className="ai-bubble">
                <TypingDots />
              </div>
            </div>
          )}

          {/* scroll anchor */}
          <div ref={endOfChatRef} style={{ height: 1 }} />
        </div>
      </main>

      {/* Sticky quick actions + input */}
      <div className="chat-footer">
        <div className="quick-bar">
          <button onClick={() => handleQuick("Fix the error in my code.")}>Fix Error</button>
          <button onClick={() => handleQuick("Explain this code.")}>Explain Code</button>
          <button onClick={() => handleQuick("Suggest improvements for this code.")}>
            Make Suggestions
          </button>
          <button onClick={() => handleQuick("Explain this error.")}>Explain Error</button>
        </div>

        <div className="chat-input-box">
          <textarea
            ref={textareaRef}
            placeholder="Ask something about your code..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
          />
          <button onClick={() => sendMessage(input)} aria-label="Send">
            <FiArrowUpCircle size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
