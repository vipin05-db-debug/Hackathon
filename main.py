from __future__ import annotations

import asyncio
import base64
import ipaddress
import json
import logging
import socket
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlparse

import httpx
import pymupdf

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from starlette.datastructures import UploadFile as StarletteUploadFile

from google import genai
from google.genai import types

from pydantic_settings import BaseSettings, SettingsConfigDict

from prompts import SYSTEM_PROMPT


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("trustlens")


class Settings(BaseSettings):
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    tavily_api_key: str = ""
    groq_api_key: str = ""
    groq_model: str = "qwen/qwen3.8-27b"
    gemini_timeout_seconds: float = 4.0
    groq_timeout_seconds: float = 6.0

    frontend_origin: str = "http://localhost:5173"

    max_upload_mb: int = 10
    max_sources: int = 5
    max_pdf_pages: int = 15

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()

app = FastAPI(
    title="TRUSTLENS AI API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_origin,
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"]
)


def sse(event: str, **data: Any) -> str:
    return (
        f"event: {event}\n"
        f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
    )


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "gemini_configured": bool(settings.gemini_api_key),
        "search_configured": bool(settings.tavily_api_key),
        "groq_configured": bool(settings.groq_api_key),
        "primary_model": settings.gemini_model,
        "fallback_model": settings.groq_model
    }


class TextExtractor(HTMLParser):

    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript", "svg"):
            self.skip += 1

        if tag in ("p", "div", "li", "br", "h1", "h2", "h3"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "svg"):
            self.skip = max(0, self.skip - 1)

        if tag in ("p", "div", "li", "h1", "h2", "h3"):
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.skip:
            value = " ".join(data.split())
            if value:
                self.parts.append(value)


def validate_url(url: str):
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("Only HTTP and HTTPS website URLs are supported.")

    host = parsed.hostname.lower()

    if host in ("localhost", "localhost.localdomain"):
        raise ValueError("Localhost URLs are not allowed.")

    try:
        addresses = socket.getaddrinfo(host, None)

        for item in addresses:
            address = ipaddress.ip_address(item[4][0])

            if not address.is_global:
                raise ValueError("Private network URLs are not allowed.")

    except socket.gaierror:
        raise ValueError("Website hostname could not be resolved.")


async def fetch_user_url(url: str):

    validate_url(url)

    async with httpx.AsyncClient(
        timeout=15,
        follow_redirects=False,
        headers={
            "User-Agent": "TrustLensResearchBot/1.0"
        }
    ) as client:

        response = await client.get(url)
        response.raise_for_status()

        content_type = response.headers.get(
            "content-type", ""
        ).lower()

        if "text/html" not in content_type and "text/plain" not in content_type:
            raise ValueError("This URL does not return readable webpage text.")

        parser = TextExtractor()
        parser.feed(response.text[:250000])

        content = " ".join(
            " ".join(parser.parts).split()
        )[:12000]

        return {
            "title": str(response.url),
            "url": str(response.url),
            "content": content
        }


async def search_web(query: str):

    if not settings.tavily_api_key:
        return []

    async with httpx.AsyncClient(timeout=15) as client:

        response = await client.post(
            "https://api.tavily.com/search",
            headers={
                "Authorization": f"Bearer {settings.tavily_api_key}",
                "Content-Type": "application/json"
            },
            json={
                "query": query,
                "search_depth": "basic",
                "max_results": settings.max_sources,
                "include_answer": False
            }
        )

        response.raise_for_status()

        data = response.json()

    return [
        {
            "title": item.get("title", "Untitled source"),
            "url": item.get("url"),
            "content": item.get("content", "")
        }
        for item in data.get("results", [])
    ]


def detect_mode(text: str):

    value = text.lower()

    research_terms = [
        "research", "investigate", "verify", "fact check",
        "compare", "analysis", "evidence", "latest",
        "current status", "information gap", "deep dive",
        "official source", "is this correct"
    ]

    if any(term in value for term in research_terms):
        return "research"

    return "chat"


def build_prompt(
    text: str,
    domain: str,
    mode: str,
    sources: list,
    documents: list
):

    source_text = "\n\n".join(
        f"[S{i}]\n"
        f"Title: {source['title']}\n"
        f"URL: {source['url']}\n"
        f"Content: {source['content'][:3500]}"
        for i, source in enumerate(sources, 1)
    )

    document_text = "\n\n".join(documents)

    return f"""
USER DOMAIN:
{domain}

REQUEST MODE:
{mode}

USER QUESTION:
{text}

UPLOADED DOCUMENT CONTENT:
{document_text[:30000] if document_text else "No document text supplied."}

RETRIEVED WEB EVIDENCE:
{source_text if source_text else "No web sources retrieved."}

INSTRUCTIONS:

Understand the user's actual request.

For normal conversation:
Answer directly and naturally.

For research:
Provide an evidence-based investigation.

For document analysis:
Use the uploaded material as the primary source.
Do not invent missing document content.

For image analysis:
Analyse the actual supplied image.

For editing:
Preserve the original meaning and make only requested changes.

Follow any explicit formatting instructions from the user.

Use source references [S1], [S2] only where supported.

Do not create a separate bibliography.
The application will attach the source list.

Avoid repeated paragraphs and unnecessary sections.
"""


