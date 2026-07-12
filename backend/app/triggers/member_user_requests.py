"""
Organization member management (create / update / delete) via RequestDoc.

Firebase Admin SDK で Auth ユーザーと Custom Claims、adminUsers を同期する。
操作者は rbacRole 1 (Super) または 2 (システム管理者) のみ許可。
"""

from __future__ import annotations

from datetime import datetime

from firebase_admin import auth, get_app, initialize_app
from firebase_functions import firestore_fn
from google.cloud import firestore

try:
    get_app()
except ValueError:
    initialize_app()
db = firestore.Client()

ADMIN_ROLES = {1, 2}


def _append_log(
    collection_path: str,
    doc_id: str,
    message: str,
    log_type: str = "info",
) -> None:
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


def _validate_operator(
    collection_path: str,
    request_id: str,
    operation_metadata: dict,
    organization_id: str,
) -> tuple[bool, str | None]:
    requested_by = operation_metadata.get("requestedBy") or {}
    operator_role = int(requested_by.get("role") or 0)
    operator_user_id = requested_by.get("userId", "")

    if operator_role not in ADMIN_ROLES:
        return False, "メンバー管理の権限がありません (システム管理者以上が必要です)"

    meta_org_id = operation_metadata.get("organizationId", "")
    if meta_org_id and meta_org_id != organization_id:
        return False, "操作対象の組織が一致しません"

    if not operator_user_id:
        return False, "操作者情報が不足しています"

    return True, None


def _get_target_claims(user_id: str) -> dict:
    try:
        user_record = auth.get_user(user_id)
        return user_record.custom_claims or {}
    except auth.UserNotFoundError:
        return {}


def _assert_target_in_org(
    collection_path: str,
    request_id: str,
    organization_id: str,
    user_id: str,
) -> tuple[bool, dict]:
    claims = _get_target_claims(user_id)
    target_org = claims.get("organizationId")
    if target_org != organization_id:
        msg = "対象ユーザーはこの組織に属していません"
        _update_status(collection_path, request_id, "error", error_message=msg)
        _append_log(collection_path, request_id, msg, "error")
        return False, claims
    return True, claims


def _build_claims(
    *,
    rbac_role: int,
    organization_id: str,
    organization_code: str,
    space_ids: list[str],
) -> dict:
    return {
        "rbacRole": rbac_role,
        "organizationId": organization_id,
        "organizationCode": organization_code,
        "spaceIds": space_ids if rbac_role == 3 else [],
    }


