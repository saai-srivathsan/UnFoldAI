import asyncio
import logging
from rag_agent import get_rag_agent, enhance_with_rag
from document_processor import doc_processor
from rag_integration import init_rag_system, rag_integration
from langchain_core.documents import Document

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


async def test_basic_operations():
    logger.info("=== Testing Basic RAG Operations ===")
    
    logger.info("\n1. Initializing RAG system...")
    await init_rag_system()
    
    logger.info("\n2. Getting RAG agent instance...")
    agent = get_rag_agent()
    
    logger.info("\n3. Adding test documents...")
    test_docs = [
        Document(
            page_content="Enterprise sales requires building relationships with multiple stakeholders across different departments.",
            metadata={"source": "test", "type": "best_practice", "topic": "sales"}
        ),
        Document(
            page_content="Account mapping involves identifying key decision makers, influencers, and champions within the organization.",
            metadata={"source": "test", "type": "definition", "topic": "account_planning"}
        ),
        Document(
            page_content="Value propositions should address specific business outcomes like cost reduction, revenue growth, or efficiency gains.",
            metadata={"source": "test", "type": "strategy", "topic": "messaging"}
        )
    ]
    
    agent.vector_store.add_documents(test_docs)
    logger.info(f"Added {len(test_docs)} test documents")
    
    logger.info("\n4. Testing similarity search...")
    query = "How to build relationships in enterprise accounts?"
    results = agent.retrieve_context(query, k=2)
    logger.info(f"Retrieved {len(results)} results for query: '{query}'")
    for i, doc in enumerate(results, 1):
        score = doc.metadata.get("similarity_score", 0)
        logger.info(f"  Result {i} (score: {score:.3f}): {doc.page_content[:100]}...")
    
    logger.info("\n5. Testing query augmentation...")
    augmented = await enhance_with_rag(query, context_k=2)
    logger.info(f"Original query length: {len(query)} chars")
    logger.info(f"Augmented query length: {len(augmented)} chars")
    
    logger.info("\n6. Getting statistics...")
    stats = agent.get_statistics()
    logger.info(f"Total documents in index: {stats['total_documents']}")
    logger.info(f"Index dimension: {stats['index_dimension']}")
    logger.info(f"Knowledge base loaded: {stats['knowledge_base_loaded']}")


async def test_document_processing():
    logger.info("\n=== Testing Document Processing ===")
    
    logger.info("\n1. Testing text chunking...")
    long_text = """
    Account planning is a strategic approach to managing key customer relationships.
    It involves deep research into the customer's business, understanding their goals,
    challenges, and organizational structure. Effective account planning requires
    coordination across multiple teams including sales, customer success, and product.
    The process typically includes stakeholder mapping, value proposition development,
    and strategic roadmap creation. Regular reviews and updates ensure the plan
    remains aligned with the customer's evolving needs.
    """ * 3  # Make it longer
    
    chunks = doc_processor.chunk_text(long_text, metadata={"source": "test", "doc": "planning_guide"})
    logger.info(f"Created {len(chunks)} chunks from text of length {len(long_text)}")
    for i, chunk in enumerate(chunks, 1):
        logger.info(f"  Chunk {i}: {len(chunk.page_content)} chars, index: {chunk.metadata.get('chunk_index')}")
    
    logger.info("\n2. Testing keyword extraction...")
    keywords = doc_processor.extract_keywords(long_text, top_k=5)
    logger.info(f"Extracted keywords: {', '.join(keywords)}")
    
    logger.info("\n3. Testing file processing...")
    file_content = "This is a sample file content about enterprise account management strategies."
    file_docs = doc_processor.process_file_content(
        content=file_content,
        filename="enterprise_guide.txt",
        file_id="file-123456"
    )
    logger.info(f"Processed file into {len(file_docs)} documents")


async def test_integration():
    logger.info("\n=== Testing RAG Integration ===")
    
    logger.info("\n1. Checking integration status...")
    status = await rag_integration.get_statistics()
    logger.info(f"Integration status: {status}")
    
    logger.info("\n2. Testing query enhancement (disabled mode)...")
    test_query = "Tell me about account planning best practices"
    enhanced = await rag_integration.enhance_user_query(test_query, use_rag=False)
    logger.info(f"Query unchanged (as expected): {enhanced == test_query}")
    
    logger.info("\n3. Testing context retrieval...")
    context = await rag_integration.retrieve_relevant_context(
        query="stakeholder mapping techniques",
        k=3
    )
    logger.info(f"Retrieved {len(context)} context items")
    for i, item in enumerate(context, 1):
        logger.info(f"  Context {i}: score={item['score']:.3f}, source={item['metadata'].get('source')}")


async def test_metrics_and_cache():
    logger.info("\n=== Testing Metrics and Caching ===")
    
    from rag_utils import metrics, cache
    
    logger.info("\n1. Recording test metrics...")
    metrics.record_query(retrieval_time=0.123)
    metrics.record_query(retrieval_time=0.098)
    metrics.record_indexing(document_count=5, embedding_time=0.456)
    metrics.record_cache_hit()
    metrics.record_cache_miss()
    metrics.record_cache_miss()
    
    logger.info("\n2. Getting metrics summary...")
    metrics_dict = metrics.to_dict()
    logger.info(f"Queries processed: {metrics_dict['queries_processed']}")
    logger.info(f"Documents indexed: {metrics_dict['documents_indexed']}")
    logger.info(f"Cache hit rate: {metrics_dict['cache_statistics']['hit_rate_percent']}%")
    logger.info(f"Avg retrieval time: {metrics_dict['performance']['avg_retrieval_time_ms']}ms")
    
    logger.info("\n3. Testing cache operations...")
    cache.set("test_key_1", {"data": "test_value_1"})
    cache.set("test_key_2", {"data": "test_value_2"})
    
    result = cache.get("test_key_1")
    logger.info(f"Cache get result: {result}")
    
    cache_stats = cache.stats()
    logger.info(f"Cache size: {cache_stats['size']}/{cache_stats['max_size']}")
    logger.info(f"Cache utilization: {cache_stats['utilization_percent']}%")


async def main():
    logger.info("Starting RAG System Test Suite\n")
    
    try:
        await test_basic_operations()
        await test_document_processing()
        await test_integration()
        await test_metrics_and_cache()
        
        logger.info("\n" + "="*50)
        logger.info("All tests completed successfully!")
        logger.info("="*50)
        
    except Exception as e:
        logger.error(f"\nTest failed with error: {e}", exc_info=True)


if __name__ == "__main__":
    asyncio.run(main())
