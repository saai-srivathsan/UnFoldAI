# RAG Knowledge Base Storage

This directory contains the FAISS vector index and associated metadata for the RAG system.

## Files

- `rag_index.faiss` - FAISS vector index containing document embeddings
- `rag_index.faiss.metadata.json` - Metadata about indexed documents
- `.gitkeep` - Keeps directory in version control

## Usage

The RAG system automatically manages this directory. The index is:
- Created on first startup if not present
- Updated when new documents are added
- Persisted across application restarts

## Maintenance

To rebuild the index from scratch, delete all files except `.gitkeep` and restart the application.