async def extract_uploads(files):

    documents = []
    image_parts = []
    total_size = 0

    for upload in files:

        raw = await upload.read()

        if not raw:
            continue

        total_size += len(raw)

        if total_size > settings.max_upload_mb * 1024 * 1024:
            raise ValueError(
                f"Combined upload size exceeds {settings.max_upload_mb} MB."
            )

        filename = upload.filename or "uploaded-file"
        mime = (upload.content_type or "").lower()

        if filename.lower().endswith(".pdf") or mime == "application/pdf":

            pdf = pymupdf.open(
                stream=raw,
                filetype="pdf"
            )

            try:
                page_count = min(
                    len(pdf),
                    settings.max_pdf_pages
                )

                for index in range(page_count):

                    page = pdf[index]
                    page_text = page.get_text("text").strip()

                    if page_text:
                        documents.append(
                            f"PDF: {filename}\n"
                            f"Page: {index + 1}\n"
                            f"{page_text[:5000]}"
                        )

                    else:
                        pixmap = page.get_pixmap(
                            matrix=pymupdf.Matrix(1.5, 1.5),
                            alpha=False
                        )

                        image_parts.append(
                            types.Part.from_bytes(
                                data=pixmap.tobytes("png"),
                                mime_type="image/png"
                            )
                        )

            finally:
                pdf.close()

        elif mime in (
            "image/png",
            "image/jpeg",
            "image/webp"
        ):

            image_parts.append(
                types.Part.from_bytes(
                    data=raw,
                    mime_type=mime
                )
            )

        else:
            raise ValueError(
                f"Unsupported file: {filename}. "
                "Use PDF, PNG, JPG or WEBP."
            )

    return documents, image_parts


async def _generate_with_gemini(prompt: str, image_parts: list) -> str:
    """Generate a complete Gemini answer before sending it to the browser.

    Buffering prevents a partial Gemini answer from being mixed with a Groq
    fallback if Gemini fails halfway through generation.
    """
    if not settings.gemini_api_key:
        raise RuntimeError("Gemini API key is not configured.")

    client = genai.Client(api_key=settings.gemini_api_key)
    parts = [types.Part.from_text(text=prompt), *image_parts]
    answer_parts = []

    try:
        async with asyncio.timeout(settings.gemini_timeout_seconds):
            stream = await client.aio.models.generate_content_stream(
                model=settings.gemini_model,
                contents=[types.Content(role="user", parts=parts)],
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.2,
                    max_output_tokens=3000
                )
            )

            async for chunk in stream:
                if chunk.text:
                    answer_parts.append(chunk.text)

        answer = "".join(answer_parts).strip()
        if not answer:
            raise RuntimeError("Gemini returned an empty response.")
        return answer
    finally:
        await client.aio.aclose()


def _groq_image_parts(image_parts: list) -> list:
    """Convert Gemini image Parts to Groq/OpenAI-compatible data URLs."""
    content = []
    for part in image_parts:
        inline = getattr(part, "inline_data", None)
        if not inline:
            continue

        raw = getattr(inline, "data", None)
        mime = getattr(inline, "mime_type", None) or "image/png"
        if isinstance(raw, str):
            raw = raw.encode("utf-8")
        if raw:
            encoded = base64.b64encode(raw).decode("ascii")
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{mime};base64,{encoded}"
                }
            })
    return content


async def _generate_with_groq(prompt: str, image_parts: list) -> str:
    """Generate a complete Groq answer using Groq's streaming endpoint."""
    if not settings.groq_api_key:
        raise RuntimeError("Groq fallback is not configured (GROQ_API_KEY missing).")

    user_content = [{"type": "text", "text": prompt}]
    
    if len(image_parts) > 3:
        logger.warning("Groq vision accepts up to 3 images; using the first 3 of %s.", len(image_parts))
    user_content.extend(_groq_image_parts(image_parts[:3]))

    payload = {
        "model": settings.groq_model,
        "stream": True,
        "temperature": 0.7,
        "max_completion_tokens": 3000,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content}
        ]
    }

    timeout = httpx.Timeout(
        connect=3.0,
        read=settings.groq_timeout_seconds,
        write=3.0,
        pool=2.0
    )
    answer_parts = []

    async with asyncio.timeout(settings.groq_timeout_seconds):
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.groq_api_key}",
                    "Content-Type": "application/json"
                },
                json=payload
            ) as response:
                if response.status_code >= 400:
                    body = (await response.aread()).decode(
                        "utf-8", errors="replace"
                    )
                    raise RuntimeError(
                        f"Groq API returned HTTP {response.status_code}: {body[:500]}"
                    )

                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue

                    data = line[5:].strip()
                    if not data or data == "[DONE]":
                        continue

                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        continue

                    choices = event.get("choices") or []
                    if not choices:
                        continue

                    delta = choices[0].get("delta") or {}
                    content = delta.get("content")
                    if isinstance(content, str) and content:
                        answer_parts.append(content)

    answer = "".join(answer_parts).strip()
    if not answer:
        raise RuntimeError("Groq returned an empty response.")
    return answer


