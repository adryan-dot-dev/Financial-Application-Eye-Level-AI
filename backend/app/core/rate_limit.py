from __future__ import annotations

import types
from typing import Any, Callable

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# Store the original limiter.limit method
_original_limit = limiter.limit


def _patched_limit(*args: Any, **kwargs: Any) -> Callable:
    """Wrap limiter.limit to fix __globals__ for 'from __future__ import annotations'.

    slowapi's decorator uses functools.wraps which copies __module__ and __qualname__
    but NOT __globals__. With 'from __future__ import annotations', FastAPI resolves
    string annotations via func.__globals__. Since the wrapper's __globals__ points to
    slowapi.extension (not the original module), type resolution fails and Pydantic
    models get treated as query params instead of body params.

    This patch rebuilds the wrapper function with merged __globals__ so both slowapi's
    internal references (Response, Request, etc.) and the original module's types
    (UserLogin, UserRegister, etc.) are available.
    """
    original_decorator = _original_limit(*args, **kwargs)

    def fixed_decorator(func: Callable) -> Callable:
        wrapped = original_decorator(func)
        # Merge globals: start with slowapi's globals (needed for its wrapper code),
        # then overlay the original function's globals (needed for type resolution)
        merged_globals = dict(wrapped.__globals__)
        merged_globals.update(func.__globals__)
        fixed = types.FunctionType(
            wrapped.__code__,
            merged_globals,
            wrapped.__name__,
            wrapped.__defaults__,
            wrapped.__closure__,
        )
        fixed.__wrapped__ = func
        fixed.__module__ = func.__module__
        fixed.__qualname__ = func.__qualname__
        fixed.__annotations__ = func.__annotations__
        fixed.__dict__.update(wrapped.__dict__)
        return fixed

    return fixed_decorator


limiter.limit = _patched_limit  # type: ignore[assignment]
