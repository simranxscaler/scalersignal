from openai import OpenAI

client = OpenAI()

CHUNK_SIZE = 500    # characters
CHUNK_OVERLAP = 100


def chunk_text(text: str) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunks.append(text[start:end].strip())
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return [c for c in chunks if c]


def embed_chunks(chunks: list[str]) -> list[list[float]]:
    resp = client.embeddings.create(
        model="text-embedding-3-small",
        input=chunks
    )
    return [item.embedding for item in resp.data]


def embed_query(query: str) -> list[float]:
    resp = client.embeddings.create(
        model="text-embedding-3-small",
        input=[query]
    )
    return resp.data[0].embedding
