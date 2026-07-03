"""
Video subtitle microservice.

Adds subtitle (telop) text to a video and uploads the result to GCS.
RequestDoc golden template compliant.
"""

import sys
from flask import Flask, request, g
from flask_cors import CORS
from dotenv import load_dotenv

try:
    load_dotenv()
    print("✅ dotenv loaded")
except Exception as exc:
    print(f"⚠️ dotenv load failed: {str(exc)}")

try:
    from localPackages.common.context import context
    from localPackages.common.logger import logger
    from localPackages.common.response_formatter import ResponseFormatter
    from localPackages.common import gcs_storage
    from localPackages.common import firestore_client
    from endpoints.add_subtitles.execute import handle as add_subtitles_execute
    from endpoints.health import execute as health_execute
    logger.start_operation("Application initialization")
except Exception as exc:
    print(f"❌ Local packages initialization error: {str(exc)}")
    sys.exit(1)

app = Flask(__name__)

CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

app_context = context
service_info = app_context.get_service_info()
logger.configuration_loaded("Service info", service_info)

try:
    logger.start_operation("API client initialization")

    PROJECT_ID = app_context.google_cloud_project
    if not PROJECT_ID:
        raise ValueError("GOOGLE_CLOUD_PROJECT is not set")

    logger.info(f"🌐 Project ID: {PROJECT_ID}")

    gcs_storage.initialize_storage_client()
    firestore_client.initialize_firestore_client()

    logger.success("API client initialized")
    logger.complete_operation("API client initialization")
except Exception as exc:
    logger.error("API client initialization failed", error=exc)
    sys.exit(1)


@app.before_request
def before_request():
    """Request pre-processing."""
    if request.method == "OPTIONS":
        return

    if request.method == "GET":
        return

    if request.path == "/add-subtitles" and request.method == "POST":
        logger.info("🔍 Request body debug:")
        logger.info(f"  - Content-Type: {request.headers.get('Content-Type', 'Not set')}")
        logger.info(f"  - Content-Length: {request.headers.get('Content-Length', 'Not set')}")
        logger.info(f"  - Request data length: {len(request.get_data())}")
        logger.info(f"  - Request data (first 500 chars): {request.get_data(as_text=True)[:500]}")

        request_data = request.get_json() or {}
        logger.info("🔍 Parsed request_data:")
        logger.info(f"  - Keys: {list(request_data.keys()) if isinstance(request_data, dict) else 'Not a dict'}")
        logger.info(f"  - Has request_id: {'request_id' in request_data if isinstance(request_data, dict) else False}")
        logger.info(f"  - Has input: {'input' in request_data if isinstance(request_data, dict) else False}")
        logger.info(f"  - Has systemMetadata: {'systemMetadata' in request_data if isinstance(request_data, dict) else False}")

        if "request_id" not in request_data:
            logger.error("❌ request_id is missing")
            return ResponseFormatter.error(
                message="request_id is required",
                status_code=400,
                error_type="ValidationError"
            )

        if "input" not in request_data:
            logger.error("❌ input object is missing")
            return ResponseFormatter.error(
                message="input object is required",
                status_code=400,
                request_id=request_data.get("request_id"),
                error_type="ValidationError"
            )

        if "systemMetadata" not in request_data:
            logger.error("❌ systemMetadata object is missing")
            return ResponseFormatter.error(
                message="systemMetadata object is required",
                status_code=400,
                request_id=request_data.get("request_id"),
                error_type="ValidationError"
            )

    ctx = app_context.create_request_context(request=request)
    g.request_context = ctx
    g.request_id = ctx.request_id

    logger.info(f"📝 Request started: {ctx.request_id} [{request.method} {request.path}]")

    if app_context.debug_mode:
        logger.debug(f"Request body: {request.get_json()}")


@app.route("/add-subtitles", methods=["POST"])
def add_subtitles():
    """POST /add-subtitles - add subtitles to a video."""
    try:
        return add_subtitles_execute(request)
    except Exception as exc:
        logger.error(f"❌ /add-subtitles error: {str(exc)}", error=exc)
        return ResponseFormatter.error(
            message=f"Add subtitles failed: {str(exc)}",
            status_code=500,
            request_id=g.get("request_id", "unknown")
        )


@app.route("/health", methods=["GET"])
def health():
    """GET /health - health check."""
    try:
        return health_execute.handle()
    except Exception as exc:
        logger.error(f"❌ /health error: {str(exc)}", error=exc)
        return ResponseFormatter.error(
            message=f"Health check failed: {str(exc)}",
            status_code=500
        )


if __name__ == "__main__":
    port = int(app_context.port) if hasattr(app_context, "port") else 8080
    logger.info(f"🚀 Service starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
