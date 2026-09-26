from typing import Dict, Any, List
from backend.app.adapters.provider_base import BaseFormProviderAdapter
from backend.app.schemas.application_form import QuestionSchema

class MicrosoftFormsAdapter(BaseFormProviderAdapter):
    @property
    def provider_name(self) -> str:
        return "MicrosoftForms"

    def get_capabilities(self) -> Dict[str, Any]:
        return {
            "provider": "MicrosoftForms",
            "connection_state": "NotConnected",
            "automatic_creation_available": False, # Official Microsoft Graph API does not support programmatic form creation
            "limitations": [
                "Programmatic creation is not supported by official Microsoft Forms APIs. HR users can export the generated question outline and attach a manually created MS Forms URL ('Manually linked')."
            ]
        }

    def create_external_form(
        self,
        title: str,
        description: str,
        questions: List[QuestionSchema]
    ) -> Dict[str, Any]:
        return {
            "provider_form_id": None,
            "respondent_url": None,
            "editor_url": None,
            "creation_status": "NeedsSetup",
            "message": "Automatic creation unavailable for Microsoft Forms. Question schema outline generated for manual copying."
        }
