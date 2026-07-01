from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class SilenceTrimSettings(BaseModel):
    thresholdDb: float = Field(default=-38)
    minSilenceMs: int = Field(default=700, ge=100)
    keepPaddingMs: int = Field(default=180, ge=0)
    minSegmentMs: int = Field(default=450, ge=100)


class SystemMetadata(BaseModel):
    loggingCollectionId: str | None = None
    loggingDocumentId: str | None = None


class TrimSilenceInput(BaseModel):
    videoBucketName: str
    videoFilePath: str
    outputBucketName: str
    outputFilePath: str
    manifestOutputFilePath: str
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


class TrimSilenceStatistics(BaseModel):
    originalDurationSeconds: float
    trimmedDurationSeconds: float
    removedDurationSeconds: float
    cutCount: int
    noAudioStream: bool = False


class TrimSilenceOutput(BaseModel):
    resultBucketName: str
    resultFilePath: str
    trimmedVideo: TrimmedAssetOutput
    manifest: TrimmedAssetOutput
    processingTime: float
    statistics: TrimSilenceStatistics
