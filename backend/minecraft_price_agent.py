"""
Minecraft Price Analyst Agent
Gathers the best prices for Minecraft from reliable sources using Claude + web search.
"""

import anthropic
import json

SYSTEM_PROMPT = """You are an expert software and gaming price analyst specializing in finding
the best deals for video games and software. Your mission is to research and report on
the current best prices for Minecraft across all available platforms and storefronts.

When analyzing prices you will:
1. Search multiple reliable retail sources (official stores, major retailers, key resellers)
2. Compare prices across all Minecraft editions (Java, Bedrock, bundles)
3. Note regional pricing where relevant (USD focus, mention others if notable)
4. Flag any active sales, discounts, or bundle deals
5. Identify the cheapest legitimate source for each edition
6. Warn about grey-market or potentially risky key resellers
7. Provide a clear, structured summary with your top recommendations

Reliable sources to check include:
- minecraft.net (official store)
- Microsoft Store
- Xbox.com
- PlayStation Store (for PS4/PS5 Bedrock edition)
- Nintendo eShop (for Switch Bedrock edition)
- Steam (Java edition via Minecraft Launcher)
- Major retailers: Amazon, Best Buy, Target, Walmart
- Reputable key resellers: Humble Bundle, Fanatical, Green Man Gaming

Always present prices clearly with the source URL and date context."""


def run_minecraft_price_agent() -> None:
    """Run the Minecraft price analyst agent with web search capabilities."""
    client = anthropic.Anthropic()

    print("=" * 60)
    print("  Minecraft Price Analyst Agent")
    print("=" * 60)
    print("Searching for the best Minecraft prices...\n")

    messages: list[anthropic.types.MessageParam] = [
        {
            "role": "user",
            "content": (
                "Please research and find the best current prices for Minecraft across all "
                "available editions and platforms. I want to know:\n\n"
                "1. **Minecraft Java Edition** – best price and where to buy\n"
                "2. **Minecraft Bedrock Edition** – best price and where to buy\n"
                "3. **Minecraft Java + Bedrock Bundle** – best price and where to buy\n"
                "4. Any active sales, discounts, or promotions right now\n"
                "5. Platform-specific pricing (PC, Xbox, PlayStation, Nintendo Switch, Mobile)\n"
                "6. Your **#1 recommendation** for the best overall value\n\n"
                "Please search current sources to get up-to-date pricing."
            ),
        }
    ]

    # Agentic loop – runs until Claude finishes (stop_reason == "end_turn")
    # or hits a server-side iteration limit (stop_reason == "pause_turn")
    max_continuations = 5
    continuation_count = 0

    while continuation_count < max_continuations:
        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=4096,
            thinking={"type": "adaptive"},
            system=SYSTEM_PROMPT,
            tools=[
                {"type": "web_search_20260209", "name": "web_search"},
                {"type": "web_fetch_20260209", "name": "web_fetch"},
            ],
            messages=messages,
        )

        # Stream thinking and text blocks to the console as they arrive
        for block in response.content:
            if block.type == "thinking":
                print("[Thinking...]\n")
            elif block.type == "text":
                print(block.text)

        if response.stop_reason == "end_turn":
            break

        # Server-side tools hit their iteration limit – re-send to continue
        if response.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": response.content})
            continuation_count += 1
            continue

        # Unexpected stop reason – bail out
        print(f"\n[Agent stopped with reason: {response.stop_reason}]")
        break

    print("\n" + "=" * 60)
    print("  Analysis complete.")
    print("=" * 60)


def get_price_report() -> dict:
    """
    Return a structured price report as a Python dict.
    Useful for programmatic consumption (e.g. from a FastAPI endpoint).
    """
    client = anthropic.Anthropic()

    messages: list[anthropic.types.MessageParam] = [
        {
            "role": "user",
            "content": (
                "Search for the current best prices for Minecraft editions (Java, Bedrock, "
                "Java+Bedrock Bundle) across all major platforms and stores. "
                "Return a JSON object with this exact structure:\n\n"
                "{\n"
                '  "last_updated": "<ISO date>",\n'
                '  "editions": [\n'
                "    {\n"
                '      "name": "<edition name>",\n'
                '      "platform": "<platform>",\n'
                '      "best_price_usd": <number>,\n'
                '      "regular_price_usd": <number>,\n'
                '      "store": "<store name>",\n'
                '      "url": "<store URL>",\n'
                '      "on_sale": <bool>,\n'
                '      "notes": "<any relevant notes>"\n'
                "    }\n"
                "  ],\n"
                '  "top_recommendation": "<brief recommendation>",\n'
                '  "active_deals": ["<deal description>", ...]\n'
                "}\n\n"
                "Return ONLY valid JSON, no markdown fences."
            ),
        }
    ]

    max_continuations = 5
    continuation_count = 0
    final_text = ""

    while continuation_count < max_continuations:
        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=4096,
            thinking={"type": "adaptive"},
            system=SYSTEM_PROMPT,
            tools=[
                {"type": "web_search_20260209", "name": "web_search"},
                {"type": "web_fetch_20260209", "name": "web_fetch"},
            ],
            messages=messages,
        )

        for block in response.content:
            if block.type == "text":
                final_text += block.text

        if response.stop_reason == "end_turn":
            break

        if response.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": response.content})
            continuation_count += 1
            continue

        break

    try:
        return json.loads(final_text.strip())
    except json.JSONDecodeError:
        return {"raw_response": final_text, "error": "Could not parse structured JSON"}


if __name__ == "__main__":
    run_minecraft_price_agent()
