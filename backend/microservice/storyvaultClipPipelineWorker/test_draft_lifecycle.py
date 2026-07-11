import main


class FakeDraftRef:
    def __init__(self, doc_id="draft-1"):
        self.id = doc_id
        self.deleted = False
        self.set_calls = []

    def delete(self):
        self.deleted = True

    def set(self, payload, merge=False):
        self.set_calls.append((payload, merge))


class FakeDb:
    def __init__(self, draft_ref):
        self.draft_ref = draft_ref
        self.paths = []

    def document(self, path):
        self.paths.append(path)
        return self.draft_ref


class FakePipelineRef:
    id = "pipeline-1"

    def __init__(self):
        self.updates = []

    def update(self, payload):
        self.updates.append(payload)

    class Events:
        class Document:
            def set(self, *_args, **_kwargs):
                return None

        def document(self):
            return self.Document()

    def collection(self, _name):
        return self.Events()

    def get(self):
        class Snapshot:
            def to_dict(self):
                return {"latestLogs": []}
        return Snapshot()


def parent():
    return {
        "input": {"sourceDraftId": "draft-1"},
        "operationMetadata": {"organizationId": "org-1", "spaceId": "space-1"},
    }


def test_finalizing_pipeline_deletes_originating_draft(monkeypatch):
    draft = FakeDraftRef()
    monkeypatch.setattr(main, "db", FakeDb(draft))
    main._finalize_source_draft(FakePipelineRef(), parent())
    assert draft.deleted is True


def test_failed_pipeline_restores_originating_draft_as_error(monkeypatch):
    draft = FakeDraftRef()
    monkeypatch.setattr(main, "db", FakeDb(draft))
    main._restore_source_draft_for_error(parent(), "pipeline-1", "section failed")
    assert draft.set_calls[0][0]["status"] == "error"
    assert "pipeline-1" in draft.set_calls[0][0]["statusMessage"]
