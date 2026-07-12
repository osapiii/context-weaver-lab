"""Node / Python script を subprocess で叩く共通ラッパー.

ADK の SubAgent / Tool から呼ばれる. すべて同期 (subprocess.run) で、
stdout / stderr / returncode を構造化して返す.
"""
from __future__ import annotations

import os
import shlex
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Sequence

from .. import config


class SubprocessError(RuntimeError):
    """script が non-zero exit した場合に投げる."""

    def __init__(self, cmd: Sequence[str], returncode: int, stdout: str, stderr: str):
        self.cmd = list(cmd)
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr
        super().__init__(
            f"subprocess failed (rc={returncode}): {shlex.join(self.cmd)}\n"
            f"--- stderr ---\n{stderr[:2000]}"
        )


@dataclass
class ScriptResult:
    cmd: list[str]
    returncode: int
    stdout: str
    stderr: str
    cwd: str

    def ok(self) -> bool:
        return self.returncode == 0

    def to_dict(self) -> dict:
        return {
            "cmd": " ".join(shlex.quote(x) for x in self.cmd),
            "returncode": self.returncode,
            "stdout": self.stdout,
            "stderr_tail": self.stderr[-2000:],
            "cwd": self.cwd,
            "ok": self.ok(),
        }


def _run(
    cmd: Sequence[str],
    *,
    cwd: Path,
    env: Optional[dict[str, str]] = None,
    timeout: int = 600,
    check: bool = True,
    stdin_data: Optional[str] = None,
) -> ScriptResult:
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)
    cwd_str = str(cwd)
    proc = subprocess.run(
        list(cmd),
        cwd=cwd_str,
        env=merged_env,
        capture_output=True,
        text=True,
        timeout=timeout,
        input=stdin_data,
    )
    result = ScriptResult(
        cmd=list(cmd),
        returncode=proc.returncode,
        stdout=proc.stdout,
        stderr=proc.stderr,
        cwd=cwd_str,
    )
    if check and not result.ok():
        raise SubprocessError(cmd, proc.returncode, proc.stdout, proc.stderr)
    return result


def run_node_script(
    script_relpath: str,
    args: Sequence[str] = (),
    *,
    cwd: Optional[Path] = None,
    env: Optional[dict[str, str]] = None,
    timeout: int = 600,
    check: bool = True,
    stdin_data: Optional[str] = None,
) -> ScriptResult:
    """skills/enostech-slides 配下の Node スクリプトを呼ぶ.

    `script_relpath` は skill root からの相対パス (例: `scripts/render/build-deck.js`).
    `cwd` を省略すると skill root で実行する (Node の require が解決できるように).
    """
    cwd = cwd or config.SKILL_ROOT
    node_bin = os.environ.get("ENOSTECH_NODE_BIN", "node")
    cmd = [node_bin, str((config.SKILL_ROOT / script_relpath).resolve()), *args]
    return _run(cmd, cwd=cwd, env=env, timeout=timeout, check=check, stdin_data=stdin_data)


def run_python_script(
    script_relpath: str,
    args: Sequence[str] = (),
    *,
    cwd: Optional[Path] = None,
    env: Optional[dict[str, str]] = None,
    timeout: int = 600,
    check: bool = True,
    stdin_data: Optional[str] = None,
) -> ScriptResult:
    """skills/enostech-slides 配下の Python スクリプトを呼ぶ.

    sys.executable を使うので、ADK が動いている Python と同じインタプリタで走る.
    """
    cwd = cwd or config.SKILL_ROOT
    cmd = [sys.executable, str((config.SKILL_ROOT / script_relpath).resolve()), *args]
    return _run(cmd, cwd=cwd, env=env, timeout=timeout, check=check, stdin_data=stdin_data)


def run_shell(
    cmd: Sequence[str],
    *,
    cwd: Optional[Path] = None,
    env: Optional[dict[str, str]] = None,
    timeout: int = 600,
    check: bool = True,
) -> ScriptResult:
    """任意のコマンドを実行する (pptx-to-images.sh のような shell script 用)."""
    cwd = cwd or config.SKILL_ROOT
    return _run(cmd, cwd=cwd, env=env, timeout=timeout, check=check)
