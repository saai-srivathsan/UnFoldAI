import logging
from typing import List, Dict, Any, Optional
from langchain_core.documents import Document
from datetime import datetime
import re

logger = logging.getLogger(__name__)

class DocumentProcessor:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        logger.info(f"[RAG-DocProc] Document processor initialized (chunk_size={chunk_size}, overlap={chunk_overlap})")
    
    def chunk_text(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[Document]:
        logger.info(f"[RAG-DocProc] Chunking text of length {len(text)} characters")
        
        if not text or not text.strip():
            logger.warning("[RAG-DocProc] Empty text provided for chunking")
            return []
        
        if metadata is None:
            metadata = {}
        
        chunks = []
        start = 0
        chunk_index = 0
        
        while start < len(text):
            end = start + self.chunk_size
            
            if end < len(text):
                last_period = text.rfind('.', start, end)
                last_newline = text.rfind('\n', start, end)
                break_point = max(last_period, last_newline)
                
                if break_point > start:
                    end = break_point + 1
            else:
                end = len(text)
            
            chunk_text = text[start:end].strip()
            
            if chunk_text:
                chunk_metadata = metadata.copy()
                chunk_metadata.update({
                    "chunk_index": chunk_index,
                    "chunk_start": start,
                    "chunk_end": end,
                    "processed_at": datetime.utcnow().isoformat()
                })
                
                chunks.append(Document(
                    page_content=chunk_text,
                    metadata=chunk_metadata
                ))
                chunk_index += 1
            
            start = end - self.chunk_overlap
            if start < 0:
                start = end
        
        logger.info(f"[RAG-DocProc] Created {len(chunks)} chunks from text")
        return chunks
    
    def process_conversation(self, messages: List[Any]) -> List[Document]:
        logger.info(f"[RAG-DocProc] Processing {len(messages)} conversation messages")
        
        documents = []
        
        for idx, message in enumerate(messages):
            content = message.content if hasattr(message, 'content') else str(message)
            msg_type = message.type if hasattr(message, 'type') else 'unknown'
            
            if not content or len(content.strip()) < 10:
                continue
            
            metadata = {
                "source": "conversation",
                "message_index": idx,
                "message_type": msg_type,
                "processed_at": datetime.utcnow().isoformat()
            }
            
            if len(content) > self.chunk_size:
                chunks = self.chunk_text(content, metadata)
                documents.extend(chunks)
            else:
                documents.append(Document(
                    page_content=content,
                    metadata=metadata
                ))
        
        logger.info(f"[RAG-DocProc] Processed conversation into {len(documents)} documents")
        return documents
    
    def process_account_plan(self, plan: Dict[str, Any]) -> List[Document]:
        logger.info(f"[RAG-DocProc] Processing account plan: {plan.get('id', 'unknown')}")
        
        documents = []
        
        if plan.get('company'):
            doc = Document(
                page_content=f"Company: {plan['company']}",
                metadata={
                    "source": "account_plan",
                    "plan_id": plan.get("id", "unknown"),
                    "type": "company",
                    "processed_at": datetime.utcnow().isoformat()
                }
            )
            documents.append(doc)
        
        if plan.get('goal'):
            doc = Document(
                page_content=f"Goal: {plan['goal']}",
                metadata={
                    "source": "account_plan",
                    "plan_id": plan.get("id", "unknown"),
                    "type": "goal",
                    "processed_at": datetime.utcnow().isoformat()
                }
            )
            documents.append(doc)
        
        sections = plan.get('sections', [])
        for section_idx, section in enumerate(sections):
            section_title = section.get('title', f'Section {section_idx}')
            section_content = section.get('content', '')
            
            if isinstance(section_content, dict):
                section_content = str(section_content)
            elif isinstance(section_content, list):
                section_content = '\n'.join(str(item) for item in section_content)
            
            full_content = f"{section_title}\n\n{section_content}"
            
            metadata = {
                "source": "account_plan",
                "plan_id": plan.get("id", "unknown"),
                "type": "section",
                "section_title": section_title,
                "section_index": section_idx,
                "processed_at": datetime.utcnow().isoformat()
            }
            
            if len(full_content) > self.chunk_size:
                chunks = self.chunk_text(full_content, metadata)
                documents.extend(chunks)
            else:
                documents.append(Document(
                    page_content=full_content,
                    metadata=metadata
                ))
        
        logger.info(f"[RAG-DocProc] Processed account plan into {len(documents)} documents")
        return documents
    
    def process_file_content(self, content: str, filename: str, file_id: str) -> List[Document]:
        logger.info(f"[RAG-DocProc] Processing file: {filename} (id: {file_id})")
        
        metadata = {
            "source": "uploaded_file",
            "filename": filename,
            "file_id": file_id,
            "processed_at": datetime.utcnow().isoformat()
        }
        
        if len(content) > self.chunk_size:
            chunks = self.chunk_text(content, metadata)
            logger.info(f"[RAG-DocProc] File processed into {len(chunks)} chunks")
            return chunks
        else:
            doc = Document(page_content=content, metadata=metadata)
            logger.info(f"[RAG-DocProc] File processed as single document")
            return [doc]
    
    def extract_keywords(self, text: str, top_k: int = 10) -> List[str]:
        logger.debug(f"[RAG-DocProc] Extracting keywords from text (length: {len(text)})")
        
        text_lower = text.lower()
        
        words = re.findall(r'\b[a-z]{3,}\b', text_lower)
        
        stop_words = {
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 
            'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him',
            'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way',
            'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too',
            'use', 'with', 'from', 'have', 'this', 'that', 'will', 'what',
            'when', 'your', 'said', 'each', 'tell', 'does', 'into', 'they',
            'than', 'them', 'been', 'call', 'find', 'long', 'down', 'made',
            'many', 'more', 'over', 'such', 'take', 'well', 'were', 'come',
            'here', 'just', 'like', 'look', 'make', 'some', 'their', 'time',
            'very', 'then', 'these', 'about', 'would', 'write', 'could',
            'first', 'other', 'people', 'think', 'where', 'which', 'because'
        }
        
        filtered_words = [w for w in words if w not in stop_words]
        
        word_freq = {}
        for word in filtered_words:
            word_freq[word] = word_freq.get(word, 0) + 1
        
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        
        keywords = [word for word, freq in sorted_words[:top_k]]
        
        logger.debug(f"[RAG-DocProc] Extracted {len(keywords)} keywords: {', '.join(keywords[:5])}...")
        return keywords


doc_processor = DocumentProcessor()


async def process_and_index_conversation(messages: List[Any], rag_agent) -> None:
    logger.info("[RAG-DocProc] Starting conversation indexing process")
    
    documents = doc_processor.process_conversation(messages)
    
    if documents:
        rag_agent.vector_store.add_documents(documents)
        logger.info(f"[RAG-DocProc] Indexed {len(documents)} conversation documents")
    else:
        logger.warning("[RAG-DocProc] No documents generated from conversation")


async def process_and_index_plan(plan: Dict[str, Any], rag_agent) -> None:
    logger.info("[RAG-DocProc] Starting account plan indexing process")
    
    documents = doc_processor.process_account_plan(plan)
    
    if documents:
        rag_agent.vector_store.add_documents(documents)
        logger.info(f"[RAG-DocProc] Indexed {len(documents)} plan documents")
    else:
        logger.warning("[RAG-DocProc] No documents generated from plan")