def _get_organization_code(organization_id: str) -> str:
    org_doc = db.collection("organizations").document(organization_id).get()
    if not org_doc.exists:
        return ""
    return (org_doc.to_dict() or {}).get("code", "")


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/requests/memberUserCreate/logs/{requestId}"
    ),
    memory=512,
    timeout_sec=120,
)
def on_member_user_create_request_created(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    if event.data is None:
        return

    fields = event.data.to_dict() or {}
    request_id = event.data.id
    organization_id = event.params["organizationId"]
    collection_path = (
        f"organizations/{organization_id}/requests/memberUserCreate/logs"
    )

    operation_metadata = fields.get("operationMetadata") or {}
    ok, err = _validate_operator(
        collection_path, request_id, operation_metadata, organization_id
    )
    if not ok:
        _update_status(collection_path, request_id, "error", error_message=err)
        _append_log(collection_path, request_id, err or "", "error")
        return

    input_data = fields.get("input") or {}
    email = (input_data.get("email") or "").strip()
    rbac_role = int(input_data.get("rbacRole", 3))
    space_ids = list(input_data.get("spaceIds") or [])

    if rbac_role not in (2, 3):
        msg = "発行できるロールはシステム管理者 (2) または利用者 (3) のみです"
        _update_status(collection_path, request_id, "error", error_message=msg)
        _append_log(collection_path, request_id, msg, "error")
        return

    if not email:
        msg = "メールアドレスが必要です"
        _update_status(collection_path, request_id, "error", error_message=msg)
        _append_log(collection_path, request_id, msg, "error")
        return

    if rbac_role == 3 and not space_ids:
        msg = "利用者にはアクセス可能な Space を1つ以上指定してください"
        _update_status(collection_path, request_id, "error", error_message=msg)
        _append_log(collection_path, request_id, msg, "error")
        return

    _update_status(collection_path, request_id, "processing")
    _append_log(collection_path, request_id, "メンバー作成処理を開始しました")

    try:
        org_code = _get_organization_code(organization_id)
        user_record = auth.create_user(
            email=email,
            email_verified=False,
            disabled=False,
        )
        user_id = user_record.uid
        claims = _build_claims(
            rbac_role=rbac_role,
            organization_id=organization_id,
            organization_code=org_code,
            space_ids=space_ids,
        )
        auth.set_custom_user_claims(user_id, claims)

        now = datetime.utcnow()
        db.collection(f"organizations/{organization_id}/adminUsers").document(
            user_id
        ).set({
            "email": email,
            "role": str(rbac_role),
            "organizationId": organization_id,
            "spaceIds": space_ids if rbac_role == 3 else [],
            "createdAt": now,
            "updatedAt": now,
        })

        output = {"userId": user_id, "email": email}
        _update_status(collection_path, request_id, "completed", output=output)
        _append_log(
            collection_path,
            request_id,
            f"メンバーを作成しました: {email}",
        )
    except auth.EmailAlreadyExistsError:
        msg = f"メールアドレス '{email}' は既に登録されています"
        _update_status(collection_path, request_id, "error", error_message=msg)
        _append_log(collection_path, request_id, msg, "error")
    except Exception as exc:
        msg = f"メンバー作成中にエラーが発生しました: {exc}"
        _update_status(collection_path, request_id, "error", error_message=msg)
        _append_log(collection_path, request_id, msg, "error")


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/requests/memberUserUpdate/logs/{requestId}"
    ),
    memory=512,
    timeout_sec=120,
)
def on_member_user_update_request_created(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    if event.data is None:
        return

    fields = event.data.to_dict() or {}
    request_id = event.data.id
    organization_id = event.params["organizationId"]
    collection_path = (
        f"organizations/{organization_id}/requests/memberUserUpdate/logs"
    )

    operation_metadata = fields.get("operationMetadata") or {}
    requested_by = operation_metadata.get("requestedBy") or {}
    operator_user_id = requested_by.get("userId", "")

    ok, err = _validate_operator(
        collection_path, request_id, operation_metadata, organization_id
    )
    if not ok:
        _update_status(collection_path, request_id, "error", error_message=err)
        _append_log(collection_path, request_id, err or "", "error")
        return

    input_data = fields.get("input") or {}
    user_id = (input_data.get("userId") or "").strip()
    new_email = (input_data.get("email") or "").strip()
    rbac_role = int(input_data.get("rbacRole", 3))
    space_ids = list(input_data.get("spaceIds") or [])

    if not user_id:
        msg = "userId が指定されていません"
        _update_status(collection_path, request_id, "error", error_message=msg)
        _append_log(collection_path, request_id, msg, "error")
        return

    if user_id == operator_user_id:
        msg = "自分自身のロールはこの画面から変更できません"
        _update_status(collection_path, request_id, "error", error_message=msg)
        _append_log(collection_path, request_id, msg, "error")
        return

    if rbac_role not in (2, 3):
        msg = "設定できるロールはシステム管理者 (2) または利用者 (3) のみです"
        _update_status(collection_path, request_id, "error", error_message=msg)
        _append_log(collection_path, request_id, msg, "error")
        return

    if rbac_role == 3 and not space_ids:
        msg = "利用者にはアクセス可能な Space を1つ以上指定してください"
        _update_status(collection_path, request_id, "error", error_message=msg)
        _append_log(collection_path, request_id, msg, "error")
        return

    _update_status(collection_path, request_id, "processing")
    _append_log(collection_path, request_id, "メンバー更新処理を開始しました")

    try:
        in_org, claims = _assert_target_in_org(
            collection_path, request_id, organization_id, user_id
        )
        if not in_org:
            return

        target_role = int(claims.get("rbacRole") or 0)
        if target_role == 1:
            msg = "Super ユーザーの変更はできません"
            _update_status(collection_path, request_id, "error", error_message=msg)
            _append_log(collection_path, request_id, msg, "error")
            return

        org_code = _get_organization_code(organization_id)
        new_claims = _build_claims(
            rbac_role=rbac_role,
            organization_id=organization_id,
            organization_code=org_code,
            space_ids=space_ids,
        )
        auth.set_custom_user_claims(user_id, new_claims)

        update_auth: dict = {}
        if new_email:
            update_auth["email"] = new_email
        if update_auth:
            auth.update_user(user_id, **update_auth)

        admin_ref = db.collection(
            f"organizations/{organization_id}/adminUsers"
        ).document(user_id)
        patch: dict = {
            "role": str(rbac_role),
            "spaceIds": space_ids if rbac_role == 3 else [],
            "updatedAt": datetime.utcnow(),
        }
        if new_email:
            patch["email"] = new_email
        admin_ref.set(patch, merge=True)

        output = {"userId": user_id}
        _update_status(collection_path, request_id, "completed", output=output)
        _append_log(collection_path, request_id, "メンバー情報を更新しました")
    except auth.UserNotFoundError:
        msg = "対象ユーザーが Firebase Auth に存在しません"
        _update_status(collection_path, request_id, "error", error_message=msg)
        _append_log(collection_path, request_id, msg, "error")
    except Exception as exc:
        msg = f"メンバー更新中にエラーが発生しました: {exc}"
        _update_status(collection_path, request_id, "error", error_message=msg)
        _append_log(collection_path, request_id, msg, "error")


@firestore_fn.on_document_created(
    document=(
        "organizations/{organizationId}/requests/memberUserDelete/logs/{requestId}"
    ),
    memory=512,
    timeout_sec=120,
)
def on_member_user_delete_request_created(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None],
) -> None:
    if event.data is None:
        return

    fields = event.data.to_dict() or {}
    request_id = event.data.id
    organization_id = event.params["organizationId"]
    collection_path = (
        f"organizations/{organization_id}/requests/memberUserDelete/logs"
    )

    operation_metadata = fields.get("operationMetadata") or {}
    requested_by = operation_metadata.get("requestedBy") or {}
    operator_user_id = requested_by.get("userId", "")

    ok, err = _validate_operator(
        collection_path, request_id, operation_metadata, organization_id
    )
    if not ok:
        _update_status(collection_path, request_id, "error", error_message=err)
        _append_log(collection_path, request_id, err or "", "error")
        return

    input_data = fields.get("input") or {}
    user_id = (input_data.get("userId") or "").strip()

    if not user_id:
        msg = "userId が指定されていません"
        _update_status(collection_path, request_id, "error", error_message=msg)
        _append_log(collection_path, request_id, msg, "error")
        return

    if user_id == operator_user_id:
        msg = "ログイン中の自分自身は削除できません"
        _update_status(collection_path, request_id, "error", error_message=msg)
        _append_log(collection_path, request_id, msg, "error")
        return

    _update_status(collection_path, request_id, "processing")
    _append_log(collection_path, request_id, "メンバー削除処理を開始しました")

    try:
        in_org, claims = _assert_target_in_org(
            collection_path, request_id, organization_id, user_id
        )
        if not in_org:
            return

        target_role = int(claims.get("rbacRole") or 0)
        if target_role == 1:
            msg = "Super ユーザーは削除できません"
            _update_status(collection_path, request_id, "error", error_message=msg)
            _append_log(collection_path, request_id, msg, "error")
            return

        try:
            auth.delete_user(user_id)
        except auth.UserNotFoundError:
            pass

        db.collection(f"organizations/{organization_id}/adminUsers").document(
            user_id
        ).delete()

        output = {"userId": user_id}
        _update_status(collection_path, request_id, "completed", output=output)
        _append_log(collection_path, request_id, "メンバーを削除しました")
    except Exception as exc:
        msg = f"メンバー削除中にエラーが発生しました: {exc}"
        _update_status(collection_path, request_id, "error", error_message=msg)
        _append_log(collection_path, request_id, msg, "error")
