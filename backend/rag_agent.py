import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import numpy as np
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStore
import faiss
from llm_clients import api_key

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FAISSVectorStore:
    def __init__(self, embedding_dimension: int = 1536):
        self.embedding_dimension = embedding_dimension
        self.index = faiss.IndexFlatL2(embedding_dimension)
        self.documents: List[Document] = []
        self.embeddings_model = OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=api_key
        )
        logger.info(f"[RAG] Initialized FAISS vector store with dimension {embedding_dimension}")
        logger.info("[RAG] OpenAI embeddings model loaded successfully")
    
    def add_documents(self, documents: List[Document]) -> None:
        if not documents:
            logger.warning("[RAG] No documents to add to vector store")
            return
        
        logger.info(f"[RAG] Processing {len(documents)} documents for embedding...")
        texts = [doc.page_content for doc in documents]
        
        embeddings = self.embeddings_model.embed_documents(texts)
        logger.info(f"[RAG] Generated {len(embeddings)} embeddings")
        
        embeddings_array = np.array(embeddings, dtype=np.float32)
        self.index.add(embeddings_array)
        self.documents.extend(documents)
        
        logger.info(f"[RAG] Added {len(documents)} documents to FAISS index. Total documents: {len(self.documents)}")
    
    def similarity_search(self, query: str, k: int = 5) -> List[Document]:
        if len(self.documents) == 0:
            logger.warning("[RAG] No documents in vector store for search")
            return []
        
        logger.info(f"[RAG] Executing similarity search for query: '{query[:50]}...'")
        query_embedding = self.embeddings_model.embed_query(query)
        query_vector = np.array([query_embedding], dtype=np.float32)
        
        k = min(k, len(self.documents))
        distances, indices = self.index.search(query_vector, k)
        
        results = []
        for idx, distance in zip(indices[0], distances[0]):
            if idx < len(self.documents):
                doc = self.documents[idx]
                doc.metadata["similarity_score"] = float(1 / (1 + distance))
                results.append(doc)
        
        logger.info(f"[RAG] Retrieved {len(results)} relevant documents with scores: {[f'{r.metadata.get('similarity_score', 0):.3f}' for r in results]}")
        return results
    
    def save_index(self, filepath: str) -> None:
        logger.info(f"[RAG] Saving FAISS index to {filepath}")
        faiss.write_index(self.index, filepath)
        
        metadata_path = filepath + ".metadata.json"
        metadata = {
            "documents": [
                {
                    "content": doc.page_content,
                    "metadata": doc.metadata
                }
                for doc in self.documents
            ],
            "saved_at": datetime.utcnow().isoformat()
        }
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"[RAG] Index and metadata saved successfully")
    
    def load_index(self, filepath: str) -> None:
        if not os.path.exists(filepath):
            logger.warning(f"[RAG] Index file not found: {filepath}")
            return
        
        logger.info(f"[RAG] Loading FAISS index from {filepath}")
        self.index = faiss.read_index(filepath)
        
        metadata_path = filepath + ".metadata.json"
        if os.path.exists(metadata_path):
            with open(metadata_path, "r") as f:
                metadata = json.load(f)
            
            self.documents = [
                Document(
                    page_content=doc_data["content"],
                    metadata=doc_data["metadata"]
                )
                for doc_data in metadata["documents"]
            ]
            logger.info(f"[RAG] Loaded {len(self.documents)} documents from metadata")
        else:
            logger.warning(f"[RAG] Metadata file not found: {metadata_path}")


