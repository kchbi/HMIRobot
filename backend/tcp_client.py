"""
Async TCP Client — Manages the raw TCP connection to the robot controller.
Provides connect/disconnect/send/receive with auto-reconnect logic.
All communication goes through command_protocol.py for encoding/decoding.
"""
import asyncio
import logging
from typing import Optional, Callable, Awaitable
from command_protocol import build_command, parse_response, GET_STATUS
logger = logging.getLogger("tcp_client")
class RobotTCPClient:
    """Async TCP client for robot communication with auto-reconnect."""
    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 9999,
        on_status_update: Optional[Callable[[dict], Awaitable[None]]] = None,
    ):
        self.host = host
        self.port = port
        self.on_status_update = on_status_update
        self._reader: Optional[asyncio.StreamReader] = None
        self._writer: Optional[asyncio.StreamWriter] = None
        self._connected = False
        self._reconnecting = False
        self._lock = asyncio.Lock()
        self._poll_task: Optional[asyncio.Task] = None
        self._max_retries = 5
        self._retry_delay = 2.0  # seconds
    @property
    def connected(self) -> bool:
        return self._connected
    @property
    def config(self) -> dict:
        return {"host": self.host, "port": self.port, "connected": self._connected}
    def update_config(self, host: str, port: int):
        """Update TCP connection parameters (requires reconnect)."""
        self.host = host
        self.port = port
        logger.info(f"TCP config updated: {host}:{port}")
    async def connect(self) -> bool:
        """Establish TCP connection to the robot."""
        async with self._lock:
            if self._connected:
                return True
            try:
                self._reader, self._writer = await asyncio.wait_for(
                    asyncio.open_connection(self.host, self.port),
                    timeout=5.0,
                )
                self._connected = True
                logger.info(f"Connected to robot at {self.host}:{self.port}")
                # Start polling for status
                if self._poll_task is None or self._poll_task.done():
                    self._poll_task = asyncio.create_task(self._status_poll_loop())
                return True
            except (ConnectionRefusedError, OSError, asyncio.TimeoutError) as e:
                logger.warning(f"Failed to connect to {self.host}:{self.port}: {e}")
                self._connected = False
                return False
    async def disconnect(self):
        """Close the TCP connection."""
        async with self._lock:
            if self._poll_task and not self._poll_task.done():
                self._poll_task.cancel()
                try:
                    await self._poll_task
                except asyncio.CancelledError:
                    pass
            if self._writer:
                try:
                    self._writer.close()
                    await self._writer.wait_closed()
                except Exception:
                    pass
            self._reader = None
            self._writer = None
            self._connected = False
            logger.info("Disconnected from robot")
    async def send_command(self, action: str, **params) -> dict:
        """
        Send a command to the robot and return the response.
        Args:
            action: Command action string (from command_protocol constants).
            **params: Additional parameters for the command.
        Returns:
            dict: Parsed response from the robot.
        """
        if not self._connected:
            # Try to connect first
            connected = await self.connect()
            if not connected:
                return {
                    "status": "error",
                    "message": f"Not connected to robot at {self.host}:{self.port}",
                }
        try:
            payload = build_command(action, **params)

            async with self._lock:
                if self._writer is None or self._reader is None:
                    return {
                        "status": "error",
                        "message": "Not connected to robot"
                    }

                self._writer.write(payload)
                await self._writer.drain()

                # Read response (newline-delimited)
                response_data = await asyncio.wait_for(
                    self._reader.readline(),
                    timeout=10.0,
                )
            if not response_data:
                await self._handle_disconnect()
                return {"status": "error", "message": "Connection closed by robot"}
            result = parse_response(response_data)
            logger.debug(f"Command {action} → {result.get('status', 'unknown')}")
            return result
        except asyncio.TimeoutError:
            logger.warning(f"Timeout waiting for response to {action}")
            return {"status": "error", "message": "Response timeout"}
        except (ConnectionResetError, BrokenPipeError, OSError) as e:
            logger.error(f"Connection error during {action}: {e}")
            await self._handle_disconnect()
            return {"status": "error", "message": f"Connection lost: {e}"}
    async def _handle_disconnect(self):
        """Handle unexpected disconnection."""
        self._connected = False
        if self._writer:
            try:
                self._writer.close()
            except Exception:
                pass
        self._reader = None
        self._writer = None
        logger.warning("Connection to robot lost")
    async def _status_poll_loop(self):
        """Background loop that polls robot status periodically."""
        while self._connected:
            try:
                await asyncio.sleep(1.0)  # Poll every second
                if not self._connected:
                    break
                result = await self.send_command(GET_STATUS)
                if self.on_status_update and result.get("status") != "error":
                    await self.on_status_update(result)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Status poll error: {e}")
                await asyncio.sleep(3.0)
    async def reconnect(self) -> bool:
        """Attempt to reconnect with exponential backoff."""
        if self._reconnecting:
            return False
        self._reconnecting = True
        await self.disconnect()
        for attempt in range(1, self._max_retries + 1):
            delay = self._retry_delay * (2 ** (attempt - 1))
            logger.info(f"Reconnect attempt {attempt}/{self._max_retries} in {delay}s")
            await asyncio.sleep(delay)
            if await self.connect():
                self._reconnecting = False
                return True
        self._reconnecting = False
        logger.error("All reconnection attempts failed")
        return False
