"""取引先登録 Agent の structured output スキーマ."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class BusinessPartnerSourceRef(BaseModel):
    title: str = ""
    uri: str = ""


class BusinessPartnerFieldsModel(BaseModel):
    """EN AIstudio 取引先フォーム — 空欄補完用 (すべて optional)."""

    code: Optional[str] = None
    name: Optional[str] = None
    trade_name: Optional[str] = Field(default=None, alias="tradeName")
    trade_name_kana: Optional[str] = Field(default=None, alias="tradeNameKana")
    corporate_number: Optional[str] = Field(default=None, alias="corporateNumber")
    postal_code: Optional[str] = Field(default=None, alias="postalCode")
    prefecture: Optional[str] = None
    city: Optional[str] = None
    street_address: Optional[str] = Field(default=None, alias="streetAddress")
    address: Optional[str] = None
    capital_stock: Optional[str] = Field(default=None, alias="capitalStock")
    representative_name: Optional[str] = Field(default=None, alias="representativeName")
    representative_title: Optional[str] = Field(
        default=None, alias="representativeTitle"
    )
    founded_date: Optional[str] = Field(default=None, alias="foundedDate")
    industry: Optional[str] = None
    employee_count: Optional[str] = Field(default=None, alias="employeeCount")
    business_summary: Optional[str] = Field(default=None, alias="businessSummary")
    contact_person: Optional[str] = Field(default=None, alias="contactPerson")
    phone_number: Optional[str] = Field(default=None, alias="phoneNumber")
    email: Optional[str] = None
    website: Optional[str] = None
    note: Optional[str] = None

    model_config = {"populate_by_name": True}


class BusinessPartnerDraftModel(BaseModel):
    comment: str = ""
    fields: BusinessPartnerFieldsModel = Field(
        default_factory=BusinessPartnerFieldsModel
    )
    sources: list[BusinessPartnerSourceRef] = Field(default_factory=list)


def fields_to_camel_dict(fields: BusinessPartnerFieldsModel) -> dict[str, Any]:
    """FE mergeEmptyFormFields 向け camelCase."""
    raw = fields.model_dump(by_alias=True, exclude_none=True)
    return {k: v for k, v in raw.items() if v is not None and str(v).strip()}
