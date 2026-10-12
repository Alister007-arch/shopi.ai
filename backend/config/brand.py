"""Trovi Brand Configuration (Backend).

Single source of truth for branding, taglines, assistant identity, and support info.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class GrievanceOfficerConfig:
    name: str = "Aarav Sharma"
    email: str = "grievance@trovi.ai"


@dataclass(frozen=True)
class BrandConfig:
    name: str = "Trovi"
    assistant_name: str = "Trovi AI"
    chat_button_label: str = "Ask Trovi"
    tagline: str = "Bolo, Trovi dhoond dega."
    tagline_en: str = "Ask. Compare. Buy."
    support_email: str = "support@trovi.ai"
    grievance_officer: GrievanceOfficerConfig = GrievanceOfficerConfig()
    welcome_message: str = "Namaste! Main Trovi AI hoon. Kya dhoond rahe ho: honey, kapde, ya laptop?"
    copyright: str = "© 2026 Trovi Technologies Inc. All rights reserved."
    organic_collection_name: str = "MOSS Organics"
    legal_name: str = "Trovi Commerce India Private Limited"
    trade_name: str = "Trovi"


BRAND = BrandConfig()
