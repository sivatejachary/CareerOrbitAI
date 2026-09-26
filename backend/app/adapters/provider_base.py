from abc import ABC, abstractmethod
from typing import Dict, Any, List
from backend.app.schemas.application_form import QuestionSchema

class BaseFormProviderAdapter(ABC):
    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @abstractmethod
    def get_capabilities(self) -> Dict[str, Any]:
        pass

    @abstractmethod
    def create_external_form(
        self,
        title: str,
        description: str,
        questions: List[QuestionSchema]
    ) -> Dict[str, Any]:
        """
        Creates external form. Returns dict:
        {
          "provider_form_id": str,
          "respondent_url": str,
          "editor_url": str,
          "creation_status": "Created" | "NeedsSetup" | "Failed",
          "message": str
        }
        """
        pass