async def generate_answer(prompt: str, image_parts: list):
    """Try Gemini first, then automatically fall back to Groq.

    The full provider response is buffered before SSE tokens are emitted.
    This avoids showing a partial Gemini answer followed by a second Groq
    answer in the same dashboard message.
    """
    try:
        if not settings.gemini_api_key:
            raise RuntimeError("Gemini API key is not configured.")

        logger.info("Trying primary AI provider: Gemini (%s)", settings.gemini_model)
        answer = await _generate_with_gemini(prompt, image_parts)
        logger.info("Gemini response completed successfully.")
        provider = "Gemini"
    except Exception as gemini_error:
        logger.warning(
            "Gemini failed or timed out; switching to Groq. Reason: %s",
            str(gemini_error)[:300]
        )

        try:
            logger.info("Trying fallback AI provider: Groq (%s)", settings.groq_model)
            answer = await _generate_with_groq(prompt, image_parts)
            logger.info("Groq fallback response completed successfully.")
            provider = "Groq"
        except Exception as groq_error:
            logger.exception("Both Gemini and Groq providers failed.")
            raise RuntimeError(
                "Our AI services are temporarily unavailable. "
                "Please try again in a moment."
            ) from groq_error


    for index in range(0, len(answer), 160):
        yield answer[index:index + 160]

    logger.info("Answer delivered by %s.", provider)


async def investigation_events(
    text: str,
    domain: str,
    urls: list[str],
    files: list[UploadFile]
):

    try:

        yield sse(
            "progress",
            step=1,
            message="Understanding your question..."
        )

        mode = detect_mode(text)

        documents, image_parts = await extract_uploads(files)

        yield sse(
            "progress",
            step=2,
            message="Reading documents and collecting evidence..."
        )

        search_task = None

        if mode == "research" and len(text.strip()) >= 8:
            search_task = search_web(text)

        url_tasks = [
            fetch_user_url(url)
            for url in urls
        ]

        tasks = []

        if search_task:
            tasks.append(search_task)

        tasks.extend(url_tasks)

        results = []

        if tasks:
            results = await asyncio.gather(
                *tasks,
                return_exceptions=True
            )

        sources = []

        for result in results:

            if isinstance(result, Exception):
                logger.warning("Source retrieval failed: %s", result)
                continue

            if isinstance(result, list):
                sources.extend(result)

            elif isinstance(result, dict):
                sources.append(result)

        unique_sources = {}

        for source in sources:

            url = source.get("url")

            if url:
                unique_sources[url] = source

        sources = list(unique_sources.values())[:8]

        yield sse(
            "progress",
            step=3,
            message="Analysing information and checking evidence..."
        )

        prompt = build_prompt(
            text,
            domain,
            mode,
            sources,
            documents
        )

        yield sse(
            "meta",
            sources=[
                {
                    "id": f"S{i}",
                    "title": source["title"],
                    "url": source["url"]
                }
                for i, source in enumerate(sources, 1)
            ],
            mode=mode
        )

        yield sse(
            "progress",
            step=4,
            message="Generating your response..."
        )

        async for piece in generate_answer(prompt, image_parts):
            yield sse("token", text=piece)

        if sources:

            source_block = "\n\n**Research Sources**\n\n"

            for i, source in enumerate(sources, 1):
                source_block += (
                    f"[S{i}] [{source['title']}]"
                    f"({source['url']})\n\n"
                )

            yield sse(
                "token",
                text=source_block
            )

        yield sse(
            "complete",
            message="Investigation completed."
        )

    except Exception as exc:

        logger.exception("Investigation failed")

        message = str(exc)

        if "429" in message or "RESOURCE_EXHAUSTED" in message:
            message = "AI usage limit reached. Please try again later."

        yield sse(
            "error",
            message=message[:250]
        )


def event_response(generator):

    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/investigate")
async def investigate(request: Request):

    content_type = request.headers.get(
        "content-type", ""
    ).lower()

    if "multipart/form-data" in content_type:

        form = await request.form()

        text = str(form.get("text", ""))
        domain = str(form.get("domain", "general"))

        try:
            urls = json.loads(str(form.get("urls", "[]")))
        except json.JSONDecodeError:
            raise HTTPException(400, "Invalid URL list.")

        if not isinstance(urls, list):
            raise HTTPException(400, "URLs must be a list.")

        files = [
            value
            for value in form.getlist("files")
            if isinstance(value, StarletteUploadFile)
        ]

    else:

        try:
            payload = await request.json()
        except Exception:
            raise HTTPException(400, "Invalid request body.")

        text = str(payload.get("text", ""))
        domain = str(payload.get("domain", "general"))
        urls = payload.get("urls", [])
        files = []

    if not text.strip() and not urls and not files:
        raise HTTPException(
            400,
            "Enter a question or attach material."
        )

    return event_response(
        investigation_events(
            text=text.strip() or "Analyse the supplied material.",
            domain=domain,
            urls=urls,
            files=files
        )
    )