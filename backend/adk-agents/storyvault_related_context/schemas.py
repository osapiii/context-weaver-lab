"""Structured output schemas for StoryVault related context."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class RelatedPullRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    number: int = Field(ge=1)
    title: str = Field(min_length=1)
    htmlUrl: str = Field(min_length=1)
    author: str | None = None
    state: str | None = None
    mergedAt: str | None = None
    updatedAt: str | None = None
    labels: list[str] = Field(default_factory=list)
    changedFiles: int | None = None
    additions: int | None = None
    deletions: int | None = None
    relevanceScore: int = Field(ge=0, le=100)
    reason: str = Field(min_length=1)
    matchedSignals: list[str] = Field(default_factory=list)


class RelatedGitHubContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    repoFullName: str = ""
    checkedAt: str = ""
    pullRequests: list[RelatedPullRequest] = Field(default_factory=list)
    errorMessage: str | None = None


class RelatedSlackMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    channelId: str = ""
    channelName: str = ""
    messageTs: str = Field(min_length=1)
    threadTs: str | None = None
    permalink: str = ""
    author: str | None = None
    text: str = ""
    postedAt: str | None = None
    relevanceScore: int = Field(ge=0, le=100)
    reason: str = Field(min_length=1)
    matchedSignals: list[str] = Field(default_factory=list)


class RelatedSlackContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    teamId: str = ""
    teamName: str = ""
    checkedAt: str = ""
    messages: list[RelatedSlackMessage] = Field(default_factory=list)
    errorMessage: str | None = None


class RelatedKnowledgeDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    documentId: str = ""
    name: str = ""
    displayName: str | None = None
    description: str | None = None
    mimeType: str | None = None
    sourceKind: str | None = None
    gcsUrl: str | None = None
    bucketName: str | None = None
    filePath: str | None = None
    relevanceScore: int = Field(ge=0, le=100)
    reason: str = Field(min_length=1)
    matchedSignals: list[str] = Field(default_factory=list)
    downloadUrl: str | None = None


class RelatedKnowledgeContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fileSpaceId: str = ""
    checkedAt: str = ""
    documents: list[RelatedKnowledgeDocument] = Field(default_factory=list)
    errorMessage: str | None = None


class RelatedJiraNamedField(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = ""
    name: str = ""


class RelatedJiraIssue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = ""
    key: str = Field(min_length=1)
    cloudId: str = ""
    siteUrl: str = ""
    htmlUrl: str = ""
    summary: str = Field(min_length=1)
    description: str = ""
    issueType: RelatedJiraNamedField = Field(default_factory=RelatedJiraNamedField)
    status: RelatedJiraNamedField = Field(default_factory=RelatedJiraNamedField)
    priority: RelatedJiraNamedField = Field(default_factory=RelatedJiraNamedField)
    assignee: RelatedJiraNamedField = Field(default_factory=RelatedJiraNamedField)
    reporter: RelatedJiraNamedField = Field(default_factory=RelatedJiraNamedField)
    project: RelatedJiraNamedField = Field(default_factory=RelatedJiraNamedField)
    labels: list[str] = Field(default_factory=list)
    components: list[RelatedJiraNamedField] = Field(default_factory=list)
    fixVersions: list[RelatedJiraNamedField] = Field(default_factory=list)
    parentKey: str = ""
    createdAt: str = ""
    updatedAt: str = ""
    relevanceScore: int = Field(ge=0, le=100)
    reason: str = Field(min_length=1)
    matchedSignals: list[str] = Field(default_factory=list)


class RelatedJiraContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cloudId: str = ""
    siteName: str = ""
    siteUrl: str = ""
    checkedAt: str = ""
    issues: list[RelatedJiraIssue] = Field(default_factory=list)
    errorMessage: str | None = None


class RelatedContextResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal["storyvault-related-context-v1"] = (
        "storyvault-related-context-v1"
    )
    generatedAt: str = Field(min_length=1)
    status: Literal["completed", "error"] = "completed"
    github: RelatedGitHubContext | None = None
    slack: RelatedSlackContext | None = None
    knowledge: RelatedKnowledgeContext | None = None
    jira: RelatedJiraContext | None = None
    notes: list[str] = Field(default_factory=list)
