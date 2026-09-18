#!/usr/bin/env python3
"""
WebSocket Silent Listener & Bidirectional Monitor
-------------------------------------------------
Debug and monitor WebSocket communication for the MO Cobot HMI.

Supports Two Modes:

1. CLIENT MODE (Default):
   Connects to the WebSocket server (port 8080) as a passive client and logs
   all server broadcasts.
   Usage:
       python3 ws_listener.py

2. BIDIRECTIONAL SNIFFER / PROXY MODE (--proxy):
   Sits transparently between the HMI and the Server without modifying any
   code in the HMI. Captures 100% of traffic in BOTH directions:
     • [HMI ──► SERVER] Commands clicked in the UI
     • [SERVER ──► HMI] Feedback, acknowledgments (command_received), and telemetry
   Usage:
       python3 ws_listener.py --proxy
       (Server runs on 8081, Proxy listens on 8080, HMI connects to 8080 unchanged)
"""

import sys
import os
import json
import asyncio
import argparse
from datetime import datetime

# Color terminal codes
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
RED = "\033[31m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
BLUE = "\033[34m"
MAGENTA = "\033[35m"
CYAN = "\033[36m"
WHITE = "\033[37m"

def get_timestamp() -> str:
    """Returns formatted timestamp with millisecond precision."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

def color_for_type(msg_type: str) -> str:
    """Assigns color based on the message type for easy scanning."""
    t = str(msg_type).lower()
    if "command_received" in t:
        return GREEN + BOLD
    if "update_state" in t or "status" in t:
        return CYAN
    if "error" in t:
        return RED + BOLD
    if "connection" in t:
        return YELLOW + BOLD
    if "load_app" in t:
        return MAGENTA
    return WHITE

def format_summary(msg: dict, direction: str = "IN") -> str:
    """Creates a concise, human-readable summary of the message contents."""
    msg_type = msg.get("type", "UNKNOWN")
    data = msg.get("data")

    # Specifically format command_received to highlight int vs str
    if msg_type == "command_received":
        data_type = type(data).__name__
        val_repr = f"{data!r}"
        return f"cmd_ack: data={val_repr} (type: {BOLD}{data_type}{RESET})"

    # Outbound commands from HMI
    if direction == "OUT":
        if data:
            return f"action={msg_type.upper()} | data={data!r}"
        return f"action={msg_type.upper()}"

    # Specifically format update_state with key metrics
    if msg_type in ("update_state", "status_update") and isinstance(data, dict):
        mode = data.get("robot_mode", "?")
        running = data.get("program_running", "?")
        initialized = data.get("initialized", "?")
        active_bolt = data.get("active_bolt")
        pos = data.get("position")
        pos_str = f"({pos.get('x',0):.1f}, {pos.get('y',0):.1f}, {pos.get('z',0):.1f})" if isinstance(pos, dict) else "?"
        return f"mode={mode} | init={initialized} | running={running} | bolt={active_bolt} | pos={pos_str}"

    if msg_type == "connection" and isinstance(data, dict):
        return f"tcp_connected={data.get('tcp_connected')}"

    if isinstance(data, dict):
        keys = list(data.keys())
        return f"keys: {keys[:5]}{'...' if len(keys) > 5 else ''}"

    return f"data: {data!r} ({type(data).__name__})"


class BaseLogger:
    def __init__(self, log_file_path: str, verbose: bool = False):
        self.log_file_path = log_file_path
        self.verbose = verbose
        self.msg_count = 0
        self.file_handle = open(self.log_file_path, "a", encoding="utf-8")

    def log_line(self, direction_label: str, dir_color: str, raw_str: str, dir_tag: str = "IN"):
        self.msg_count += 1
        ts = get_timestamp()

        # Write clean line to log file
        self.file_handle.write(f"[{ts}] {dir_tag} {raw_str}\n")
        self.file_handle.flush()

        # Terminal output
        try:
            msg = json.loads(raw_str)
            msg_type = msg.get("type", "UNKNOWN")
            type_color = color_for_type(msg_type)
            summary = format_summary(msg, direction=dir_tag)

            print(f"{DIM}[{ts}]{RESET} #{self.msg_count:04d} {dir_color}[{direction_label}]{RESET} {type_color}[{msg_type.upper()}]{RESET} {summary}")

            if self.verbose:
                pretty = json.dumps(msg, indent=2)
                print(f"{DIM}{pretty}{RESET}\n")

        except json.JSONDecodeError:
            print(f"{DIM}[{ts}]{RESET} #{self.msg_count:04d} {dir_color}[{direction_label}]{RESET} {YELLOW}[RAW]{RESET} {raw_str}")

    def close(self):
        if self.file_handle:
            self.file_handle.write(f"[{get_timestamp()}] --- MONITOR STOPPED ---\n")
            self.file_handle.close()


# ═════════════════════════════════════════════════════════════════════════════
# MODE 1: Passive Client Listener
# ═════════════════════════════════════════════════════════════════════════════
async def run_client_mode(url: str, logger: BaseLogger):
    import websockets

    print(f"\n{BOLD}{CYAN}======================================================{RESET}")
    print(f"{BOLD}  WebSocket Silent Listener (Passive Client Mode){RESET}")
    print(f"  • Target URL : {GREEN}{url}{RESET}")
    print(f"  • Log File   : {YELLOW}{logger.log_file_path}{RESET}")
    print(f"  • Captures   : All broadcast messages from server")
    print(f"  • Note       : For 100% bidirectional traffic (HMI ➔ Server & Server ➔ HMI),")
    print(f"                 run with: {BOLD}python3 ws_listener.py --proxy{RESET}")
    print(f"{BOLD}{CYAN}======================================================{RESET}\n")

    logger.file_handle.write(f"[{get_timestamp()}] --- CLIENT LISTENER STARTED: {url} ---\n")

    while True:
        try:
            print(f"{DIM}[{get_timestamp()}] Connecting to {url} ...{RESET}")
            async with websockets.connect(url) as ws:
                ts_conn = get_timestamp()
                print(f"{GREEN}[{ts_conn}] ✓ Connected to WebSocket server! Listening for frames...{RESET}\n")
                logger.file_handle.write(f"[{ts_conn}] CONNECTED TO SERVER\n")

                async for raw_message in ws:
                    raw_str = raw_message if isinstance(raw_message, str) else raw_message.decode("utf-8", errors="replace")
                    logger.log_line("SERVER ──► LISTENER", GREEN, raw_str, dir_tag="IN")

        except (websockets.exceptions.ConnectionClosed, ConnectionRefusedError, OSError) as e:
            ts_err = get_timestamp()
            print(f"{YELLOW}[{ts_err}] Connection dropped or server not running: {e}. Retrying in 2s...{RESET}")
            logger.file_handle.write(f"[{ts_err}] DISCONNECTED: {e}\n")
            await asyncio.sleep(2)
        except asyncio.CancelledError:
            break
        except Exception as e:
            ts_err = get_timestamp()
            print(f"{RED}[{ts_err}] Unexpected error: {e}. Retrying in 2s...{RESET}")
            logger.file_handle.write(f"[{ts_err}] ERROR: {e}\n")
            await asyncio.sleep(2)


# ═════════════════════════════════════════════════════════════════════════════
# MODE 2: Bidirectional Sniffer / Proxy (HMI ──► Server & Server ──► HMI)
# ═════════════════════════════════════════════════════════════════════════════
async def run_proxy_mode(listen_port: int, target_url: str, logger: BaseLogger):
    import websockets

    print(f"\n{BOLD}{MAGENTA}======================================================{RESET}")
    print(f"{BOLD}  WebSocket Bidirectional Sniffer / Proxy Mode{RESET}")
    print(f"  • HMI Connects to    : {GREEN}ws://localhost:{listen_port}/ws{RESET} (UNCHANGED)")
    print(f"  • Forwards to Server : {CYAN}{target_url}{RESET}")
    print(f"  • Log File           : {YELLOW}{logger.log_file_path}{RESET}")
    print(f"  • Captures           : {BOLD}100% of traffic in BOTH directions!{RESET}")
    print(f"                         {BLUE}[HMI ──► SERVER]{RESET} & {GREEN}[SERVER ──► HMI]{RESET}")
    print(f"{BOLD}{MAGENTA}======================================================{RESET}\n")

    logger.file_handle.write(f"[{get_timestamp()}] --- BIDIRECTIONAL PROXY STARTED: {listen_port} -> {target_url} ---\n")

    async def forward_stream(source_ws, dest_ws, direction_label: str, dir_color: str, dir_tag: str):
        try:
            async for raw_message in source_ws:
                raw_str = raw_message if isinstance(raw_message, str) else raw_message.decode("utf-8", errors="replace")
                logger.log_line(direction_label, dir_color, raw_str, dir_tag=dir_tag)
                await dest_ws.send(raw_message)
        except (websockets.exceptions.ConnectionClosed, asyncio.CancelledError):
            pass

    async def proxy_handler(client_ws):
        client_addr = client_ws.remote_address
        print(f"{DIM}[{get_timestamp()}] Client connected from {client_addr}{RESET}")
        try:
            async with websockets.connect(target_url) as server_ws:
                task_client_to_server = asyncio.create_task(
                    forward_stream(client_ws, server_ws, "HMI ──► SERVER", BLUE + BOLD, "OUT")
                )
                task_server_to_client = asyncio.create_task(
                    forward_stream(server_ws, client_ws, "SERVER ──► HMI", GREEN + BOLD, "IN")
                )
                done, pending = await asyncio.wait(
                    [task_client_to_server, task_server_to_client],
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for task in pending:
                    task.cancel()
        except Exception as e:
            print(f"{RED}[{get_timestamp()}] Could not connect to target server at {target_url}: {e}{RESET}")
        finally:
            print(f"{DIM}[{get_timestamp()}] Client disconnected {client_addr}{RESET}")

    async with websockets.serve(proxy_handler, "0.0.0.0", listen_port):
        print(f"{GREEN}[{get_timestamp()}] ✓ Sniffer listening on port {listen_port}. Ready for HMI connections...{RESET}\n")
        await asyncio.Future()  # run forever


def parse_args():
    parser = argparse.ArgumentParser(
        description="WebSocket Listener & Bidirectional Monitor for MO Cobot."
    )
    parser.add_argument(
        "target",
        nargs="?",
        default=None,
        help="Optional port number (e.g. 8080) or full WebSocket URL (e.g. ws://localhost:8080/ws)"
    )
    parser.add_argument(
        "--url", "-u",
        default=None,
        help="Full WebSocket URL to connect to in client mode (default: ws://localhost:8080/ws)"
    )
    parser.add_argument(
        "--proxy", "-p",
        action="store_true",
        help="Run in bidirectional proxy mode (captures both HMI->Server and Server->HMI)"
    )
    parser.add_argument(
        "--listen-port",
        type=int,
        default=8080,
        help="Port for the proxy to listen on for HMI connections (default: 8080)"
    )
    parser.add_argument(
        "--target-url",
        default="ws://localhost:8081/ws",
        help="Upstream server URL to forward to in proxy mode (default: ws://localhost:8081/ws)"
    )
    parser.add_argument(
        "--file", "-f",
        default="ws_traffic.log",
        help="Path to output log file (default: ws_traffic.log)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print full pretty-printed JSON payloads to terminal"
    )
    return parser.parse_args()


def main():
    args = parse_args()
    log_path = os.path.abspath(args.file)
    logger = BaseLogger(log_file_path=log_path, verbose=args.verbose)

    try:
        if args.proxy:
            # Mode 2: Bidirectional Sniffer / Proxy
            asyncio.run(run_proxy_mode(args.listen_port, args.target_url, logger))
        else:
            # Mode 1: Passive Client Listener
            target_url = "ws://localhost:8080/ws"
            if args.url:
                target_url = args.url
            elif args.target:
                if args.target.isdigit():
                    target_url = f"ws://localhost:{args.target}/ws"
                elif args.target.startswith("ws://") or args.target.startswith("wss://"):
                    target_url = args.target
                else:
                    target_url = f"ws://{args.target}/ws"

            asyncio.run(run_client_mode(target_url, logger))
    except KeyboardInterrupt:
        print(f"\n{YELLOW}[{get_timestamp()}] Monitor stopped by user.{RESET}")
    finally:
        logger.close()


if __name__ == "__main__":
    main()