class RAGAgent:
    def __init__(self, index_path: Optional[str] = None):
        self.vector_store = FAISSVectorStore()
        self.index_path = index_path or "data/rag_index.faiss"
        self.knowledge_base_loaded = False
        
        logger.info("[RAG] Initializing RAG Agent...")
        self._initialize_knowledge_base()
    
    def _initialize_knowledge_base(self) -> None:
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        
        if os.path.exists(self.index_path):
            logger.info("[RAG] Existing knowledge base detected, loading...")
            self.vector_store.load_index(self.index_path)
            self.knowledge_base_loaded = True
            logger.info(f"[RAG] Knowledge base loaded with {len(self.vector_store.documents)} documents")
        else:
            logger.info("[RAG] No existing knowledge base found, starting fresh")
            self._seed_initial_documents()
    
    def _seed_initial_documents(self) -> None:
        logger.info("[RAG] Seeding initial knowledge base with default documents...")
        
        seed_documents = [
            Document(
                page_content="Account planning is a strategic approach to identifying and pursuing opportunities within target accounts.",
                metadata={"source": "internal", "type": "definition", "topic": "account_planning"}
            ),
            Document(
                page_content="Effective account research involves analyzing company financials, recent news, leadership changes, and market positioning.",
                metadata={"source": "internal", "type": "best_practice", "topic": "research"}
            ),
            Document(
                page_content="Key stakeholders in enterprise accounts typically include C-level executives, department heads, and decision makers.",
                metadata={"source": "internal", "type": "reference", "topic": "stakeholders"}
            ),
            Document(
                page_content="Multi-threading an account means building relationships across multiple levels and departments to reduce single-point-of-failure risk.",
                metadata={"source": "internal", "type": "strategy", "topic": "relationship_building"}
            ),
            Document(
                page_content="Value propositions should be customized to address specific pain points and business objectives of each account.",
                metadata={"source": "internal", "type": "best_practice", "topic": "messaging"}
            )
        ]
        
        self.vector_store.add_documents(seed_documents)
        self.vector_store.save_index(self.index_path)
        self.knowledge_base_loaded = True
        logger.info("[RAG] Initial knowledge base seeded and saved")
    
    def add_knowledge(self, content: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        logger.info(f"[RAG] Adding new knowledge to vector store: '{content[:50]}...'")
        
        if metadata is None:
            metadata = {}
        
        metadata["added_at"] = datetime.utcnow().isoformat()
        
        doc = Document(page_content=content, metadata=metadata)
        self.vector_store.add_documents([doc])
        
        self.vector_store.save_index(self.index_path)
        logger.info(f"[RAG] Knowledge added and index updated. Total documents: {len(self.vector_store.documents)}")
    
    def retrieve_context(self, query: str, k: int = 5) -> List[Document]:
        logger.info(f"[RAG] Retrieving context for query: '{query[:100]}...'")
        
        if not self.knowledge_base_loaded:
            logger.warning("[RAG] Knowledge base not loaded, returning empty context")
            return []
        
        results = self.vector_store.similarity_search(query, k=k)
        
        if results:
            logger.info(f"[RAG] Successfully retrieved {len(results)} relevant documents")
            for i, doc in enumerate(results, 1):
                score = doc.metadata.get("similarity_score", 0)
                logger.debug(f"[RAG]   {i}. Score: {score:.3f} | Source: {doc.metadata.get('source', 'unknown')} | Length: {len(doc.page_content)} chars")
        else:
            logger.info("[RAG] No relevant documents found for query")
        
        return results
    
    def augment_query_with_context(self, query: str, k: int = 3) -> str:
        logger.info(f"[RAG] Augmenting query with retrieved context (k={k})")
        
        relevant_docs = self.retrieve_context(query, k=k)
        
        if not relevant_docs:
            logger.info("[RAG] No context to augment, returning original query")
            return query
        
        context_pieces = []
        for doc in relevant_docs:
            context_pieces.append(doc.page_content)
        
        combined_context = "\n\n".join(context_pieces)
        
        augmented_prompt = f"""Based on the following context information:

{combined_context}

User Query: {query}

Please provide a comprehensive response that incorporates the relevant context above."""
        
        logger.info(f"[RAG] Query augmented with {len(relevant_docs)} context documents ({len(combined_context)} chars)")
        return augmented_prompt
    
    def process_research_results(self, research_data: Dict[str, Any]) -> None:
        logger.info("[RAG] Processing research results for knowledge base update")
        
        if not research_data:
            logger.warning("[RAG] No research data to process")
            return
        
        findings = research_data.get("findings", [])
        if isinstance(findings, list):
            for finding in findings:
                if isinstance(finding, str):
                    self.add_knowledge(
                        content=finding,
                        metadata={
                            "source": "research",
                            "type": "finding",
                            "research_id": research_data.get("id", "unknown")
                        }
                    )
        
        summary = research_data.get("summary")
        if summary:
            self.add_knowledge(
                content=summary,
                metadata={
                    "source": "research",
                    "type": "summary",
                    "research_id": research_data.get("id", "unknown")
                }
            )
        
        logger.info("[RAG] Research results processed and added to knowledge base")
    
    def get_statistics(self) -> Dict[str, Any]:
        stats = {
            "total_documents": len(self.vector_store.documents),
            "index_dimension": self.vector_store.embedding_dimension,
            "knowledge_base_loaded": self.knowledge_base_loaded,
            "index_path": self.index_path
        }
        
        logger.info(f"[RAG] Statistics: {stats}")
        return stats


rag_instance = None

def get_rag_agent() -> RAGAgent:
    global rag_instance
    if rag_instance is None:
        logger.info("[RAG] Creating new RAG agent instance...")
        rag_instance = RAGAgent(index_path="data/rag_index.faiss")
        logger.info("[RAG] RAG agent instance created and ready")
    return rag_instance


async def enhance_with_rag(query: str, context_k: int = 3) -> str:
    logger.info(f"[RAG] Enhancing query with RAG context (k={context_k})")
    
    agent = get_rag_agent()
    augmented = agent.augment_query_with_context(query, k=context_k)
    
    logger.info(f"[RAG] Query enhancement complete")
    return augmented


async def add_to_knowledge_base(content: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
    logger.info("[RAG] Adding content to knowledge base...")
    
    try:
        agent = get_rag_agent()
        agent.add_knowledge(content, metadata)
        logger.info("[RAG] Content successfully added to knowledge base")
        return True
    except Exception as e:
        logger.error(f"[RAG] Error adding to knowledge base: {e}")
        return False
