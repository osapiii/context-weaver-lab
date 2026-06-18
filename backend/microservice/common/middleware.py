"""
Shared middleware for Cloud Run FastAPI services.

Minimal implementation for request tracking without redundant logging.
"""

import uuid
import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Lightweight middleware to add request_id to request state.

    This is a MINIMAL implementation:
    - Generates UUID for request tracking
    - Stores in request.state (for exception handlers)
    - Adds X-Request-ID response header

    NOT included (use endpoint handlers instead):
    - Body reading (causes double-read issues)
    - Request/response logging (endpoints handle this)
    - CloudRun logging (endpoints use proper Logger class)
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Generate unique request ID
        request_id = str(uuid.uuid4())

        # Store in request state for exception handlers
        request.state.request_id = request_id

        # Process request
        response = await call_next(request)

        # Add X-Request-ID header to response
        response.headers["X-Request-ID"] = request_id

        return response
