#!/usr/bin/env python3
"""
Trovi Full-Stack Development Orchestrator
Launches the FastAPI backend and Vite frontend concurrently,
verifies that /api/health is responsive before opening the frontend,
and cleanly manages process lifetimes on exit.
"""

import os
import sys
import time
import signal
import urllib.request
import urllib.error
import json
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
FRONTEND_DIR = REPO_ROOT / "frontend"
HEALTH_URL = "http://127.0.0.1:8000/api/health"


def check_backend_health():
    """Attempt an HTTP GET to /api/health."""
    try:
        req = urllib.request.Request(HEALTH_URL, headers={"User-Agent": "Trovi-DevAll/1.0"})
        with urllib.request.urlopen(req, timeout=1.5) as response:
            if response.status == 200:
                body = response.read().decode("utf-8")
                return True, json.loads(body)
    except Exception as exc:
        return False, str(exc)
    return False, "Unknown status"


def main():
    print("=" * 60)
    print("  Trovi Full-Stack Development Launcher")
    print("=" * 60)

    # 1. Check if backend is already running
    is_running, info = check_backend_health()
    backend_proc = None

    if is_running:
        print(f"[*] FastAPI backend already running on port 8000 (Env: {info.get('environment', 'unknown')})")
    else:
        print("[*] Starting FastAPI backend via backend/main.py...")
        backend_cmd = [sys.executable, str(BACKEND_DIR / "main.py")]
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=str(REPO_ROOT),
            stdout=sys.stdout,
            stderr=sys.stderr,
        )

        print("[*] Waiting for backend /api/health to become available...")
        healthy = False
        for attempt in range(1, 31):
            time.sleep(1)
            is_running, info = check_backend_health()
            if is_running:
                healthy = True
                print(f"[+] Backend is ready! Health: {info}")
                break
            sys.stdout.write(f"\r    Attempt {attempt}/30 - waiting...")
            sys.stdout.flush()

        print()
        if not healthy:
            print("[!] Timed out waiting for backend to start.")
            if backend_proc:
                backend_proc.terminate()
            sys.exit(1)

    # 2. Start frontend dev server
    print("[*] Starting Vite frontend server in frontend/...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=str(FRONTEND_DIR),
        stdout=sys.stdout,
        stderr=sys.stderr,
    )

    def cleanup(signum=None, frame=None):
        print("\n[*] Shutting down dev servers...")
        if frontend_proc:
            frontend_proc.terminate()
        if backend_proc:
            backend_proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    try:
        # Wait for frontend process
        frontend_proc.wait()
    except KeyboardInterrupt:
        cleanup()


if __name__ == "__main__":
    main()
