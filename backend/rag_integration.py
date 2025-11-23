import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from rag_agent import get_rag_agent, enhance_with_rag, add_to_knowledge_base
from document_processor import process_and_index_conversation, process_and_index_plan, doc_processor

logger = logging.getLogger(__name__)

class RAGIntegration:
    def __init__(self):
        self.enabled = False
        self.auto_index = False
        self.context_window = 3
        self.agent = None
        logger.info("[RAG-Integration] RAG Integration module initialized")
    
    async def initialize(self) -> None:
        logger.info("[RAG-Integration] Initializing RAG system...")
        try:
            self.agent = get_rag_agent()
            stats = self.agent.get_statistics()
            logger.info(f"[RAG-Integration] RAG system initialized: {stats['total_documents']} documents in knowledge base")
            self.enabled = True
        except Exception as e:
            logger.error(f"[RAG-Integration] Failed to initialize RAG system: {e}")
            self.enabled = False
    
    async def enhance_user_query(self, query: str, use_rag: bool = True) -> str:
        if not self.enabled or not use_rag:
            logger.debug("[RAG-Integration] RAG enhancement skipped (disabled or not requested)")
            return query
        
        logger.info("[RAG-Integration] Enhancing user query with RAG context")
        try:
            enhanced = await enhance_with_rag(query, context_k=self.context_window)
            logger.info(f"[RAG-Integration] Query enhanced successfully (original: {len(query)} chars, enhanced: {len(enhanced)} chars)")
            return enhanced
        except Exception as e:
            logger.error(f"[RAG-Integration] Error enhancing query: {e}")
            return query
    
    async def index_conversation_history(self, messages: List[Any]) -> None:
        if not self.enabled or not self.auto_index:
            logger.debug("[RAG-Integration] Conversation indexing skipped (disabled or auto-index off)")
            return
        
        logger.info("[RAG-Integration] Indexing conversation history")
        try:
            await process_and_index_conversation(messages, self.agent)
            logger.info("[RAG-Integration] Conversation history indexed successfully")
        except Exception as e:
            logger.error(f"[RAG-Integration] Error indexing conversation: {e}")
    
    async def index_account_plan(self, plan: Dict[str, Any]) -> None:
        if not self.enabled or not self.auto_index:
            logger.debug("[RAG-Integration] Plan indexing skipped (disabled or auto-index off)")
            return
        
        logger.info(f"[RAG-Integration] Indexing account plan: {plan.get('id', 'unknown')}")
        try:
            await process_and_index_plan(plan, self.agent)
            logger.info("[RAG-Integration] Account plan indexed successfully")
        except Exception as e:
            logger.error(f"[RAG-Integration] Error indexing plan: {e}")
    
    async def index_file_content(self, content: str, filename: str, file_id: str) -> None:
        if not self.enabled:
            logger.debug("[RAG-Integration] File indexing skipped (RAG disabled)")
            return
        
        logger.info(f"[RAG-Integration] Indexing file content: {filename}")
        try:
            documents = doc_processor.process_file_content(content, filename, file_id)
            self.agent.vector_store.add_documents(documents)
            logger.info(f"[RAG-Integration] File content indexed: {len(documents)} documents created")
        except Exception as e:
            logger.error(f"[RAG-Integration] Error indexing file: {e}")
    
    async def retrieve_relevant_context(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        if not self.enabled:
            logger.debug("[RAG-Integration] Context retrieval skipped (RAG disabled)")
            return []
        
        logger.info(f"[RAG-Integration] Retrieving relevant context (k={k})")
        try:
            results = self.agent.retrieve_context(query, k=k)
            
            formatted_results = []
            for doc in results:
                formatted_results.append({
                    "content": doc.page_content,
                    "metadata": doc.metadata,
                    "score": doc.metadata.get("similarity_score", 0)
                })
            
            logger.info(f"[RAG-Integration] Retrieved {len(formatted_results)} relevant documents")
            return formatted_results
        except Exception as e:
            logger.error(f"[RAG-Integration] Error retrieving context: {e}")
            return []
    
    async def add_research_findings(self, findings: List[str], research_id: str) -> None:
        if not self.enabled:
            logger.debug("[RAG-Integration] Research indexing skipped (RAG disabled)")
            return
        
        logger.info(f"[RAG-Integration] Indexing {len(findings)} research findings (research_id: {research_id})")
        try:
            for idx, finding in enumerate(findings):
                await add_to_knowledge_base(
                    content=finding,
                    metadata={
                        "source": "research",
                        "research_id": research_id,
                        "finding_index": idx,
                        "added_at": datetime.utcnow().isoformat()
                    }
                )
            logger.info(f"[RAG-Integration] Research findings indexed successfully")
        except Exception as e:
            logger.error(f"[RAG-Integration] Error indexing research findings: {e}")
    
    async def get_statistics(self) -> Dict[str, Any]:
        if not self.enabled or not self.agent:
            return {
                "enabled": False,
                "status": "disabled"
            }
        
        logger.info("[RAG-Integration] Retrieving RAG statistics")
        stats = self.agent.get_statistics()
        stats.update({
            "enabled": self.enabled,
            "auto_index": self.auto_index,
            "context_window": self.context_window,
            "status": "active"
        })
        
        logger.info(f"[RAG-Integration] Statistics retrieved: {stats['total_documents']} docs, status: {stats['status']}")
        return stats
    
    async def clear_knowledge_base(self) -> bool:
        logger.warning("[RAG-Integration] Clearing knowledge base...")
        try:
            if self.agent:
                self.agent.vector_store.documents.clear()
                self.agent.vector_store.index.reset()
                logger.info("[RAG-Integration] Knowledge base cleared successfully")
                return True
        except Exception as e:
            logger.error(f"[RAG-Integration] Error clearing knowledge base: {e}")
        return False
    
    async def rebuild_index(self) -> bool:
        logger.info("[RAG-Integration] Rebuilding knowledge base index...")
        try:
            if self.agent:
                self.agent._seed_initial_documents()
                logger.info("[RAG-Integration] Index rebuilt successfully")
                return True
        except Exception as e:
            logger.error(f"[RAG-Integration] Error rebuilding index: {e}")
        return False


rag_integration = RAGIntegration()


async def init_rag_system() -> None:
    logger.info("[RAG-Integration] Starting RAG system initialization sequence")
    await rag_integration.initialize()
    
    if rag_integration.enabled:
        stats = await rag_integration.get_statistics()
        logger.info(f"[RAG-Integration] RAG system ready: {stats}")
    else:
        logger.warning("[RAG-Integration] RAG system initialization completed with warnings")


async def process_message_with_rag(message: str, session_state: Dict[str, Any]) -> str:
    logger.info("[RAG-Integration] Processing message with RAG enhancement")
    
    enhanced_message = await rag_integration.enhance_user_query(message, use_rag=False)
    
    if session_state.get("messages"):
        await rag_integration.index_conversation_history(session_state["messages"])
    
    if session_state.get("plan"):
        await rag_integration.index_account_plan(session_state["plan"])
    
    logger.info("[RAG-Integration] Message processing with RAG complete")
    return enhanced_message


async def retrieve_context_for_research(query: str, k: int = 5) -> List[Dict[str, Any]]:
    logger.info(f"[RAG-Integration] Retrieving context for research query: '{query[:50]}...'")
    return await rag_integration.retrieve_relevant_context(query, k=k)


async def index_research_results(findings: List[str], research_id: str) -> None:
    logger.info(f"[RAG-Integration] Indexing research results (id: {research_id})")
    await rag_integration.add_research_findings(findings, research_id)


async def get_rag_status() -> Dict[str, Any]:
    logger.debug("[RAG-Integration] Getting RAG system status")
    return await rag_integration.get_statistics()
