from steps import trim_silence
from endpoints.trim_silence.request_schema import SilenceTrimSettings
from steps.trim_silence import (
    build_noise_reduction_filter,
    map_source_time_to_output,
    output_split_points,
)


def test_probe_duration_falls_back_to_packet_timeline(monkeypatch):
    responses = iter([
        {"format": {}, "streams": [{"duration": "N/A"}]},
        {
            "packets": [
                {"pts_time": "54.900", "duration_time": "0.060"},
                {"dts_time": "55.199", "duration_time": "0.060"},
            ]
        },
    ])
    monkeypatch.setattr(trim_silence, "_probe_json", lambda *_args: next(responses))

    assert trim_silence.probe_duration("recording.webm") == 55.259


def test_probe_duration_prefers_container_or_stream_metadata(monkeypatch):
    monkeypatch.setattr(
        trim_silence,
        "_probe_json",
        lambda *_args: {
            "format": {"duration": "55.25"},
            "streams": [{"duration": "54.67"}],
        },
    )

    assert trim_silence.probe_duration("recording.mp4") == 55.25


def test_probe_video_canvas_uses_largest_even_dimensions(monkeypatch):
    monkeypatch.setattr(
        trim_silence,
        "_probe_json",
        lambda *_args: {
            "streams": [{"width": 2016, "height": 1912}],
            "frames": [
                {"width": 2016, "height": 1912},
                {"width": 2341, "height": 1911},
            ],
        },
    )

    assert trim_silence.probe_video_canvas("recording.webm") == (2342, 1912)


def test_source_time_inside_removed_silence_maps_to_next_kept_range():
    timeline = [
        {"sourceStart": 0.0, "sourceEnd": 10.0, "outputStart": 0.0, "outputEnd": 10.0},
        {"sourceStart": 15.0, "sourceEnd": 30.0, "outputStart": 10.0, "outputEnd": 25.0},
    ]

    assert map_source_time_to_output(12.0, timeline) == 10.0
    assert map_source_time_to_output(20.0, timeline) == 15.0


def test_output_split_points_are_sorted_and_skip_edges():
    timeline = [
        {"sourceStart": 0.0, "sourceEnd": 30.0, "outputStart": 0.0, "outputEnd": 30.0},
    ]

    assert output_split_points([20.0, 0.1, 10.0], timeline, 30.0) == [10.0, 20.0]


def test_noise_reduction_filter_uses_conservative_speech_settings():
    filter_value = build_noise_reduction_filter(
        strength_db=12,
        noise_floor_db=-40,
    )
    assert filter_value == (
        "highpass=f=80,"
        "afftdn=nr=12.00:nf=-40.00:tn=1,"
        "alimiter=limit=0.95"
    )


def test_noise_reduction_is_opt_in_for_legacy_callers():
    assert SilenceTrimSettings().noiseReductionEnabled is False


def test_noise_reduction_filter_clamps_untrusted_settings():
    filter_value = build_noise_reduction_filter(
        strength_db=200,
        noise_floor_db=-120,
    )

    assert "nr=30.00" in filter_value
    assert "nf=-80.00" in filter_value


def test_uncut_video_is_reencoded_when_noise_reduction_is_enabled(
    monkeypatch,
    tmp_path,
):
    commands: list[list[str]] = []
    monkeypatch.setattr(trim_silence, "probe_video_canvas", lambda _path: (1280, 720))
    monkeypatch.setattr(
        trim_silence,
        "_run",
        lambda command: commands.append(command),
    )

    trim_silence.render_trimmed_video(
        input_path="source.webm",
        output_path=str(tmp_path / "prepared.mp4"),
        kept_ranges=[{"start": 0.0, "end": 30.0}],
        no_audio_stream=False,
        original_duration_seconds=30.0,
        noise_reduction_enabled=True,
        noise_reduction_strength_db=12,
        noise_floor_db=-40,
    )

    assert len(commands) == 1
    assert "afftdn=nr=12.00:nf=-40.00:tn=1" in " ".join(commands[0])
    assert "copy" not in commands[0]
