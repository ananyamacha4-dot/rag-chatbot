import json
import numpy as np

from app.embedder import create_embedding


def cosine_similarity(
    a,
    b
):

    a = np.array(a)
    b = np.array(b)

    return np.dot(a, b) / (
        np.linalg.norm(a)
        * np.linalg.norm(b)
    )


def search_chunks(
    query: str,
    chunks
):

    query_embedding = create_embedding(
        query
    )

    scores = []

    for chunk in chunks:

        if not chunk.embedding:
            continue

        chunk_embedding = json.loads(
            chunk.embedding
        )

        score = cosine_similarity(
            query_embedding,
            chunk_embedding
        )

        scores.append(
            (
                score,
                chunk.content
            )
        )

    scores.sort(
        key=lambda x: x[0],
        reverse=True
    )

    return scores[:3]