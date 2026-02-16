from __future__ import annotations

import re
from typing import Optional


_TAG_RE = re.compile(r"<[^>]+>")


def strip_tags(value: Optional[str]) -> Optional[str]:
    """Remove HTML tags from a string value."""
    if value is None:
        return None
    return _TAG_RE.sub("", value)
