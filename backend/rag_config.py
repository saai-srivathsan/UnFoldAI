import os
from typing import Dict, Any

class RAGConfig:
    EMBEDDING_MODEL = "text-embedding-3-small"
    EMBEDDING_DIMENSION = 1536
    
    CHUNK_SIZE = 1000
    CHUNK_OVERLAP = 200
    
    DEFAULT_CONTEXT_K = 3
    MAX_CONTEXT_K = 10
    
    INDEX_PATH = "data/rag_index.faiss"
    
    SIMILARITY_THRESHOLD = 0.7
    
    AUTO_INDEX_CONVERSATIONS = False
    AUTO_INDEX_PLANS = False
    AUTO_INDEX_RESEARCH = False
    
    @classmethod
    def to_dict(cls) -> Dict[str, Any]:
        return {
            "embedding_model": cls.EMBEDDING_MODEL,
            "embedding_dimension": cls.EMBEDDING_DIMENSION,
            "chunk_size": cls.CHUNK_SIZE,
            "chunk_overlap": cls.CHUNK_OVERLAP,
            "default_context_k": cls.DEFAULT_CONTEXT_K,
            "max_context_k": cls.MAX_CONTEXT_K,
            "index_path": cls.INDEX_PATH,
            "similarity_threshold": cls.SIMILARITY_THRESHOLD,
            "auto_index": {
                "conversations": cls.AUTO_INDEX_CONVERSATIONS,
                "plans": cls.AUTO_INDEX_PLANS,
                "research": cls.AUTO_INDEX_RESEARCH
            }
        }


RAG_ENABLED = os.getenv("RAG_ENABLED", "false").lower() == "true"
RAG_VERBOSE_LOGGING = os.getenv("RAG_VERBOSE_LOGGING", "true").lower() == "true"
