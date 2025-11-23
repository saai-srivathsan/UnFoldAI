import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)

class RAGMetrics:
    def __init__(self):
        self.queries_processed = 0
        self.documents_indexed = 0
        self.context_retrievals = 0
        self.cache_hits = 0
        self.cache_misses = 0
        self.avg_retrieval_time = 0.0
        self.avg_embedding_time = 0.0
        self.started_at = datetime.utcnow().isoformat()
        logger.info("[RAG-Metrics] Metrics tracking initialized")
    
    def record_query(self, retrieval_time: float) -> None:
        self.queries_processed += 1
        self.context_retrievals += 1
        
        if self.avg_retrieval_time == 0:
            self.avg_retrieval_time = retrieval_time
        else:
            self.avg_retrieval_time = (self.avg_retrieval_time + retrieval_time) / 2
        
        logger.debug(f"[RAG-Metrics] Query recorded: {retrieval_time:.3f}s (avg: {self.avg_retrieval_time:.3f}s)")
    
    def record_indexing(self, document_count: int, embedding_time: float) -> None:
        self.documents_indexed += document_count
        
        if self.avg_embedding_time == 0:
            self.avg_embedding_time = embedding_time
        else:
            self.avg_embedding_time = (self.avg_embedding_time + embedding_time) / 2
        
        logger.debug(f"[RAG-Metrics] Indexing recorded: {document_count} docs in {embedding_time:.3f}s")
    
    def record_cache_hit(self) -> None:
        self.cache_hits += 1
        logger.debug(f"[RAG-Metrics] Cache hit recorded (total: {self.cache_hits})")
    
    def record_cache_miss(self) -> None:
        self.cache_misses += 1
        logger.debug(f"[RAG-Metrics] Cache miss recorded (total: {self.cache_misses})")
    
    def to_dict(self) -> Dict[str, Any]:
        cache_total = self.cache_hits + self.cache_misses
        cache_hit_rate = (self.cache_hits / cache_total * 100) if cache_total > 0 else 0
        
        return {
            "queries_processed": self.queries_processed,
            "documents_indexed": self.documents_indexed,
            "context_retrievals": self.context_retrievals,
            "cache_statistics": {
                "hits": self.cache_hits,
                "misses": self.cache_misses,
                "hit_rate_percent": round(cache_hit_rate, 2)
            },
            "performance": {
                "avg_retrieval_time_ms": round(self.avg_retrieval_time * 1000, 2),
                "avg_embedding_time_ms": round(self.avg_embedding_time * 1000, 2)
            },
            "started_at": self.started_at,
            "uptime_seconds": (datetime.utcnow() - datetime.fromisoformat(self.started_at)).total_seconds()
        }
    
    def reset(self) -> None:
        logger.info("[RAG-Metrics] Resetting all metrics")
        self.__init__()


class RAGCache:
    def __init__(self, max_size: int = 100):
        self.cache: Dict[str, Any] = {}
        self.max_size = max_size
        self.access_count: Dict[str, int] = {}
        logger.info(f"[RAG-Cache] Cache initialized (max_size={max_size})")
    
    def get(self, key: str) -> Optional[Any]:
        if key in self.cache:
            self.access_count[key] = self.access_count.get(key, 0) + 1
            logger.debug(f"[RAG-Cache] Cache hit for key: {key[:50]}...")
            return self.cache[key]
        logger.debug(f"[RAG-Cache] Cache miss for key: {key[:50]}...")
        return None
    
    def set(self, key: str, value: Any) -> None:
        if len(self.cache) >= self.max_size:
            logger.debug(f"[RAG-Cache] Cache full, evicting least accessed entry")
            lru_key = min(self.access_count.items(), key=lambda x: x[1])[0]
            del self.cache[lru_key]
            del self.access_count[lru_key]
        
        self.cache[key] = value
        self.access_count[key] = 0
        logger.debug(f"[RAG-Cache] Cached value for key: {key[:50]}... (size: {len(self.cache)})")
    
    def clear(self) -> None:
        logger.info(f"[RAG-Cache] Clearing cache ({len(self.cache)} entries)")
        self.cache.clear()
        self.access_count.clear()
    
    def stats(self) -> Dict[str, Any]:
        return {
            "size": len(self.cache),
            "max_size": self.max_size,
            "utilization_percent": round((len(self.cache) / self.max_size) * 100, 2),
            "total_accesses": sum(self.access_count.values())
        }


metrics = RAGMetrics()
cache = RAGCache(max_size=100)


def format_context_for_prompt(documents: List[Dict[str, Any]]) -> str:
    logger.info(f"[RAG-Utils] Formatting {len(documents)} documents for prompt")
    
    if not documents:
        return ""
    
    context_parts = []
    for idx, doc in enumerate(documents, 1):
        content = doc.get("content", "")
        metadata = doc.get("metadata", {})
        score = doc.get("score", 0)
        
        source = metadata.get("source", "unknown")
        doc_type = metadata.get("type", "general")
        
        context_parts.append(f"[Source {idx} - {source}/{doc_type} - Relevance: {score:.2f}]\n{content}")
    
    formatted = "\n\n---\n\n".join(context_parts)
    logger.info(f"[RAG-Utils] Context formatted: {len(formatted)} characters")
    return formatted


def extract_entities(text: str) -> Dict[str, List[str]]:
    logger.debug(f"[RAG-Utils] Extracting entities from text (length: {len(text)})")
    
    entities = {
        "companies": [],
        "products": [],
        "technologies": [],
        "people": []
    }
    
    words = text.split()
    capitalized = [w for w in words if w and w[0].isupper() and len(w) > 2]
    entities["companies"] = list(set([w for w in capitalized if w.endswith('Inc') or w.endswith('Corp') or w.endswith('LLC')]))
    entities["people"] = list(set([w for w in capitalized if len(w) > 3]))[:10]
    
    logger.debug(f"[RAG-Utils] Extracted entities: {sum(len(v) for v in entities.values())} total")
    return entities


def calculate_semantic_similarity(text1: str, text2: str) -> float:
    logger.debug("[RAG-Utils] Calculating semantic similarity")
    
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    
    intersection = len(words1.intersection(words2))
    union = len(words1.union(words2))
    
    similarity = intersection / union if union > 0 else 0
    
    logger.debug(f"[RAG-Utils] Similarity calculated: {similarity:.3f}")
    return similarity


def serialize_documents_for_storage(documents: List[Any]) -> str:
    logger.debug(f"[RAG-Utils] Serializing {len(documents)} documents")
    
    serialized = []
    for doc in documents:
        serialized.append({
            "content": doc.page_content if hasattr(doc, 'page_content') else str(doc),
            "metadata": doc.metadata if hasattr(doc, 'metadata') else {}
        })
    
    json_str = json.dumps(serialized, indent=2)
    logger.debug(f"[RAG-Utils] Serialization complete: {len(json_str)} bytes")
    return json_str


def get_system_info() -> Dict[str, Any]:
    logger.debug("[RAG-Utils] Gathering system information")
    
    import platform
    import sys
    
    info = {
        "platform": platform.system(),
        "platform_version": platform.version(),
        "python_version": sys.version,
        "architecture": platform.machine(),
        "processor": platform.processor()
    }
    
    logger.debug(f"[RAG-Utils] System info gathered: {info['platform']} {info['architecture']}")
    return info
