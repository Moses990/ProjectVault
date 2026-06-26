import argparse
import os
import signal
import subprocess
import threading
import time

import uvicorn


def process_exists(process_id: int) -> bool:
    result = subprocess.run(
        ["tasklist", "/FI", f"PID eq {process_id}"],
        capture_output=True,
        text=True,
        check=False,
    )
    return str(process_id) in result.stdout


def exit_when_parent_stops(parent_pid: int) -> None:
    while True:
        time.sleep(1)
        if not process_exists(parent_pid):
            os.kill(os.getpid(), signal.SIGTERM)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Project Vault backend.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--parent-pid", type=int)
    args = parser.parse_args()

    if args.parent_pid:
        threading.Thread(
            target=exit_when_parent_stops,
            args=(args.parent_pid,),
            daemon=True,
        ).start()

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
