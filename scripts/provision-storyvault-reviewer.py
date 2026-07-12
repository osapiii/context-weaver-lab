#!/usr/bin/env python3
"""Provision an email/password reviewer in an existing StoryVault organization.

The password is read from the terminal and is never written to Firestore, env files,
command history, or this repository. Run with Application Default Credentials that
have Firebase Auth and Firestore administration privileges.
"""

from __future__ import annotations

import argparse
import getpass
import sys

import firebase_admin
from firebase_admin import auth, firestore


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True, help="Firebase/GCP project ID")
    parser.add_argument("--organization-id", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Create/update the account. Without this flag only validates the target.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    firebase_admin.initialize_app(options={"projectId": args.project})
    db = firestore.client()

    org_ref = db.collection("organizations").document(args.organization_id)
    org = org_ref.get()
    if not org.exists:
        print(f"ERROR: organization not found: {args.organization_id}", file=sys.stderr)
        return 2

    org_data = org.to_dict() or {}
    org_code = str(org_data.get("code") or "")
    spaces = list(org_ref.collection("spaces").stream())
    app_count = 0
    for space in spaces:
        apps = space.reference.collection("storyVaultApplications").limit(1).stream()
        app_count += sum(1 for _ in apps)

    print(
        f"Target organization: {args.organization_id} "
        f"({org_data.get('displayName') or org_data.get('name') or org_code})"
    )
    print(f"Spaces: {len(spaces)}")
    print(f"Spaces containing StoryVault application data: {app_count}")
    print("Reviewer role: organization administrator (rbacRole=2)")
    if app_count == 0:
        print(
            "ERROR: no StoryVault application data was found in this organization",
            file=sys.stderr,
        )
        return 2
    if not args.apply:
        print("Validation only. Re-run with --apply to provision the reviewer.")
        return 0

    password = getpass.getpass("Reviewer password (12+ characters): ")
    if len(password) < 12:
        print("ERROR: password must be at least 12 characters", file=sys.stderr)
        return 2
    if password != getpass.getpass("Confirm password: "):
        print("ERROR: passwords do not match", file=sys.stderr)
        return 2

    email = args.email.strip().lower()
    try:
        user = auth.get_user_by_email(email)
        user = auth.update_user(
            user.uid, password=password, email_verified=True, disabled=False
        )
        action = "updated"
    except auth.UserNotFoundError:
        user = auth.create_user(
            email=email, password=password, email_verified=True, disabled=False
        )
        action = "created"

    existing_claims = dict(user.custom_claims or {})
    existing_claims.update(
        {
            "rbacRole": 2,
            "organizationId": args.organization_id,
            "organizationCode": org_code,
            "spaceIds": [],
        }
    )
    auth.set_custom_user_claims(user.uid, existing_claims)
    org_ref.collection("adminUsers").document(user.uid).set(
        {
            "id": user.uid,
            "uid": user.uid,
            "email": email,
            "displayName": user.display_name or "Hackathon Reviewer",
            "role": "2",
            "rbacRole": 2,
            "organizationId": args.organization_id,
            "organizationCode": org_code,
            "spaceIds": [],
            "status": "active",
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )
    print(f"Reviewer {action}: {email} (uid={user.uid})")
    print("Share the email/password privately. Do not commit them to GitHub.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
