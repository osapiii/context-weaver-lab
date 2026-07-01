"""Silence trimming microservice for Vohance video outputs."""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from endpoints.trim_silence.execute import handle as trim_silence_execute


load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})


@app.route("/trim-silence", methods=["POST", "OPTIONS"])
def trim_silence():
    if request.method == "OPTIONS":
        return ("", 204)
    return trim_silence_execute(request)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "vohance-trim-silence-video"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    print(f"Starting vohance-trim-silence-video on port {port}", file=sys.stderr)
    app.run(host="0.0.0.0", port=port, debug=False)
