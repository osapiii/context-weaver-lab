"""
SaaS Onboarding Request Trigger (God Mode)

新規 Org / Space / Auth User / FileSpace を一括プロビジョニングする。
操作者が中村海産組織 (organization code: NAKAMURA) に所属する場合のみ実行可能。
"""

from __future__ import annotations

import re
import secrets
from datetime import datetime

from firebase_admin import auth, get_app, initialize_app
from firebase_functions import firestore_fn
from google.cloud import firestore

GOD_MODE_ORGANIZATION_CODE = "NAKAMURA"

try:
    get_app()
except ValueError:
    initialize_app()
db = firestore.Client()


def _append_log(collection_path: str, doc_id: str, message: str, log_type: str = "info") -> None:
    doc_ref = db.collection(collection_path).document(doc_id)
    doc_ref.update({
        "logs": firestore.ArrayUnion([{
            "timestamp": datetime.utcnow(),
            "message": message,
            "type": log_type,
        }]),
        "updatedAt": datetime.utcnow(),
    })


def _update_status(
    collection_path: str,
    doc_id: str,
    status: str,
    *,
    output: dict | None = None,
    error_message: str | None = None,
) -> None:
    data: dict = {
        "status": status,
        "updatedAt": datetime.utcnow(),
    }
    if output is not None:
        data["output"] = output
    if error_message is not None:
        data["errorMessage"] = error_message
    db.collection(collection_path).document(doc_id).update(data)


def _get_organization_code(organization_id: str) -> str:
    doc = db.collection("organizations").document(organization_id).get()
    if not doc.exists:
        return ""
    return (doc.to_dict() or {}).get("code", "").strip().upper()


def _org_code_exists(code: str) -> bool:
    docs = (
        db.collection("organizations")
        .where("code", "==", code)
        .limit(1)
        .stream()
    )
    return any(True for _ in docs)


def _create_file_space_request(
    organization_id: str,
    space_id: str,
    operator_user_id: str,
    operator_email: str,
) -> str:
    request_id = f"fileSpace_fileSpaceCreate_{int(datetime.utcnow().timestamp() * 1000)}_{secrets.token_hex(4)}"
    collection_path = (
        f"organizations/{organization_id}/spaces/{space_id}/"
        f"requests/geminiFileSpaceRequests/logs"
    )
    now = datetime.utcnow()
    doc_data = {
        "input": {
            "operationType": "fileSpaceCreate",
            "displayName": "default",
            "description": "Organization の統合素材プール (Godモード auto-created)",
            "fileSpaceType": "system",
        },
        "operationMetadata": {
            "organizationId": organization_id,
            "spaceId": space_id,
            "loggingCollectionId": "requests/geminiFileSpaceRequests/logs",
            "loggingDocumentId": request_id,
            "requestedBy": {
                "userId": operator_user_id,
                "email": operator_email,
                "role": 1,
            },
            "isCommand": True,
            "isOouiCrud": True,
            "isLlmCall": False,
            "isAdminCrud": True,
        },
        "status": "pending",
        "logs": [],
        "createdAt": now,
        "updatedAt": now,
    }
    db.collection(collection_path).document(request_id).set(doc_data)
    return request_id


