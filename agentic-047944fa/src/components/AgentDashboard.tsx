"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ConversationMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  meta?: {
    status?: string;
    confidence?: number;
  };
};

type AgentState = {
  status: "thinking" | "ready" | "blocked";
  thoughts: {
    summary: string;
    reasoning: string;
    confidence: number;
  };
  plan: {
    currentStep: number;
    steps: string[];
  };
  nextActions: string[];
  reply: string;
  sources: string[];
};

const classNameForRole = (role: ConversationMessage["role"]) =>
  role === "user"
    ? "ml-auto bg-blue-500 text-white shadow-lg shadow-blue-500/30"
    : "mr-auto bg-slate-800/80 text-slate-100 ring-1 ring-slate-500/40";

export function AgentDashboard() {
  const [goal, setGoal] = useState("Launch a polished AI-powered productivity assistant.");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const disabled = isLoading || !goal.trim();

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      chatRef.current?.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || disabled) {
        return;
      }

      const pendingMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
      };

      setMessages((prev) => [...prev, pendingMessage]);
      setDraft("");
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            goal,
            message: content,
            conversation: messages.map(({ role, content: previousContent }) => ({
              role,
              content: previousContent,
            })),
          }),
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Failed to reach AI agent");
        }

        const payload = (await response.json()) as AgentState;

        setAgentState(payload);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "agent",
            content: payload.reply,
            meta: {
              status: payload.status,
              confidence: payload.thoughts.confidence,
            },
          },
        ]);
      } catch (agentError) {
        setError(
          agentError instanceof Error
            ? agentError.message
            : "Something went wrong while contacting the agent.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [disabled, goal, messages],
  );

  const planProgress = useMemo(() => {
    if (!agentState) {
      return 0;
    }
    if (agentState.plan.steps.length === 0) {
      return 0;
    }
    const boundedStep = Math.min(
      agentState.plan.currentStep,
      agentState.plan.steps.length,
    );
    return Math.round((boundedStep / agentState.plan.steps.length) * 100);
  }, [agentState]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void sendMessage(draft);
    },
    [draft, sendMessage],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-12 lg:flex-row lg:gap-10 lg:px-8">
        <section className="flex flex-1 flex-col rounded-3xl border border-white/5 bg-slate-900/70 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3 border-b border-white/5 px-6 py-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Mission Control
              </p>
              <h1 className="text-2xl font-semibold text-white">
                Autonomous AI Agent
              </h1>
            </div>
            <div className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-1 text-sm font-semibold text-emerald-200">
              Goal Oriented
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <div
              ref={chatRef}
              className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-5"
            >
              {messages.length === 0 ? (
                <div className="mx-auto mt-16 max-w-sm text-center text-slate-400">
                  <p className="text-lg font-semibold text-slate-200">
                    Ready to deploy your AI operator.
                  </p>
                  <p className="mt-2 text-sm">
                    Define a high-level mission and send the first command. Orion
                    will plan, reason, and move you forward.
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[72%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-lg transition ${
                      classNameForRole(message.role)
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.meta && (
                      <div className="mt-2 flex items-center justify-between text-xs text-white/70">
                        {message.meta.status && (
                          <span className="uppercase tracking-wide">
                            {message.meta.status}
                          </span>
                        )}
                        {typeof message.meta.confidence === "number" && (
                          <span>Confidence {(message.meta.confidence * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-white/5 px-6 py-5"
          >
            <fieldset className="flex flex-col gap-3">
              <label htmlFor="mission" className="text-xs font-semibold uppercase">
                Mission Goal
              </label>
              <input
                id="mission"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm shadow-inner shadow-black/30 outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/40"
                placeholder="Define the overarching mission"
              />

              <label htmlFor="message" className="text-xs font-semibold uppercase">
                Command
              </label>
              <textarea
                id="message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm shadow-inner shadow-black/30 outline-none transition focus:border-blue-400/70 focus:ring-2 focus:ring-blue-400/30"
                placeholder="Ask the agent for a plan, status update, or next action."
              />
              {error && (
                <p className="text-xs font-medium text-rose-300">
                  {error}. The agent switched to offline heuristics.
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  Orion keeps full context of this mission while active.
                </span>
                <button
                  type="submit"
                  disabled={disabled || !draft.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  {isLoading ? "Thinking..." : "Send Command"}
                </button>
              </div>
            </fieldset>
          </form>
        </section>

        <aside className="flex w-full max-w-xl flex-col gap-6 rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/80 to-slate-950/70 p-6 backdrop-blur-xl">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Situation Room
            </p>
            <h2 className="text-xl font-semibold text-white">
              Mission telemetry & strategy
            </h2>
          </div>

          <section className="space-y-4 rounded-2xl border border-white/5 bg-black/20 p-4">
            <header className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Status</h3>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                  agentState?.status === "ready"
                    ? "bg-emerald-400/20 text-emerald-200"
                    : agentState?.status === "blocked"
                      ? "bg-rose-400/20 text-rose-200"
                      : "bg-blue-400/20 text-blue-200"
                }`}
              >
                {agentState?.status ?? "Awaiting input"}
              </span>
            </header>
            <p className="text-sm text-slate-400">
              {agentState
                ? agentState.thoughts.summary
                : "Provide a mission command to bootstrap agent reasoning and planning."}
            </p>
            {agentState && (
              <div className="space-y-2 rounded-xl border border-white/5 bg-white/5 p-3">
                <p className="text-xs font-semibold uppercase text-slate-300">
                  Reasoning Trace
                </p>
                <p className="text-sm text-slate-200">{agentState.thoughts.reasoning}</p>
                <p className="text-xs text-slate-400">
                  Confidence {(agentState.thoughts.confidence * 100).toFixed(0)}%
                </p>
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-white/5 bg-black/20 p-4">
            <header className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Mission Plan</h3>
              <span className="text-xs text-slate-400">{planProgress}% complete</span>
            </header>
            <ol className="space-y-2 text-sm text-slate-300">
              {agentState
                ? agentState.plan.steps.map((step, index) => {
                    const isActive = index + 1 === agentState.plan.currentStep;
                    const isComplete = index + 1 < agentState.plan.currentStep;
                    return (
                      <li
                        key={step}
                        className={`flex items-start gap-3 rounded-xl border border-white/5 p-3 ${
                          isActive
                            ? "bg-blue-500/10 ring-1 ring-blue-400/40"
                            : isComplete
                              ? "bg-emerald-500/10"
                              : "bg-white/5"
                        }`}
                      >
                        <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-xs font-semibold">
                          {index + 1}
                        </span>
                        <p className="leading-6">{step}</p>
                      </li>
                    );
                  })
                : [1, 2, 3].map((index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 rounded-xl border border-dashed border-white/10 bg-white/5 p-3 text-slate-500"
                    >
                      <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-xs font-semibold">
                        {index}
                      </span>
                      <p>Waiting for the agent to propose the mission plan.</p>
                    </li>
                  ))}
            </ol>
          </section>

          <section className="space-y-3 rounded-2xl border border-white/5 bg-black/20 p-4">
            <h3 className="text-sm font-semibold text-slate-200">Next Suggested Actions</h3>
            <ul className="space-y-2 text-sm text-slate-200">
              {agentState
                ? agentState.nextActions.map((action) => (
                    <li
                      key={action}
                      className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <span className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                      <p>{action}</p>
                    </li>
                  ))
                : [
                    "Define the mission objective in the field above.",
                    "Ask the agent for a project plan or next best action.",
                    "Iterate on the plan until you are satisfied.",
                  ].map((action) => (
                    <li
                      key={action}
                      className="flex items-start gap-2 rounded-xl border border-dashed border-white/10 bg-white/5 p-3 text-slate-500"
                    >
                      <span className="mt-1 inline-block h-2 w-2 rounded-full bg-slate-500" />
                      <p>{action}</p>
                    </li>
                  ))}
            </ul>
          </section>

          {agentState?.sources?.length ? (
            <section className="space-y-2 rounded-2xl border border-white/5 bg-black/20 p-4">
              <h3 className="text-sm font-semibold text-slate-200">Sources</h3>
              <ul className="space-y-2 text-sm text-blue-300 underline decoration-blue-400/60">
                {agentState.sources.map((source) => (
                  <li key={source}>
                    <a href={source} target="_blank" rel="noopener noreferrer">
                      {source}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

