from __future__ import annotations

import difflib
from typing import Any

from nova.node.tools.local_model import generate


def run(task: dict[str, Any]) -> dict[str, Any]:
    instruction = str(task.get("instruction") or "")
    current_code = str(task.get("current_code") or "")
    file_path = str(task.get("file_path") or "unknown")

    prompt = f"""
You are a constitutional coding tool.
Apply the following instruction to the provided code.

Instruction:
{instruction}

Current Code:
{current_code}

Return ONLY the updated code.
"""

    updated_code = generate(
        prompt,
        model=str(task.get("model") or "qwen2.5-coder:3b"),
        temperature=0.15,
    )
    diff_lines = difflib.unified_diff(
        current_code.splitlines(),
        updated_code.splitlines(),
        fromfile=f"{file_path} (original)",
        tofile=f"{file_path} (updated)",
        lineterm="",
    )

    return {
        "updated_code": updated_code,
        "diff": "\n".join(diff_lines),
        "file_path": file_path,
        "receipts": ["coder_tool"],
    }
