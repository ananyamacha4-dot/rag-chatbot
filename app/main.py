import json
import re
from pathlib import Path
from datetime import datetime

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pypdf import PdfReader
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import create_access_token
from app.chunker import chunk_text
from app.database import engine
from app.dependencies import get_db
from app.embedder import create_embedding
from app.models import Chunk, Document, Message, User
from app.schemas import LoginData, MessageData
from app.schemas import QuestionData
from app.search import search_chunks
from app.security import hash_password, verify_password

app = FastAPI()

User.metadata.create_all(bind=engine)
Message.metadata.create_all(bind=engine)
Document.metadata.create_all(bind=engine)
Chunk.metadata.create_all(bind=engine)


def ensure_database_columns():
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id INTEGER")
        )
        connection.execute(
            text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS content TEXT")
        )
        connection.execute(
            text("ALTER TABLE chunks ADD COLUMN IF NOT EXISTS document_id INTEGER")
        )
        connection.execute(
            text("ALTER TABLE chunks ADD COLUMN IF NOT EXISTS content TEXT")
        )
        connection.execute(
            text("ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding TEXT")
        )


ensure_database_columns()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
FALLBACK_ANSWER = "I couldn't find that information in the uploaded documents."
MIN_RELEVANCE_SCORE = 0.25

RAG_PROMPT = """You are an intelligent Retrieval-Augmented Generation (RAG) assistant.

Your primary objective is to answer questions using ONLY the retrieved document context.

Rules:

* Use retrieved context as the source of truth.
* Never hallucinate or invent information.
* If information is missing, respond:
  "I couldn't find that information in the uploaded documents."
* Use chat history only for conversational continuity.
* Prioritize factual accuracy over completeness.
* Merge information from multiple retrieved chunks when appropriate.
* Ignore irrelevant context.
* Present answers clearly using bullet points, numbered lists, or short paragraphs when helpful.
* Keep responses concise, relevant, and professional.
* Preserve important dates, names, values, and technical details exactly as they appear in the source documents.

Chat History:
{chat_history}

Retrieved Context:
{retrieved_context}

User Question:
{user_question}

Answer:"""

QUERY_REWRITE_PROMPT = """Given a user question, generate an optimized semantic search query that:

* Preserves intent
* Preserves entities
* Preserves technical terms
* Removes conversational filler
* Improves vector retrieval accuracy

Output only the optimized search query."""

app.mount(
    "/ui",
    StaticFiles(directory=FRONTEND_DIR, html=True),
    name="ui"
)


def clean_context_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    return text


def rewrite_query(question: str) -> str:
    query = clean_context_text(question)
    filler_patterns = [
        r"\b(can|could|would)\s+you\s+",
        r"\bplease\s+",
        r"\btell\s+me\s+",
        r"\bfrom\s+the\s+(uploaded\s+)?documents?\s*",
        r"\bin\s+the\s+(uploaded\s+)?documents?\s*",
        r"\baccording\s+to\s+the\s+(uploaded\s+)?documents?\s*",
    ]

    for pattern in filler_patterns:
        query = re.sub(pattern, "", query, flags=re.IGNORECASE)

    query = query.strip(" ?.")
    return query or question


def format_chat_history(db: Session, user_id: int | None):
    if not user_id:
        return ""

    messages = db.query(Message).filter(
        Message.user_id == user_id
    ).order_by(
        Message.id.desc()
    ).limit(10).all()

    history_lines = []

    for msg in reversed(messages):
        try:
            payload = json.loads(msg.message)
        except (TypeError, json.JSONDecodeError):
            history_lines.append(f"User: {msg.message}")
            continue

        question = payload.get("question")
        answer = payload.get("answer")

        if question:
            history_lines.append(f"User: {question}")
        if answer:
            history_lines.append(f"Assistant: {answer}")

    return "\n".join(history_lines)


