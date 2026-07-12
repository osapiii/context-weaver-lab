from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class SilenceCutRange(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(gt=0)


class SilenceTrimSettings(BaseModel):
    enabled: bool = True
    noiseReductionEnabled: bool = False
    noiseReductionStrengthDb: float = Field(default=12, ge=0, le=30)
    noiseFloorDb: float = Field(default=-40, ge=-80, le=-20)
    thresholdDb: float = Field(default=-38)
    minSilenceMs: int = Field(default=5000, ge=100)
    keepPaddingMs: int = Field(default=180, ge=0)
    minSegmentMs: int = Field(default=450, ge=100)
    mergeGapMs: int = Field(default=10000, ge=0)
    cutRangesSeconds: list[SilenceCutRange] | None = None


class SystemMetadata(BaseModel):
    loggingCollectionId: str | None = None
    loggingDocumentId: str | None = None


class TrimSilenceInput(BaseModel):
    videoBucketName: str
    videoFilePath: str
    outputBucketName: str
    outputFilePath: str
    manifestOutputFilePath: str
    splitPointsSeconds: list[float] = Field(default_factory=list)
    segmentOutputFilePaths: list[str] = Field(default_factory=list)
    settings: SilenceTrimSettings = Field(default_factory=SilenceTrimSettings)
    videoId: str | None = None
    projectId: str | None = None
    projectName: str | None = None
    videoTitle: str | None = None

    @field_validator(
        "videoBucketName",
        "videoFilePath",
        "outputBucketName",
        "outputFilePath",
        "manifestOutputFilePath",
    )
    @classmethod
    def required_string(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("field is required")
        return value.strip()

    @field_validator("splitPointsSeconds")
    @classmethod
    def sorted_split_points(cls, value: list[float]) -> list[float]:
        return sorted({round(float(item), 3) for item in value if float(item) > 0})

    def model_post_init(self, __context: Any) -> None:
        if self.segmentOutputFilePaths and (
            len(self.segmentOutputFilePaths) != len(self.splitPointsSeconds) + 1
        ):
            raise ValueError(
                "segmentOutputFilePaths length must equal splitPointsSeconds length + 1"
            )


class ProcessRequest(BaseModel):
    request_id: str
    requestId: str | None = None
    requestPath: str | None = None
    organizationId: str | None = None
    spaceId: str | None = None
    input: TrimSilenceInput
    systemMetadata: SystemMetadata | None = None
    operationMetadata: dict[str, Any] | None = None


class TrimmedAssetOutput(BaseModel):
    resultBucketName: str
    resultFilePath: str
    fileSizeBytes: int | None = None


class TrimmedSegmentOutput(TrimmedAssetOutput):
    segmentNumber: int
    startTimeSeconds: float
    endTimeSeconds: float
    durationSeconds: float


class TrimSilenceStatistics(BaseModel):
    originalDurationSeconds: float
    trimmedDurationSeconds: float
    removedDurationSeconds: float
    cutCount: int
    noAudioStream: bool = False
    noiseReductionApplied: bool = False


class TrimSilenceOutput(BaseModel):
    resultBucketName: str
    resultFilePath: str
    trimmedVideo: TrimmedAssetOutput
    manifest: TrimmedAssetOutput
    segments: list[TrimmedSegmentOutput] = Field(default_factory=list)
    processingTime: float
    statistics: TrimSilenceStatistics
