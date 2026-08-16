"""
Lehar AI Backend — Chat Router
Handles natural language queries via the NL-to-SQL pipeline.
"""

from fastapi import APIRouter
from ..models.schemas import ChatRequest, ChatResponse
from ..services.nl2sql import process_chat_query

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Process a natural language query about Argo ocean data.
    Converts NL → SQL → executes → returns answer + visualizations.
    """
    result = await process_chat_query(request.query, request.language)
    return ChatResponse(**result)
