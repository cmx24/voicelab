"""
Minecraft Java Edition Pricing Analyst Agent
=============================================
An AI agent that takes the role of a system and gaming pricing analyst,
researching the best prices for Minecraft Java Edition from safe, verified sources.

Requirements:
    pip install anthropic

Usage:
    python agents/minecraft_pricing_agent.py
    ANTHROPIC_API_KEY=your_key python agents/minecraft_pricing_agent.py
"""

import os
import anthropic

SYSTEM_PROMPT = """You are a senior system and gaming pricing analyst with 10+ years of experience
tracking game prices, platform deals, and digital storefronts. Your specialty is identifying
the absolute best legitimate prices while protecting consumers from scams and fraud.

## Your Analyst Persona
- You are methodical, data-driven, and deeply familiar with gaming storefronts worldwide
- You cross-reference multiple sources before making any recommendation
- You flag any source that shows red flags: unusually low prices, unknown resellers,
  grey-market key sites, or anything that could be a scam or piracy vector
- You know which resellers are officially authorized by Mojang/Microsoft vs. grey market

## What counts as a SAFE source
✅ Official: minecraft.net (Mojang/Microsoft direct)
✅ Major platform stores: Xbox/Microsoft Store
✅ Official retail partners with physical/digital codes
✅ Major established retailers (Amazon, Best Buy, Walmart, GameStop) for gift cards/codes

## What counts as UNSAFE / Red flags
❌ Prices more than 30% below MSRP from unknown resellers
❌ Key reseller sites with no official publisher authorization (e.g. G2A, Kinguin, CDKeys)
❌ Sites with no verifiable business address or contact info
❌ Any site associated with chargebacks, account bans, or stolen keys
❌ Unofficial grey-market marketplaces

## Your Research Process
1. Confirm the current official MSRP directly from minecraft.net
2. Search for any ongoing official sales or bundles (Microsoft Store, Xbox Game Pass)
3. Check authorized major retailers for promotional pricing
4. Look into regional pricing differences (VPN-based purchasing — note legality/ToS)
5. Check if the Minecraft Java + Bedrock bundle is available (often better value)
6. Always cite your sources with direct URLs

## Output Format
Present findings as a structured analyst report with these sections:

### 💰 Official MSRP
### 🏆 Best Verified Deals (ranked by value)
### 🔍 Source Credibility Ratings
### ✅ BEST BUY Recommendation
### ⚠️ Sources to Avoid
### 💡 Pro Tips

Be thorough. Research at least 4-5 sources before concluding."""


def run_pricing_agent():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "ANTHROPIC_API_KEY environment variable is not set.\n"
            "Set it with: export ANTHROPIC_API_KEY=your_key_here"
        )

    client = anthropic.Anthropic(api_key=api_key)

    user_query = (
        "I want to buy Minecraft Java Edition. "
        "Research the current prices from all legitimate sources and produce a full analyst report "
        "covering: the official MSRP, any active deals or sales, bundle options (Java + Bedrock), "
        "Xbox Game Pass availability, regional pricing tips, and a clear BEST BUY recommendation. "
        "Flag any sketchy, grey-market, or scam sources I should avoid. "
        "Include direct purchase URLs for every safe option you find."
    )

    tools = [
        {"type": "web_search_20260209", "name": "web_search"},
        {"type": "web_fetch_20260209", "name": "web_fetch"},
    ]

    messages: list[dict] = [{"role": "user", "content": user_query}]

    print("=" * 68)
    print("   MINECRAFT JAVA EDITION — PRICING ANALYST REPORT")
    print("   Powered by Claude Opus 4.6  |  Live Web Research")
    print("=" * 68)
    print()

    max_continuations = 10
    continuation_count = 0

    while continuation_count < max_continuations:
        continuation_count += 1

        with client.messages.stream(
            model="claude-opus-4-6",
            max_tokens=8192,
            thinking={"type": "adaptive"},
            system=SYSTEM_PROMPT,
            tools=tools,
            messages=messages,
        ) as stream:
            in_thinking_block = False

            for event in stream:
                match event.type:
                    case "content_block_start":
                        block = event.content_block
                        match block.type:
                            case "thinking":
                                in_thinking_block = True
                                print("  [ Researching & reasoning... ]", flush=True)
                            case "text":
                                in_thinking_block = False
                            case "server_tool_use":
                                in_thinking_block = False
                                # Show the user what's being searched
                                input_data = getattr(block, "input", {})
                                if isinstance(input_data, dict):
                                    query = input_data.get("query", input_data.get("url", ""))
                                    if query:
                                        tool_label = "🔍 Searching" if block.name == "web_search" else "🌐 Fetching"
                                        print(f"\n  {tool_label}: {query[:80]}", flush=True)

                    case "content_block_delta":
                        delta = event.delta
                        match delta.type:
                            case "text_delta":
                                if not in_thinking_block:
                                    print(delta.text, end="", flush=True)
                            case "input_json_delta":
                                # Accumulating tool input — show search query when complete
                                pass

                    case "content_block_stop":
                        in_thinking_block = False

            final_message = stream.get_final_message()

        # Append full assistant content (preserves compaction/tool blocks)
        messages.append({"role": "assistant", "content": final_message.content})

        stop_reason = final_message.stop_reason

        if stop_reason == "end_turn":
            # Agent finished naturally
            break

        if stop_reason == "pause_turn":
            # Server-side tool loop hit its 10-iteration limit — re-send to continue
            # Do NOT add a new user message; the API resumes from the trailing server_tool_use block
            print("\n  [ Continuing research... ]\n", flush=True)
            continue

        # Any other stop reason — exit the loop
        break

    print("\n\n" + "=" * 68)
    print(f"  Analysis complete. ({continuation_count} API call(s) made)")
    print("  Verify all prices on official sites before purchasing.")
    print("=" * 68 + "\n")


if __name__ == "__main__":
    run_pricing_agent()
