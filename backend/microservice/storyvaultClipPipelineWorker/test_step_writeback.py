from datetime import datetime, timezone

import main


class FakeRef:
    def __init__(self):
        self.data = {"steps": {"notification": {}}}

    def update(self, values):
        for path, value in values.items():
            if path.startswith("steps.notification."):
                self.data["steps"]["notification"][path.rsplit(".", 1)[1]] = value
            else:
                self.data[path] = value


def test_notification_writeback_preserves_started_at_and_adds_completion_fields():
    ref = FakeRef()
    started = datetime(2026, 7, 11, tzinfo=timezone.utc)
    completed = datetime(2026, 7, 11, 0, 1, tzinfo=timezone.utc)
    main._patch_step(ref, "notification", "processing", startedAt=started)
    main._patch_step(
        ref,
        "notification",
        "completed",
        completedAt=completed,
        emailRequestId="email-1",
        message="完了メールを送信しました",
    )
    step = ref.data["steps"]["notification"]
    assert step == {
        "status": "completed",
        "startedAt": started,
        "completedAt": completed,
        "emailRequestId": "email-1",
        "message": "完了メールを送信しました",
    }
