"""
Quick test script — connects to the FastAPI WebSocket and sends commands
matching the new bolt_cli.py-compatible protocol.
"""
import asyncio
import json
import websockets

async def recv_expected(ws, expected_type, timeout=5):
    """Receive messages until we get one with the expected type, skipping logs/status."""
    deadline = asyncio.get_event_loop().time() + timeout
    while True:
        remaining = deadline - asyncio.get_event_loop().time()
        if remaining <= 0:
            raise asyncio.TimeoutError(f"Timed out waiting for {expected_type!r}")
        raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
        msg = json.loads(raw)
        if msg.get('type') == expected_type:
            return msg
        # Skip log, update_state, etc.

async def test():
    uri = "ws://localhost:8001/ws"
    print(f"Connecting to {uri}...")
    
    async with websockets.connect(uri) as ws:
        # Read initial messages (status, connection, log_history)
        for _ in range(10):
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=2)
                msg = json.loads(raw)
                print(f"  ← INIT: type={msg.get('type')!r}")
                if msg.get('type') == 'update_state':
                    print(f"          status fields: {list(msg.get('data', {}).keys())}")
                    print("  ✓ PASS: update_state received (was status_update before)")
            except asyncio.TimeoutError:
                break

        # Test 1: load_app
        print("\n--- Test 1: load_app ---")
        cmd = {"type": "load_app", "data": {"app_name": "TopPlateBolt"}}
        print(f"  → SEND: {json.dumps(cmd)}")
        await ws.send(json.dumps(cmd))
        msg = await recv_expected(ws, 'load_app')
        print(f"  ← RECV: {json.dumps(msg)}")
        print("  ✓ PASS: load_app acknowledged")

        # Test 2: initialize
        print("\n--- Test 2: initialize ---")
        cmd = {"type": "initialize"}
        print(f"  → SEND: {json.dumps(cmd)}")
        await ws.send(json.dumps(cmd))
        msg = await recv_expected(ws, 'command_received')
        print(f"  ← RECV: {json.dumps(msg)}")
        print("  ✓ PASS: initialize → command_received")

        # Test 3: bolt_config
        print("\n--- Test 3: bolt_config ---")
        cmd = {"type": "bolt_config", "data": {"boltNum": 1, "torqueNum": 1}}
        print(f"  → SEND: {json.dumps(cmd)}")
        await ws.send(json.dumps(cmd))
        msg = await recv_expected(ws, 'command_received')
        print(f"  ← RECV: {json.dumps(msg)}")
        assert 'boltNum' in msg.get('data', {}).get('message', '') or 'bolt' in msg.get('data', {}).get('message', '').lower(), "Should mention bolt config"
        print("  ✓ PASS: bolt_config → command_received with bolt info")

        # Test 4: start
        print("\n--- Test 4: start ---")
        cmd = {"type": "start"}
        print(f"  → SEND: {json.dumps(cmd)}")
        await ws.send(json.dumps(cmd))
        msg = await recv_expected(ws, 'command_received')
        print(f"  ← RECV: {json.dumps(msg)}")
        print("  ✓ PASS: start → command_received")

        # Test 5: stow
        print("\n--- Test 5: stow ---")
        cmd = {"type": "stow"}
        print(f"  → SEND: {json.dumps(cmd)}")
        await ws.send(json.dumps(cmd))
        msg = await recv_expected(ws, 'command_received')
        print(f"  ← RECV: {json.dumps(msg)}")
        print("  ✓ PASS: stow → command_received")

        # Test 6: get_status
        print("\n--- Test 6: get_status ---")
        cmd = {"type": "get_status"}
        print(f"  → SEND: {json.dumps(cmd)}")
        await ws.send(json.dumps(cmd))
        msg = await recv_expected(ws, 'command_received')
        print(f"  ← RECV: type='command_received', status={msg.get('data',{}).get('status')}")
        print("  ✓ PASS: get_status → command_received")

        # Test 7: move_x
        print("\n--- Test 7: move_x ---")
        cmd = {"type": "move_x", "data": {"value": 1.0}}
        print(f"  → SEND: {json.dumps(cmd)}")
        await ws.send(json.dumps(cmd))
        msg = await recv_expected(ws, 'command_received')
        print(f"  ← RECV: type='command_received', status={msg.get('data',{}).get('status')}")
        print("  ✓ PASS: move_x → command_received")

    print("\n═══════════════════════════════")
    print("  ALL 7 TESTS PASSED ✓")
    print("═══════════════════════════════")

asyncio.run(test())
