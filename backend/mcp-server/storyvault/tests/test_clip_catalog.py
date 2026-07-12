from store import StoryVaultStore


def test_list_clip_stories_flattens_current_clip_candidates():
    store = StoryVaultStore.__new__(StoryVaultStore)
    store.list_clips = lambda **_: [
        {
            "id": "clip-1",
            "applicationId": "app-1",
            "clipGroupId": "group-1",
            "title": "Clip one",
            "analysisStatus": "completed",
            "analyzedAt": "2026-07-11T00:00:00Z",
            "clipGroup": {"id": "group-1", "name": "Group one"},
            "analysisResult": {
                "storyCandidates": [
                    {
                        "id": "story-001",
                        "storyKey": "US-01",
                        "title": "First story",
                        "userStory": "As a user...",
                        "evidence": [{"videoId": "clip-1", "transcriptCueIds": ["cue-1"]}],
                    },
                    {
                        "id": "story-002",
                        "storyKey": "US-02",
                        "title": "Second story",
                        "evidence": [],
                    },
                ]
            },
        }
    ]

    stories = store.list_clip_stories(application_id="app-1", limit=500)

    assert [story["id"] for story in stories] == ["clip-1:story-001", "clip-1:story-002"]
    assert stories[0]["sourceType"] == "clip_story_candidate"
    assert stories[0]["clipGroup"]["name"] == "Group one"
    assert stories[0]["evidenceCount"] == 1
    assert stories[1]["evidenceCount"] == 0


def test_list_clip_stories_filters_by_clip_and_query():
    store = StoryVaultStore.__new__(StoryVaultStore)
    store.list_clips = lambda **_: [
        {
            "id": "clip-1",
            "title": "Clip one",
            "clipGroupId": "group-1",
            "clipGroup": {"id": "group-1", "name": "Group one"},
            "analysisResult": {"storyCandidates": [{"id": "story-1", "title": "Alpha", "evidence": []}]},
        },
        {
            "id": "clip-2",
            "title": "Clip two",
            "clipGroupId": "group-1",
            "clipGroup": {"id": "group-1", "name": "Group one"},
            "analysisResult": {"storyCandidates": [{"id": "story-2", "title": "Beta", "evidence": []}]},
        },
    ]

    stories = store.list_clip_stories(application_id="app-1", clip_id="clip-2", query="beta")

    assert len(stories) == 1
    assert stories[0]["id"] == "clip-2:story-2"
