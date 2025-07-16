Below is a paste-ready crib-sheet you can drop straight into Windsurf.
It assumes you want **all three features at once**:

* `stream=True`
* at least one **function definition** under `tools` (or legacy `functions`)
* a **structured-output guarantee** — either JSON-mode (`response_format={"type":"json_object"}`) **or** the newer Strict/Schema options.

---

## 1 · What the wire-traffic really looks like (timeline)

1. **SSE frame #1** – usually contains only the tool-call *name* (e.g.
   `{ "delta": { "tool_call": { "name": "get_weather" }}}`).
   That single token lets you show “Calling get\_weather()…” instantly. ([Telnyx Developers][1])
2. **Subsequent frames** – stream the `arguments` string *piecemeal*.
   *Nothing* is valid JSON until you see the closing `}`.
3. After the closing brace (and the `[DONE]` frame) you can `json.loads()`
   and run the tool.
4. Once you POST the tool’s return payload back as a user message, you can
   enable streaming again for the model’s *text* answer.

> **Buffer rule:** stream for UX, but *don’t parse/execute* until the structure closes.
> For partial-JSON you’ll otherwise hit `JSONDecodeError`. ([mikeborozdin.com][2])

---

## 2 · Switches & settings that bite

| Setting                                  | Hidden gotcha                                                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `response_format={"type":"json_object"}` | API throws **400** unless the word “JSON” appears somewhere in your prompt/context; if you forget, the model may stream whitespace forever. ([OpenAI Help Center][3])            |
| JSON mode **plus tools**                 | When a tool call fires, JSON-mode is ignored for that turn—arguments are already JSON. Don’t expect a second assistant-text item in the same turn.                               |
| `strict:true` inside a tool schema       | Turns on **Structured Outputs** for the arguments; the model must match the JSON Schema exactly—great, but unsupported keywords like `patternProperties` will 400. ([OpenAI][4]) |
| Multiple tool calls                      | Chunks are grouped by an `index` field; the very first chunk for each call contains only the name. Make a `tool_calls[index]` buffer per call. ([Telnyx Developers][1])          |
| `tool_choice="required"` loops           | Forcing every call can trap you in an infinite loop if the model can’t satisfy the schema—let it default to `"auto"` unless you *really* must enforce. ([GitHub][5])             |
| Model support                            | JSON-mode & strict need a 2024-06-13 or later model (GPT-4.1, 4-mini, 3.5-1106, etc.). Older 0613 models error on `response_format`. ([OpenAI Help Center][3])                   |

---

## 3 · Minimal reference implementation (Python 4-step loop)

```python
client = OpenAI()

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Return weather for a city",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string"}
            },
            "required": ["location"],
            "strict": True          # Structured Outputs guarantee
        }
    }
}]

def call_llm(messages):
    return client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=messages,
        tools=tools,
        stream=True,
        response_format={"type": "json_object"}   # safe even with tools
    )

messages = [{"role":"user","content":"Weather in Denver in JSON"}]

# 1️⃣ request + stream
buffer = ""
tool_call = None
for chunk in call_llm(messages):
    delta = chunk.choices[0].delta
    if delta.tool_call:             # function path
        tool_call = delta.tool_call
        buffer += delta.tool_call.arguments or ""
        if buffer.endswith("}"):    # crude completeness test
            args = json.loads(buffer)
            result = get_weather(**args)          # 2️⃣ run tool
            messages += [
                {"role":"assistant","tool_call_id":tool_call.id,
                 "content":None},
                {"role":"tool","tool_call_id":tool_call.id,
                 "content":json.dumps(result)}
            ]
            break
    else:                           # text path
        sys.stdout.write(delta.content or "")

# 3️⃣ follow-up ask for final answer (can stream again)
for chunk in call_llm(messages):
    sys.stdout.write(chunk.choices[0].delta.content or "")
```

---

## 4 · Edge-case checklist

1. **Timeouts** – leave the HTTP/2 stream open; set both client & server
   idletimeouts > model-max-tokens/≈50 wpm.
2. **Back-pressure** – browsers kill SSE on \~2 min idle; flush a fake
   “keep-alive” token if your tool runs long.
3. **Schema drift** – adding optional fields without updating `strict`
   schema ⇒ instant 400. Version your schemas.
4. **Cost visibility** – streaming doesn’t change token billing; run
   `usage.total_tokens` after each turn.
5. **Parallelism** – you *can* accept multiple tool calls in one turn;
   just track `index` and dispatch concurrently, then send the results as
   an array of `tool` messages. ([Telnyx Developers][1])
6. **Azure parity** – some 2024 Azure endpoints still reject
   `tool_choice="required"` and `json_schema` formats; feature-flag your
   code or fall back. ([GitHub][5])

---

### TL;DR

*Streaming + Function Calls + Structured Outputs* **do** coexist in a single Chat Completions request—
just remember you **stream for UX**, **buffer for correctness**, and guard against the handful of schema and parameter pitfalls above.

[1]: https://developers.telnyx.com/docs/inference/streaming-functions "Function Calling (Streaming + Parallel Calls) | Telnyx"
[2]: https://www.mikeborozdin.com/post/json-streaming-from-openai "Streaming JSON from OpenAI API"
[3]: https://help.openai.com/en/articles/8555517-function-calling-in-the-openai-api "Function Calling in the OpenAI API | OpenAI Help Center"
[4]: https://openai.com/index/introducing-structured-outputs-in-the-api/?utm_source=chatgpt.com "Introducing Structured Outputs in the API - OpenAI"
[5]: https://github.com/Azure/azure-rest-api-specs/issues/29844?utm_source=chatgpt.com "[BUG] `tool_choice=\"required\"` is still not supported in the latest ..."
