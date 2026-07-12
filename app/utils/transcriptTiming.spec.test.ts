import { describe, expect, it } from "vitest";
import {
  parseSrtTranscript,
  transcriptCuesToSrt,
} from "./transcriptTiming";

describe("transcriptTiming", () => {
  it("parses SRT timestamps into millisecond transcript cues", () => {
    const cues = parseSrtTranscript(
      [
        "1",
        "00:00:20,000 --> 00:00:38,250",
        "明細情報を確認します",
        "",
        "2",
        "00:00:50,500 --> 00:01:32,000",
        "取引先情報を登録します",
      ].join("\n")
    );

    expect(cues).toEqual([
      {
        id: "cue-0001",
        index: 1,
        startMs: 20_000,
        endMs: 38_250,
        text: "明細情報を確認します",
      },
      {
        id: "cue-0002",
        index: 2,
        startMs: 50_500,
        endMs: 92_000,
        text: "取引先情報を登録します",
      },
    ]);
  });

  it("formats normalized cues as SRT", () => {
    const srt = transcriptCuesToSrt([
      {
        id: "cue-1",
        index: 1,
        startMs: 20_000,
        endMs: 38_000,
        text: "明細情報を確認します",
      },
    ]);

    expect(srt).toContain("00:00:20,000 --> 00:00:38,000");
    expect(srt).toContain("明細情報を確認します");
  });
});
