import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({
  goal: z.string().min(1, "Goal is required."),
  message: z.string().min(1, "Message is required."),
  conversation: z
    .array(
      z.object({
        role: z.enum(["user", "agent"]),
        content: z.string(),
      }),
    )
    .optional()
    .default([]),
});

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

const baseSystemPrompt = `You are Orion, an autonomous AI operator embedded in a web dashboard.
You help users plan and execute tasks toward a single explicit goal.
Always reply using JSON with the following shape:
{
  "status": "thinking" | "ready" | "blocked",
  "thoughts": {
    "summary": string,
    "reasoning": string,
    "confidence": number
  },
  "plan": {
    "currentStep": number,
    "steps": string[]
  },
  "nextActions": string[],
  "reply": string,
  "sources": string[]
}

Rules:
- Keep steps actionable and scoped to the goal.
- Keep confidence between 0 and 1.
- Keep sources empty unless you actually cite a URL or reference.
- "status" is "thinking" while planning, "ready" when giving a final answer, "blocked" when missing info.
- "reply" is the natural-language message shown to the user.
- Preserve context from the conversation.`;

const agentResponseSchema = z.object({
  status: z.enum(["thinking", "ready", "blocked"]),
  thoughts: z.object({
    summary: z.string(),
    reasoning: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  plan: z.object({
    currentStep: z.number().min(0),
    steps: z.array(z.string()),
  }),
  nextActions: z.array(z.string()),
  reply: z.string(),
  sources: z.array(z.string()),
});

type AgentResponse = z.infer<typeof agentResponseSchema>;

const fallbackAgent = (input: z.infer<typeof requestSchema>): AgentResponse => {
  const previousSteps =
    input.conversation
      .filter((item) => item.role === "agent")
      .slice(-1)
      .map((item) => item.content)
      .join("\n") ?? "";

  const pseudoPlan = [
    `Clarify the requested outcome for "${input.goal}".`,
    `Break the goal into 2-3 executable tasks.`,
    `Present the results or next steps to the user.`,
  ];

  return {
    status: "thinking",
    thoughts: {
      summary: `Drafted plan for goal "${input.goal}".`,
      reasoning:
        "No OpenAI key detected; returning heuristic guidance derived from local template.",
      confidence: 0.3,
    },
    plan: {
      currentStep: 1,
      steps: pseudoPlan,
    },
    nextActions: [
      `Ask the user for more details about "${input.goal}".`,
      "Offer example steps they can try immediately.",
    ],
    reply: [
      previousSteps ? `Recapping last strategy:\n${previousSteps}` : "",
      `Here's a fresh plan for **${input.goal}**:`,
      pseudoPlan.map((step, idx) => `${idx + 1}. ${step}`).join("\n"),
      "",
      "I'm running in local guidance mode until an OpenAI key is provided.",
    ]
      .filter(Boolean)
      .join("\n"),
    sources: [],
  };
};

export async function POST(request: NextRequest) {
  const json = await request.json();
  const data = requestSchema.parse(json);

  if (!openaiClient) {
    return NextResponse.json(fallbackAgent(data));
  }

  const openaiMessages = [
    { role: "system" as const, content: baseSystemPrompt },
    ...data.conversation.map((message) => ({
      role: message.role === "agent" ? ("assistant" as const) : ("user" as const),
      content: message.content,
    })),
    {
      role: "user" as const,
      content: JSON.stringify({
        goal: data.goal,
        message: data.message,
      }),
    },
  ];

  try {
    const completion = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: openaiMessages,
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from model.");
    }

    const parsed = agentResponseSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }

    return NextResponse.json(parsed.data satisfies AgentResponse);
  } catch (error) {
    console.error("Agent error:", error);
    return NextResponse.json(fallbackAgent(data), { status: 200 });
  }
}