@firestore_fn.on_document_created(
    document="organizations/{organizationId}/requests/saasOnboarding/logs/{requestId}",
    memory=1024,
    timeout_sec=540,
)
def on_saas_onboarding_request_created(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    print("on_saas_onboarding_request_created triggered 🚀")

    if event.data is None:
        print("ERROR: event.data is None")
        return

    fields = event.data.to_dict() or {}
    request_id = event.data.id
    operator_organization_id = event.params.get("organizationId", "")
    collection_path = (
        f"organizations/{operator_organization_id}/requests/saasOnboarding/logs"
    )

    try:
        operation_metadata = fields.get("operationMetadata") or {}
        requested_by = operation_metadata.get("requestedBy") or {}
        operator_email = requested_by.get("email", "")

        operator_org_code = _get_organization_code(operator_organization_id)
        if operator_org_code != GOD_MODE_ORGANIZATION_CODE:
            msg = (
                f"Godモード権限がありません: "
                f"org={operator_org_code or operator_organization_id}"
            )
            print(f"ERROR: {msg}")
            _update_status(collection_path, request_id, "error", error_message=msg)
            _append_log(collection_path, request_id, msg, "error")
            return

        input_data = fields.get("input") or {}
        email = input_data.get("email", "").strip()
        organization_name = input_data.get("organizationName", "").strip()
        organization_code = input_data.get("organizationCode", "").strip().upper()
        space_name = input_data.get("spaceName", "メイン").strip() or "メイン"
        rbac_role = int(input_data.get("rbacRole", 2))

        if not email or not organization_name or not organization_code:
            msg = "必須フィールドが不足しています"
            _update_status(collection_path, request_id, "error", error_message=msg)
            _append_log(collection_path, request_id, msg, "error")
            return

        if not re.match(r"^[A-Za-z0-9_-]+$", organization_code):
            msg = "組織コードの形式が不正です"
            _update_status(collection_path, request_id, "error", error_message=msg)
            _append_log(collection_path, request_id, msg, "error")
            return

        _update_status(collection_path, request_id, "processing")
        _append_log(collection_path, request_id, "オンボーディング処理を開始しました")

        if _org_code_exists(organization_code):
            msg = f"組織コード '{organization_code}' は既に使用されています"
            _update_status(collection_path, request_id, "error", error_message=msg)
            _append_log(collection_path, request_id, msg, "error")
            return

        # 1. Organization 作成
        org_ref = db.collection("organizations").document()
        org_id = org_ref.id
        now = datetime.utcnow()
        org_ref.set({
            "name": organization_name,
            "code": organization_code,
            "createdAt": now,
            "updatedAt": now,
        })
        _append_log(
            collection_path,
            request_id,
            f"組織を作成しました: {organization_name} ({organization_code})",
        )

        # 2. Space 作成
        space_ref = db.collection(f"organizations/{org_id}/spaces").document()
        space_id = space_ref.id
        operator_user_id = requested_by.get("userId", "system")
        space_ref.set({
            "name": space_name,
            "description": "Godモードで自動作成された初期 Space",
            "organizationId": org_id,
            "createdBy": operator_user_id,
            "isDefault": True,
            "createdAt": now,
            "updatedAt": now,
        })
        _append_log(
            collection_path,
            request_id,
            f"Space を作成しました: {space_name}",
        )

        # 3. Firebase Auth ユーザー作成
        try:
            user_record = auth.create_user(
                email=email,
                email_verified=False,
                disabled=False,
            )
        except auth.EmailAlreadyExistsError:
            msg = f"メールアドレス '{email}' は既に登録されています"
            _update_status(collection_path, request_id, "error", error_message=msg)
            _append_log(collection_path, request_id, msg, "error")
            return

        user_id = user_record.uid
        space_ids = [space_id] if rbac_role == 3 else []
        claims = {
            "rbacRole": rbac_role,
            "organizationId": org_id,
            "organizationCode": organization_code,
            "spaceIds": space_ids,
        }
        auth.set_custom_user_claims(user_id, claims)
        _append_log(
            collection_path,
            request_id,
            f"Firebase Auth ユーザーを作成しました: {email}",
        )

        # 4. adminUsers ドキュメント作成
        db.collection(f"organizations/{org_id}/adminUsers").document(user_id).set({
            "email": email,
            "role": str(rbac_role),
            "organizationId": org_id,
            "createdAt": now,
            "updatedAt": now,
        })
        _append_log(collection_path, request_id, "adminUsers ドキュメントを作成しました")

        # 5. FileSpace 作成リクエスト発行 (既存 trigger が処理)
        file_space_request_id = _create_file_space_request(
            org_id,
            space_id,
            operator_user_id,
            operator_email,
        )
        _append_log(
            collection_path,
            request_id,
            f"FileSpace 作成リクエストを発行しました: {file_space_request_id}",
        )

        output = {
            "organizationId": org_id,
            "organizationCode": organization_code,
            "spaceId": space_id,
            "userId": user_id,
            "fileSpaceRequestId": file_space_request_id,
        }
        _update_status(collection_path, request_id, "completed", output=output)
        _append_log(
            collection_path,
            request_id,
            "✅ SaaS オンボーディングが完了しました",
        )
        print(f"on_saas_onboarding_request_created completed ✅ org={org_id} user={user_id}")

    except Exception as exc:
        msg = f"オンボーディング処理中にエラーが発生しました: {exc}"
        print(f"ERROR: {msg}")
        _update_status(collection_path, request_id, "error", error_message=msg)
        _append_log(collection_path, request_id, msg, "error")
