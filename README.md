# DhanDost

**An AI personal-finance decision coach for Indian salaried professionals.** Connect real transaction data and get help deciding where the next rupee goes.

Built solo, 0→1. Every product and architecture decision here is mine; implementation was AI-assisted.

---

## The problem

Indian salaried professionals get two kinds of financial help, and neither works.

Generic content explains concepts to people whose question isn't conceptual — someone with a card balance, an EMI, rent, and ₹18,000 of slack at month end doesn't need to be told what a debt avalanche is. They need to know what to do with *their* ₹18,000, this month.

The alternative is advice from someone selling a product. Specific, but the incentives aren't aligned with the person receiving it.

The gap is personalised, numerate, non-conflicted decision support. That's what this is.

## The core design decision: the LLM proposes, it never computes

An LLM is good at framing a financial situation in plain language and explaining a trade-off. It is untrustworthy at arithmetic and hazardous when naming financial products.

So the architecture enforces a hard split:

> **The language model proposes strategy in words. Deterministic TypeScript computes every rupee the user sees.**

The model never produces a number that reaches the user. It reasons about *approach* — clear the high-interest debt first, hold more buffer, split between the two — while the actual allocation, interest saved, months to payoff and projected balances are computed in code from the user's real data.

This is a user-harm decision, not a performance optimisation. If a coaching product tells someone to move ₹40,000 and that figure is a hallucination, the damage is directly financial. Removing the model from the arithmetic path eliminates that failure mode *structurally* rather than probabilistically — and structural beats probabilistic when the downside is someone's money.

**Regulatory boundary.** India's advisory regime draws a line around recommending specific financial products. A scrubbing layer strips named financial products from model output before it reaches the user, enforced in code rather than in a system prompt — because a prompt is a request and a code path is a guarantee. DhanDost tells you what *kind* of move fits your situation. It does not tell you which fund to buy.

Both constraints cost capability. A less constrained product would demo better. The trade was deliberate: in personal finance, confidently wrong is worse than usefully narrow.

## Three Paths, not one recommendation

A single recommendation invites two failure modes — the user follows it without understanding it, or rejects it and gets nothing.

So the product presents **Safer / Balanced / Bolder**: the same situation and the same real numbers, three legitimate strategies, each costed with its trade-off named. The user chooses.

Risk preference depends on job security, family obligations and temperament — none of which are in the transaction ledger. Presenting three defensible options treats the user as the decision-maker and the product as the analyst, and makes the reasoning inspectable: seeing Bolder next to Safer teaches the trade-off in a way one answer never does.

## Transaction categorisation: layered, not a model call

None of the above matters if the underlying data is wrong, and Indian bank transaction descriptions are close to hostile — UPI strings, cryptic merchant codes, inconsistent formats.

Categorisation runs as a layered engine in deliberate order of cost and reliability:

1. Exact known-merchant mappings
2. UPI-suffix extraction
3. Keyword rules
4. LLM sweep — only for what survives the above
5. User-feedback loop, where corrections improve future categorisation

The principle: use the cheapest deterministic method that can settle a case, and reserve the model for genuine ambiguity. Faster, cheaper, more predictable — and because of the feedback loop, the system's dependence on the model *decreases* with use.

**Self-transfers** were a case that only surfaced in real data. Money moving between a user's own accounts is neither income nor spending, but naively registers as both and inflates every downstream number. Small feature, large correctness gain.

## What's built

- Multi-user auth with per-user data isolation (row-level security enforced at the database)
- Transaction ingestion and layered categorisation
- Three Paths decision engine
- Two-stage lifecycle for debt paydown and savings allocation
- Self-transfer detection
- Conversational AI coach for follow-up questions

## Stack

React + Tailwind frontend · Supabase (Postgres, edge functions, RLS) · OpenAI for the reasoning layer · schema managed through migrations · built with AI-assisted development (Lovable)

## What this doesn't have

Stated plainly, because the alternative is letting someone discover it.

- **No validated user base.** A working product running against real transaction data, including my own. Not a product with demonstrated retention or outcome data. No traction numbers, and I'm not constructing any.
- **Categorisation accuracy isn't benchmarked.** It works on the data I've run through it. There's no labelled accuracy set, and that's the first thing I'd build — you can't improve a layered system without knowing which layer fails.
- **The scrubbing layer is architecturally sound but not adversarially tested.** It's the boundary between a coaching tool and unlicensed financial advice, and I'd harden it before any real user growth.

## What I'd do differently

- **Run real transaction data through it on day one.** Self-transfers and UPI messiness were discovered late and both were structural. Real data first would have shaped the categorisation design instead of correcting it.
- **Instrument the decision, not just the flow.** I built Three Paths without tracking which path users pick. That distribution is the most informative signal the product could produce — it reads both user risk appetite and whether my framing is balanced or quietly steering.
- **Define the accuracy bar before building the engine.** I optimised for "works on what I've tried" rather than a stated threshold. Founder habit, not a product habit.

---

**Ashutosh Suman** · [LinkedIn](https://linkedin.com/in/ashutoshsuman) · ashutoshsuman4@gmail.com
