"""Capture console exceptions from an already-running Chrome DevTools target."""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request

from websockets.sync.client import connect


def send(socket: object, message_id: int, method: str, params: dict[str, object] | None = None) -> None:
    socket.send(json.dumps({"id": message_id, "method": method, "params": params or {}}))  # type: ignore[attr-defined]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--url", required=True)
    parser.add_argument("--wait-seconds", type=float, default=5)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    with urllib.request.urlopen(f"http://127.0.0.1:{args.port}/json/list", timeout=5) as response:
        targets = json.loads(response.read().decode("utf-8"))
    target = next((item for item in targets if item.get("type") == "page"), None)
    if target is None:
        raise RuntimeError("chrome_page_target_missing")

    console: list[dict[str, object]] = []
    with connect(target["webSocketDebuggerUrl"], open_timeout=5, close_timeout=2) as socket:
        send(socket, 1, "Runtime.enable")
        send(socket, 2, "Page.enable")
        send(socket, 3, "Log.enable")
        send(socket, 4, "Page.navigate", {"url": args.url})
        deadline = time.monotonic() + args.wait_seconds
        loaded = False
        while time.monotonic() < deadline:
            try:
                message = json.loads(socket.recv(timeout=0.5))
            except TimeoutError:
                continue
            method = message.get("method")
            if method == "Page.loadEventFired":
                loaded = True
            if method == "Runtime.exceptionThrown":
                console.append({"type": "exception", "details": message.get("params", {})})
            if method == "Log.entryAdded":
                entry = message.get("params", {}).get("entry", {})
                if entry.get("level") in {"error", "warning"}:
                    console.append({"type": "log", "details": entry})
            if method == "Runtime.consoleAPICalled":
                params = message.get("params", {})
                if params.get("type") in {"error", "warning"}:
                    console.append({"type": "console", "details": params})
        send(socket, 5, "Runtime.evaluate", {"expression": "document.body.innerText"})
        body_text = ""
        for _ in range(10):
            message = json.loads(socket.recv(timeout=1))
            if message.get("id") == 5:
                body_text = str(message.get("result", {}).get("result", {}).get("value", ""))
                break

    result = {"loaded": loaded, "console": console, "body_text": body_text}
    with open(args.output, "w", encoding="utf-8", newline="\n") as output:
        json.dump(result, output, ensure_ascii=False, indent=2)
        output.write("\n")
    print(json.dumps({"loaded": loaded, "console_count": len(console), "body_length": len(body_text)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
