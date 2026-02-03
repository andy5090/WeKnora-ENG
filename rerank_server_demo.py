import torch
import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel, Field
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from typing import List

# --- 1. Define API request and response data structures ---


# Request body structure remains unchanged
class RerankRequest(BaseModel):
    query: str
    documents: List[str]


# --- Modification start: Define test response structure with "score" field ---


# DocumentInfo structure remains unchanged
class DocumentInfo(BaseModel):
    text: str


# Renamed from GoRankResult to TestRankResult
# Core change: Renamed "relevance_score" field to "score"
class TestRankResult(BaseModel):
    index: int
    document: DocumentInfo
    score: float  # <--- [KEY CHANGE] Field name changed from relevance_score to score


# Final response body structure, "results" list contains TestRankResult
class TestFinalResponse(BaseModel):
    results: List[TestRankResult]


# --- Modification end ---


# --- 2. Load model (executed once at server startup) ---
print("Loading model, please wait...")
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Device in use: {device}")
try:
    # Make sure the path here is correct
    model_path = "/data1/home/lwx/work/Download/rerank_model_weight"
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSequenceClassification.from_pretrained(model_path)
    model.to(device)
    model.eval()
    print("Model loaded successfully!")
except Exception as e:
    print(f"Model loading failed: {e}")
    # In test environment, if model loading fails, consider exiting to avoid running an invalid service
    exit()

# --- 3. Create FastAPI application ---
app = FastAPI(
    title="Reranker API (Test Version)",
    description="An API service that returns 'score' field to test Go client compatibility",
    version="1.0.1",
)


# --- 4. Define API endpoint ---
# --- Modification start: Changed response_model to point to new test response structure ---
@app.post(
    "/rerank", response_model=TestFinalResponse
)  # <--- [KEY CHANGE] response_model changed to TestFinalResponse
def rerank_endpoint(request: RerankRequest):
    # --- Modification end ---

    pairs = [[request.query, doc] for doc in request.documents]

    with torch.no_grad():
        inputs = tokenizer(
            pairs, padding=True, truncation=True, return_tensors="pt", max_length=1024
        ).to(device)
        scores = (
            model(**inputs, return_dict=True)
            .logits.view(
                -1,
            )
            .float()
        )

    # --- Modification start: Build results according to test structure ---
    results = []
    for i, (text, score_val) in enumerate(zip(request.documents, scores)):
        # 1. Create nested document object
        doc_info = DocumentInfo(text=text)

        # 2. Create TestRankResult object
        #    Note field names: index, document, score
        test_result = TestRankResult(
            index=i,
            document=doc_info,
            score=score_val.item(),  # <--- [KEY CHANGE] Assigned to "score" field
        )
        results.append(test_result)

    # 3. Sort (key also needs to be changed to score)
    sorted_results = sorted(results, key=lambda x: x.score, reverse=True)
    # --- Modification end ---

    # Return a dictionary, FastAPI will validate and serialize it according to response_model (TestFinalResponse)
    # The final generated JSON will be {"results": [{"index": ..., "document": ..., "score": ...}]}
    return {"results": sorted_results}


@app.get("/")
def read_root():
    return {"status": "Reranker API (Test Version) is running"}


# --- 5. Start service ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