def store_chat_message(
    db: Session,
    user_id: int | None,
    question: str,
    answer: str,
    optimized_query: str
):
    if not user_id:
        return None

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    payload = {
        "type": "rag_chat",
        "question": question,
        "answer": answer,
        "optimized_query": optimized_query,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }

    new_message = Message(
        user_id=user_id,
        message=json.dumps(payload)
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    return new_message


def build_answer(results):
    usable_results = [
        (float(score), clean_context_text(content))
        for score, content in results
        if clean_context_text(content)
    ]

    if not usable_results:
        return FALLBACK_ANSWER

    top_score = usable_results[0][0]

    if top_score < MIN_RELEVANCE_SCORE:
        return FALLBACK_ANSWER

    relevant_texts = [
        content
        for score, content in usable_results
        if score >= MIN_RELEVANCE_SCORE
    ]

    if not relevant_texts:
        return FALLBACK_ANSWER

    if len(relevant_texts) == 1:
        return relevant_texts[0]

    return "\n".join(
        f"- {content}"
        for content in relevant_texts
    )


def backfill_missing_embeddings(
    db: Session,
    chunks
):
    changed = False

    for chunk in chunks:
        if chunk.content and not chunk.embedding:
            chunk.embedding = json.dumps(
                create_embedding(chunk.content)
            )
            changed = True

    if changed:
        db.commit()


@app.get("/")
def home():
    return {"message": "Server Running"}


@app.post("/signup")
def signup(
    data: LoginData,
    db: Session = Depends(get_db)
):

    new_user = User(
        username=data.username,
        password=hash_password(data.password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User Created",
        "id": new_user.id
    }


@app.get("/users")
def get_users(
    db: Session = Depends(get_db)
):

    users = db.query(User).all()

    return [
        {
            "id": user.id,
            "username": user.username
        }
        for user in users
    ]


@app.post("/message")
def create_message(
    data: MessageData,
    db: Session = Depends(get_db)
):

    user = db.query(User).filter(
        User.id == data.user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    new_message = Message(
        user_id=data.user_id,
        message=data.message
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    return {
        "message": "Message Stored",
        "id": new_message.id
    }


@app.get("/messages")
def get_messages(
    db: Session = Depends(get_db)
):

    messages = db.query(Message).all()

    return [
        {
            "message_id": msg.id,
            "user_id": msg.user_id,
            "message": msg.message
        }
        for msg in messages
    ]


@app.get("/messages/{user_id}")
def get_user_messages(
    user_id: int,
    db: Session = Depends(get_db)
):

    messages = db.query(Message).filter(
        Message.user_id == user_id
    ).all()

    return [
        {
            "message_id": msg.id,
            "user_id": msg.user_id,
            "message": msg.message
        }
        for msg in messages
    ]
@app.post("/login")
def login(
    data: LoginData,
    db: Session = Depends(get_db)
):

    user = db.query(User).filter(
        User.username == data.username
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if not verify_password(
        data.password,
        user.password
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid password"
        )

    access_token = create_access_token(
        {
            "user_id": user.id,
            "username": user.username
        }
    )

    return {
        "message": "Login Successful",
        "access_token": access_token,
        "user_id": user.id,
        "username": user.username,
        "user": {
            "id": user.id,
            "username": user.username
        }
    }


@app.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    user_id: int = Form(...),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    file_path = f"uploads/{file.filename}"

    with open(file_path, "wb") as buffer:
        buffer.write(
            await file.read()
        )

    reader = PdfReader(file_path)

    text = ""

    for page in reader.pages:
        extracted = page.extract_text()

        if extracted:
            text += extracted

    new_document = Document(
        user_id=user_id,
        filename=file.filename,
        content=text
    )

    db.add(new_document)
    db.commit()
    db.refresh(new_document)

    chunks = chunk_text(text)

    for chunk in chunks:

        embedding = create_embedding(
            chunk
        )

        new_chunk = Chunk(
            document_id=new_document.id,
            content=chunk,
            embedding=json.dumps(
                embedding
            )
        )

        db.add(new_chunk)

    db.commit()

    return {
        "document_id": new_document.id,
        "filename": file.filename,
        "characters": len(text),
        "chunks": len(chunks),
        "preview": text[:500]
    }
@app.get("/documents")
def get_documents(
    user_id: int,
    db: Session = Depends(get_db)
):

    documents = db.query(Document).filter(
        Document.user_id == user_id
    ).all()

    return [
        {
            "id": doc.id,
            "filename": doc.filename,
            "characters": len(doc.content or ""),
            "chunks": db.query(Chunk).filter(
                Chunk.document_id == doc.id
            ).count()
        }
        for doc in documents
    ]


@app.delete("/documents/{document_id}")
def delete_document(
    document_id: int,
    user_id: int,
    db: Session = Depends(get_db)
):
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == user_id
    ).first()

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )

    filename = document.filename

    db.query(Chunk).filter(
        Chunk.document_id == document.id
    ).delete(synchronize_session=False)

    db.delete(document)
    db.commit()

    remaining_document = db.query(Document).filter(
        Document.filename == filename
    ).first()

    if not remaining_document:
        upload_path = Path("uploads") / filename
        try:
            upload_path.unlink(missing_ok=True)
        except OSError:
            pass

    return {
        "message": "Document deleted",
        "document_id": document_id
    }
@app.post("/ask")
def ask_question(
    data: QuestionData,
    db: Session = Depends(get_db)
):

    chunks = []

    if data.user_id:
        chunks = db.query(Chunk).join(
            Document,
            Document.id == Chunk.document_id
        ).filter(
            Document.user_id == data.user_id
        ).all()

    backfill_missing_embeddings(
        db,
        chunks
    )

    optimized_query = rewrite_query(
        data.question
    )

    results = search_chunks(
        optimized_query,
        chunks
    )

    return {
        "question": data.question,
        "optimized_query": optimized_query,
        "results": results
    }


@app.post("/chat")
def chat_with_documents(
    data: QuestionData,
    db: Session = Depends(get_db)
):

    chunks = db.query(Chunk).join(
        Document,
        Document.id == Chunk.document_id
    ).filter(
        Document.user_id == data.user_id
    ).all()

    backfill_missing_embeddings(
        db,
        chunks
    )

    optimized_query = rewrite_query(
        data.question
    )

    results = search_chunks(
        optimized_query,
        chunks
    )

    answer = build_answer(results)
    chat_history = format_chat_history(
        db,
        data.user_id
    )

    stored_message = store_chat_message(
        db,
        data.user_id,
        data.question,
        answer,
        optimized_query
    )

    context = [
        {
            "score": float(score),
            "content": clean_context_text(content)
        }
        for score, content in results
    ]

    return {
        "question": data.question,
        "optimized_query": optimized_query,
        "answer": answer,
        "context": context,
        "chat_history": chat_history,
        "message_id": stored_message.id if stored_message else None
    }
