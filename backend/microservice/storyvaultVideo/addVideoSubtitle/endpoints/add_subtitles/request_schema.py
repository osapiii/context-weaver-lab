"""
Pydantic schemas for addVideoSubtitle service.
RequestDoc golden template compliant.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class SubtitleSegmentInput(BaseModel):
    """Subtitle segment input schema."""

    startMs: int = Field(..., ge=0, description="Subtitle start timestamp in milliseconds")
    endMs: int = Field(..., ge=0, description="Subtitle end timestamp in milliseconds")
    text: str = Field(..., min_length=1, max_length=500, description="Subtitle text")

    @model_validator(mode="after")
    def validate_end_time(self) -> "SubtitleSegmentInput":
        if self.endMs <= self.startMs:
            raise ValueError("endMs must be greater than startMs")
        return self


class SubtitleStyleInput(BaseModel):
    """Subtitle style settings."""

    preset: str = Field(default="clear_standard", description="Subtitle style preset")
    position: str = Field(default="bottom", description="Subtitle position")
    fontScale: float = Field(default=1.0, ge=0.5, le=1.8)
    fontColor: str = Field(default="#FFFFFF")
    outlineColor: str = Field(default="#000000")
    backColor: str = Field(default="rgba(0,0,0,0.35)")
    bold: bool = Field(default=True)

    @field_validator("preset")
    @classmethod
    def validate_preset(cls, value: str) -> str:
        allowed = {
            "clear_standard",
            "business_emphasis",
            "cinema_bottom",
            "shorts_pop",
            "soft_gray_panel",
        }
        if value not in allowed:
            raise ValueError(f"preset must be one of {sorted(allowed)}")
        return value

    @field_validator("position")
    @classmethod
    def validate_position(cls, value: str) -> str:
        if value not in ["top", "bottom"]:
            raise ValueError("position must be 'top' or 'bottom'")
        return value


class AddSubtitleInput(BaseModel):
    """Input layer schema."""

    videoBucketName: str = Field(..., min_length=1, description="Source video bucket name")
    videoFilePath: str = Field(..., min_length=1, description="Source final MP4 file path")
    outputBucketName: str = Field(..., min_length=1, description="Output bucket name")
    outputFilePath: str = Field(..., min_length=1, description="Subtitled MP4 output file path")
    subtitleSrtOutputFilePath: Optional[str] = Field(None, description="SRT output file path")
    subtitleAssOutputFilePath: Optional[str] = Field(None, description="ASS output file path")
    videoId: str = Field(..., min_length=1, description="Video ID")
    projectId: Optional[str] = Field(None, description="Project ID")
    captionSegments: List[SubtitleSegmentInput] = Field(
        ..., min_length=1, description="Subtitle segments"
    )
    captionStyle: SubtitleStyleInput = Field(
        default_factory=SubtitleStyleInput, description="Subtitle style settings"
    )

    @field_validator("outputFilePath")
    @classmethod
    def validate_output_file_path(cls, value: str) -> str:
        if not value.endswith(".mp4"):
            raise ValueError("outputFilePath must end with .mp4")
        return value

    @field_validator("subtitleSrtOutputFilePath")
    @classmethod
    def validate_srt_file_path(cls, value: Optional[str]) -> Optional[str]:
        if value and not value.endswith(".srt"):
            raise ValueError("subtitleSrtOutputFilePath must end with .srt")
        return value

    @field_validator("subtitleAssOutputFilePath")
    @classmethod
    def validate_ass_file_path(cls, value: Optional[str]) -> Optional[str]:
        if value and not value.endswith(".ass"):
            raise ValueError("subtitleAssOutputFilePath must end with .ass")
        return value


class AddSubtitleSystemMetadata(BaseModel):
    """System metadata schema."""

    organizationId: str = Field(..., min_length=1)
    spaceId: str = Field(..., min_length=1)
    loggingCollectionId: str = Field(..., min_length=1)
    loggingDocumentId: str = Field(..., min_length=1)
    requestedBy: Dict[str, Any] = Field(..., description="Requester info")
    isCommand: bool = Field(...)
    isOouiCrud: bool = Field(...)
    isLlmCall: bool = Field(...)
    isAdminCrud: bool = Field(...)


class ProcessRequest(BaseModel):
    """Cloud Run request schema."""

    request_id: str = Field(..., min_length=1)
    input: AddSubtitleInput = Field(...)
    systemMetadata: AddSubtitleSystemMetadata = Field(...)


class SubtitleStatistics(BaseModel):
    """Statistics output."""

    totalSubtitleSegments: Optional[int] = Field(None)
    totalDurationSeconds: Optional[float] = Field(None, ge=0)
    subtitledVideoSizeBytes: Optional[int] = Field(None, ge=0)
    srtSizeBytes: Optional[int] = Field(None, ge=0)
    assSizeBytes: Optional[int] = Field(None, ge=0)
    preset: Optional[str] = Field(None)


class SubtitleAssetOutput(BaseModel):
    """Storage output for one generated asset."""

    resultBucketName: str = Field(..., description="Result bucket name")
    resultFilePath: str = Field(..., description="Result file path")
    fileSizeBytes: Optional[int] = Field(None, ge=0)


class AddSubtitleOutput(BaseModel):
    """Output layer schema."""

    resultBucketName: str = Field(..., description="Subtitled video bucket name")
    resultFilePath: str = Field(..., description="Subtitled video file path")
    subtitledVideo: SubtitleAssetOutput = Field(...)
    srt: SubtitleAssetOutput = Field(...)
    ass: SubtitleAssetOutput = Field(...)
    processingTime: float = Field(..., ge=0, description="Processing time seconds")
    statistics: Optional[SubtitleStatistics] = Field(None)


class ProcessResponse(BaseModel):
    """Cloud Run response schema."""

    output: AddSubtitleOutput = Field(...)
    processing_time: float = Field(..., ge=0)
