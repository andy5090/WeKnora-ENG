# Frequently Asked Questions

## 1. How to view logs?
```bash
docker compose logs -f app docreader postgres
```

## 2. How to start and stop services?
```bash
# Start services
./scripts/start_all.sh

# Stop services
./scripts/start_all.sh --stop

# Clear database
./scripts/start_all.sh --stop && make clean-db
```

## 3. Unable to upload documents after service startup?

Usually caused by Embedding model and conversation model not being set correctly. Follow these steps to troubleshoot:

1. Check if model information in `.env` configuration is complete. If using ollama to access local models, ensure the local ollama service is running normally, and the following environment variables in `.env` need to be set correctly:
```bash
# LLM Model
INIT_LLM_MODEL_NAME=your_llm_model
# Embedding Model
INIT_EMBEDDING_MODEL_NAME=your_embedding_model
# Embedding model vector dimension
INIT_EMBEDDING_MODEL_DIMENSION=your_embedding_model_dimension
# Embedding model ID, usually a string
INIT_EMBEDDING_MODEL_ID=your_embedding_model_id
```

If accessing models through remote API, you need to additionally provide the corresponding `BASE_URL` and `API_KEY`:
```bash
# LLM model access address
INIT_LLM_MODEL_BASE_URL=your_llm_model_base_url
# LLM model API key, set if authentication is required
INIT_LLM_MODEL_API_KEY=your_llm_model_api_key
# Embedding model access address
INIT_EMBEDDING_MODEL_BASE_URL=your_embedding_model_base_url
# Embedding model API key, set if authentication is required
INIT_EMBEDDING_MODEL_API_KEY=your_embedding_model_api_key
```

When reranking functionality is needed, you need to additionally configure the Rerank model. The specific configuration is as follows:
```bash
# Rerank model name to use
INIT_RERANK_MODEL_NAME=your_rerank_model_name
# Rerank model access address
INIT_RERANK_MODEL_BASE_URL=your_rerank_model_base_url
# Rerank model API key, set if authentication is required
INIT_RERANK_MODEL_API_KEY=your_rerank_model_api_key
```

2. Check the main service logs for any `ERROR` log output

## 4. No images or invalid image links displayed?

When using multimodal functionality, if you encounter issues with images not displaying or showing invalid links, please troubleshoot according to the following steps:

### 1. Confirm multimodal functionality is correctly configured

Enable **Advanced Settings - Multimodal Functionality** in knowledge base settings, and configure the corresponding multimodal model in the interface.

### 2. Confirm MinIO service is started

If the multimodal functionality configuration uses MinIO storage, ensure the MinIO image is started correctly:
```bash
# Start MinIO service
docker-compose --profile minio up -d

# Or start full services (including MinIO, Jaeger, Neo4j, Qdrant)
docker-compose --profile full up -d
```

### 3. Check MinIO Bucket permissions

Ensure the MinIO bucket has correct read/write permissions:

1. Access MinIO console: `http://localhost:9001` (default port)
2. Login using `MINIO_ACCESS_KEY_ID` and `MINIO_SECRET_ACCESS_KEY` configured in `.env`
3. Enter the corresponding bucket, check and set access policy to **Public Read** or **Public Read/Write**

**Important Notes**:
- Bucket names should not contain special characters (including Chinese), it is recommended to use lowercase letters, numbers, and hyphens
- If you cannot modify existing bucket permissions, you can enter a non-existent bucket name in the configuration, and this project will automatically create the corresponding bucket and set correct permissions

### 4. Configure MINIO_PUBLIC_ENDPOINT

In the `docker-compose.yml` file, the `MINIO_PUBLIC_ENDPOINT` variable is configured by default as `http://localhost:9000`.

**Important Note**: If you need to access images from other devices or containers, `localhost` may not work properly, and you need to replace it with the actual IP address of your machine:


## 5. Platform Compatibility Notes

**Important Note**: `OCR_BACKEND=paddle` mode may not run properly on some platforms. If you encounter PaddleOCR startup failure issues, please choose one of the following solutions:

### Solution 1: Disable OCR recognition

Delete the `OCR_BACKEND` configuration in the `docreader` service in the `docker-compose.yml` file, then restart the docreader service

**Note**: After setting to `no_ocr`, document parsing will not use OCR functionality, which may affect text recognition for images and scanned documents.

### Solution 2: Use external OCR model (Recommended)

If OCR functionality is needed, you can use an external vision language model (VLM) to replace PaddleOCR. Configure in the `docreader` service in the `docker-compose.yml` file:

```yaml
environment:
  - OCR_BACKEND=vlm
  - OCR_API_BASE_URL=${OCR_API_BASE_URL:-}
  - OCR_API_KEY=${OCR_API_KEY:-}
  - OCR_MODEL=${OCR_MODEL:-}
```

Then restart the docreader service

**Advantages**: Using external OCR models can achieve better recognition results and is not limited by platform.

## 6. How to use data analysis functionality?

Before using data analysis functionality, ensure the agent has configured related tools:

1. **Smart Reasoning**: Need to check the following two tools in tool configuration:
   - View Data Schema
   - Data Analysis

2. **Quick Answer Agent**: No need to manually select tools, can directly perform simple data query operations.

### Notes and Usage Guidelines

1. **Supported File Formats**
   - Currently only supports **CSV** (`.csv`) and **Excel** (`.xlsx`, `.xls`) format files.
   - For complex Excel files, if reading fails, it is recommended to convert them to standard CSV format and re-upload.

2. **Query Restrictions**
   - Only supports **read-only queries**, including `SELECT`, `SHOW`, `DESCRIBE`, `EXPLAIN`, `PRAGMA` statements.
   - Prohibited from executing any data modification operations, such as `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP`, etc.


## P.S.
If the above methods do not solve the problem, please describe your issue in an issue and provide necessary log information to help us troubleshoot
