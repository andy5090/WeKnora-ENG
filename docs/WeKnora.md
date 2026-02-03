## Introduction
WeKora is an enterprise-grade RAG framework ready for production deployment, implementing intelligent document understanding and retrieval functionality. The system adopts a modular design, separating document understanding, vector storage, inference files, and other functions.

![arc](./images/arc.png)

---

## Pipeline
WeKnora processes documents through multiple steps: Insertion -> Knowledge Extraction -> Indexing -> Retrieval -> Generation. The entire process supports multiple retrieval methods.

![](./images/pipeline2.jpeg)


Using a user-uploaded accommodation receipt PDF file as an example, here's a detailed description of the data flow:

### 1. Request Reception and Initialization
+ **Request Identification**: The system receives a request and assigns a unique `request_id=Lkq0OGLYu2fV` for tracking the entire processing flow.
+ **Tenant and Session Verification**:
    - The system first verifies tenant information (ID: 1, Name: Default Tenant).
    - Then begins processing a Knowledge QA request belonging to session `1f241340-ae75-40a5-8731-9a3a82e34fdd`.
+ **User Question**: The user's original question is: "**What is the room type for check-in**".
+ **Message Creation**: The system creates message records for the user's question and the upcoming answer, with IDs `703ddf09-...` and `6f057649-...` respectively.

### 2. Knowledge Base QA Process Initiation
The system formally invokes the knowledge base QA service and defines the complete processing pipeline to be executed in order, containing the following 9 events:
`[rewrite_query, preprocess_query, chunk_search, chunk_rerank, chunk_merge, filter_top_k, into_chat_message, chat_completion_stream, stream_filter]`

---

### 3. Event Execution Details
#### Event 1: `rewrite_query` - Query Rewriting
+ **Purpose**: To make retrieval more precise, the system needs to understand the user's true intent by combining context.
+ **Operations**:
    1. The system retrieves the 20 most recent historical messages from the current session (actually retrieved 8) as context.
    2. Calls a local large language model named `deepseek-r1:7b`.
    3. Based on chat history, the model identifies the questioner as "Liwx" and rewrites the original question "What is the room type for check-in" to be more specific.
+ **Result**: The question is successfully rewritten to: "**What is the room type for Liwx's current stay**".

#### Event 2: `preprocess_query` - Query Preprocessing
+ **Purpose**: Tokenize the rewritten question and convert it into a keyword sequence suitable for search engine processing.
+ **Operation**: Performed tokenization on the rewritten question.
+ **Result**: Generated a string of keywords: "`need rewrite user question check-in room type according provided information check-in person Liwx chose room type twin room therefore rewrite complete question as Liwx current stay room type`".

#### Event 3: `chunk_search` - Knowledge Chunk Retrieval
This is the core **Retrieval** step. The system performed two hybrid searches.

+ **First Search (using the complete rewritten question)**:
    - **Vector Retrieval**:
        1. Loaded embedding model `bge-m3:latest` to convert the question into a 1024-dimensional vector.
        2. Performed vector similarity search in the PostgreSQL database, finding 2 relevant knowledge chunks with IDs `e3bf6599-...` and `3989c6ce-...`.
    - **Keyword Retrieval**:
        1. Simultaneously, the system also performed keyword search.
        2. Found the same 2 knowledge chunks.
    - **Result Merging**: The 4 results found by both methods (actually 2 duplicates) were deduplicated, resulting in 2 unique knowledge chunks.
+ **Second Search (using the preprocessed keyword sequence)**:
    - The system repeated the **vector retrieval** and **keyword retrieval** process using the tokenized keywords.
    - Also obtained the same 2 knowledge chunks.
+ **Final Result**: After two searches and result merging, the system identified 2 most relevant knowledge chunks and extracted their content for answer generation.

#### Event 4: `chunk_rerank` - Result Reranking
+ **Purpose**: Use a more powerful model to perform finer ranking of initially retrieved results to improve final answer quality.
+ **Operation**: Logs show `Rerank model ID is empty, skipping reranking`. This means the system configured the reranking step but no specific reranking model was specified, so **this step was skipped**.

#### Event 5: `chunk_merge` - Chunk Merging
+ **Purpose**: Merge adjacent or related knowledge chunks to form more complete context.
+ **Operation**: The system analyzed the 2 retrieved chunks and attempted merging. According to logs, the final processing still resulted in 2 independent chunks, but sorted by relevance score.

#### Event 6: `filter_top_k` - Top-K Filtering
+ **Purpose**: Retain only the most relevant K results to prevent too much irrelevant information from interfering with the language model.
+ **Operation**: The system configured to keep the top 5 (Top-K = 5) most relevant chunks. Since there were only 2 chunks, they all passed this filter.

#### Events 7 & 8: `into_chat_message` & `chat_completion_stream` - Answer Generation
This is the **Generation** step.

+ **Purpose**: Generate natural, fluent answers based on retrieved information.
+ **Operations**:
    1. The system integrates the content of the 2 retrieved knowledge chunks, the user's original question, and chat history into a complete prompt.
    2. Calls the `deepseek-r1:7b` large language model again, requesting answer generation in **streaming** mode. Streaming output enables a typewriter effect, improving user experience.

#### Event 9: `stream_filter` - Stream Output Filtering
+ **Purpose**: Post-process the real-time text stream generated by the model, filtering out unwanted special markers or content.
+ **Operations**:
    - The system set up a filter to remove internal markers that the model might produce during thinking, such as `<think>` and `</think>`.
    - Logs show the first token output by the model was `<think> According`, and the filter successfully intercepted and removed the `<think>` marker, passing only "According" and subsequent content through.

### 4. Completion and Response
+ **Send Citations**: While generating the answer, the system sends the 2 knowledge chunks used as evidence to the frontend as "reference content" for user verification.
+ **Update Message**: After the model completes generating all content, the system updates the complete answer to the previously created message record (ID: `6f057649-...`).
+ **Request End**: The server returns a `200` success status code, marking the completion of the entire question-to-answer flow.

### Summary
This log completely records a typical RAG flow: the system precisely understands user intent through **query rewriting** and **preprocessing**, then uses **hybrid vector and keyword retrieval** to find relevant information from the knowledge base. Although **reranking** was skipped, it still executed **merging** and **filtering**, and finally passed the retrieved knowledge as context to the large language model for **generating** fluent, accurate answers, ensuring output purity through **stream filtering**.

## Document Parsing and Chunking
The code implements an independent microservice that communicates via gRPC, specifically responsible for deep parsing, chunking, and multimodal information extraction of document content. It is the core executor of the "asynchronous processing" phase.

### **Overall Architecture**
This is a Python-based gRPC service whose core responsibility is to receive files (or URLs) and parse them into structured text chunks suitable for subsequent processing (such as vectorization).

+ `server.py`: The service entry point and network layer. It's responsible for starting a multi-process, multi-threaded gRPC server, receiving requests from the Go backend, and returning parsing results.
+ `parser.py`: The **Facade pattern** in design patterns. It provides a unified `Parser` class that hides the complexity of multiple internal concrete parsers (such as PDF, DOCX, Markdown, etc.). External callers (`server.py`) only need to interact with this `Parser` class.
+ `base_parser.py`: The base class for parsers, defining core logic and abstract methods shared by all concrete parsers. This is the "brain" of the entire parsing flow, containing the most complex text chunking, image processing, OCR, and image captioning functions.

---

### **Detailed Workflow**
When the Go backend starts an asynchronous task, it makes a gRPC call to this Python service with file content and configuration information. Here's the complete processing flow:

#### **Step 1: Request Reception and Distribution (**`server.py`** & **`parser.py`**)**
1. **gRPC Service Entry (**`server.py: serve`**)**:
    - The service starts through the `serve()` function. It starts a **multi-process, multi-threaded** server based on environment variables (`GRPC_WORKER_PROCESSES`, `GRPC_MAX_WORKERS`) to fully utilize CPU resources and improve concurrent processing capability.
    - Each worker process listens on the specified port (e.g., 50051), ready to receive requests.
2. **Request Processing (**`server.py: ReadFromFile`**)**:
    - When the Go backend initiates a `ReadFromFile` request, one of the worker processes receives it.
    - This method first parses the request parameters, including:
        * `file_name`, `file_type`, `file_content`: Basic file information and binary content.
        * `read_config`: A complex object containing all parsing configurations, such as `chunk_size`, `chunk_overlap`, `enable_multimodal` (whether to enable multimodal processing), `storage_config` (object storage configuration), `vlm_config` (vision language model configuration), etc.
    - It integrates these configurations into a `ChunkingConfig` data object.
    - The most critical step is calling `self.parser.parse_file(...)`, delegating the parsing task to the `Parser` facade class.
3. **Parser Selection (**`parser.py: Parser.parse_file`**)**:
    - After the `Parser` class receives the task, it first calls the `get_parser(file_type)` method.
    - This method looks up the corresponding concrete parser class (e.g., `PDFParser`) in a dictionary `self.parsers` based on file type (e.g., `'pdf'`).
    - Once found, it **instantiates** this `PDFParser` class and passes `ChunkingConfig` and all configuration information to the constructor.

#### **Step 2: Core Parsing and Chunking (**`base_parser.py`**)**
This touches on the core of the entire process: **how to ensure context completeness and original order of information**.

According to the `base_parser.py` code, **the text, tables, and images in the finally chunked output are stored in the order they appear in the original document**.

This order is guaranteed thanks to several cleverly designed methods in `BaseParser` working together. Let's trace through this flow in detail.

The order guarantee can be divided into three phases:

1. **Phase 1: Unified Text Stream Creation (**`pdf_parser.py`**)**:
    - In the `parse_into_text` method, the code processes the PDF **page by page**.
    - Within each page, following certain logic (first extracting non-table text, then appending tables, finally appending image placeholders), all content is **concatenated into a long string** (`page_content_parts`).
    - **Key Point**: Although at this stage the concatenation order of text, tables, and image placeholders may not be 100% character-level precise, it ensures that **content from the same page stays together** and roughly follows top-to-bottom reading order.
    - Finally, all page content is connected by `"\n\n--- Page Break ---\n\n"`, forming **a single, ordered text stream containing all information (text, Markdown tables, image placeholders) (**`final_text`**)**.
2. **Phase 2: Atomization and Protection (**`_split_into_units`**)**:
    - This single `final_text` is passed to the `_split_into_units` method.
    - This method is **key to ensuring structural integrity**. It uses regular expressions to identify **entire Markdown tables** and **entire Markdown image placeholders** as **indivisible atomic units**.
    - It splits these atomic units (tables, images) and the regular text blocks between them into a list (`units`) according to their **original order** in `final_text`.
    - **Result**: We now have a list, e.g., `['some text', '![...](...)' , 'more text', '|...|...|\\n|---|---|\\n...', 'even more text']`. The element order in this list **exactly matches their order in the original document**.
3. **Phase 3: Sequential Chunking (**`chunk_text`**)**:
    - The `chunk_text` method receives this **ordered **`units`** list**.
    - Its mechanism is very straightforward: it **sequentially** traverses each unit in the list.
    - It **sequentially adds** these units to a temporary `current_chunk` list until the chunk length approaches the `chunk_size` limit.
    - When a chunk is full, it's saved, and a new chunk begins (possibly with overlap from the previous chunk).
    - **Key Point**: Because `chunk_text` **strictly processes in **`units`** list order**, it never scrambles the relative order between tables, text, and images. A table that appears earlier in the document will definitely appear in a lower-numbered Chunk.
4. **Phase 4: Image Information Attachment (**`process_chunks_images`**)**:
    - After text chunks are split, the `process_chunks_images` method is called.
    - It processes **each** generated Chunk.
    - Within each Chunk, it finds image placeholders and performs AI processing.
    - Finally, it attaches the processed image information (containing permanent URLs, OCR text, image captions, etc.) to **that Chunk's own** `.images` property.
    - **Key Point**: This process **doesn't change Chunk order or its **`.content`** content**. It only attaches additional information to existing, correctly-ordered Chunks.

#### **Step 3: Multimodal Processing (if enabled) (**`base_parser.py`**)**
If `enable_multimodal` is `True`, after text chunking is complete, the most complex multimodal processing phase begins.

1. **Concurrent Task Startup (**`BaseParser.process_chunks_images`**)**:
    - This method uses `asyncio` (Python's asynchronous I/O framework) to **concurrently process images from all text chunks**, greatly improving efficiency.
    - It creates an async task `process_chunk_images_async` for each `Chunk`.
2. **Processing Images in a Single Chunk (**`BaseParser.process_chunk_images_async`**)**:
    - **Extract Image References**: First, use regex `extract_images_from_chunk` to find all image references in the current chunk's text (e.g., `![alt text](image.png)`).
    - **Image Persistence**: For each found image, concurrently call `download_and_upload_image`. This function:
        * Fetches image data from its original location (possibly inside the PDF, local path, or remote URL).
        * **Uploads the image to configured object storage (COS/MinIO)**. This step is crucial - it converts temporary, unstable image references to persistent, publicly accessible URLs.
        * Returns the persistent URL and image object (PIL Image).
    - **Concurrent AI Processing**: Collect all successfully uploaded images and call `process_multiple_images`.
        * This method internally uses `asyncio.Semaphore` to limit concurrency (e.g., max 5 images simultaneously), preventing instant memory exhaustion or triggering model API rate limits.
        * For each image, it calls `process_image_async`.
3. **Processing Single Image (**`BaseParser.process_image_async`**)**:
    - **OCR**: Calls `perform_ocr`, which uses an OCR engine (like `PaddleOCR`) to recognize all text in the image.
    - **Image Caption**: Calls `get_image_caption`, which sends image data (as Base64) to the configured vision language model (VLM) to generate a natural language description of the image content.
    - This method returns `(ocr_text, caption, persistent_URL)`.
4. **Result Aggregation**:
    - After all images are processed, structured information containing persistent URLs, OCR text, and image captions is attached to the corresponding `Chunk` object's `.images` field.

#### **Step 4: Return Results (**`server.py`**)**
1. **Data Conversion (**`server.py: _convert_chunk_to_proto`**)**:
    - When `parser.parse_file` completes, it returns a list containing all processed `Chunk` objects (`ParseResult`).
    - The `ReadFromFile` method receives this result and calls `_convert_chunk_to_proto` to convert Python `Chunk` objects (including internal image information) to gRPC-defined Protobuf message format.
2. **Response Return**:
    - Finally, the gRPC server sends this `ReadResponse` message containing all chunks and multimodal information back to the caller - the Go backend service.

At this point, the Go backend has structured, information-rich document data and can proceed with vectorization and index storage.


## Deployment
Supports local deployment via Docker images, providing API services through the API port

## Performance and Monitoring
WeKnora includes rich monitoring and testing components:

+ Distributed Tracing: Integrated Jaeger for tracking the complete execution path of requests through the service architecture. Essentially, Jaeger is a technology that helps users "see" the complete lifecycle of requests in distributed systems.
+ Health Monitoring: Monitors services in healthy state
+ Scalability: Through containerized deployment, multiple services can handle large-scale concurrent requests

## QA
### Question 1: What is the purpose of executing two hybrid searches during the retrieval process? And what's the difference between the first and second search?
This is a great observation. The system executes two hybrid searches to **maximize retrieval accuracy and recall**, essentially a combination of **query expansion** and **multi-strategy retrieval**.

#### Purpose
By searching with two different forms of queries (original rewritten sentence vs. tokenized keyword sequence), the system combines the advantages of both query methods:

+ **Depth of Semantic Retrieval**: Using complete sentences for search better leverages the vector model's (like `bge-m3`) ability to understand overall sentence meaning, finding semantically closest knowledge chunks.
+ **Breadth of Keyword Retrieval**: Using tokenized keywords for search ensures that even if knowledge chunks are expressed differently from the original question, as long as they contain core keywords, they have a chance of being matched. This is especially effective for traditional keyword matching algorithms (like BM25).

Simply put, it's **asking the same question in two different "ways"**, then combining results from both sides to ensure the most relevant knowledge isn't missed.

#### Differences Between the Two Searches
The core difference lies in the **input query text**:

1. **First Hybrid Search**
    - **Input**: Uses the **grammatically complete natural language question** generated after the `rewrite_query` event.
    - **Log Evidence**:

```plain
INFO [2025-08-29 09:46:36.896] [request_id=Lkq0OGLYu2fV] knowledgebase.go:266[HybridSearch] | Hybrid search parameters, knowledge base ID: kb-00000001, query text: The user question to be rewritten is: "What is the room type for check-in". According to the provided information, the guest Liwx chose the twin room. Therefore, the complete rewritten question is: "What is the room type for Liwx's current stay"
```

2. **Second Hybrid Search**
    - **Input**: Uses the **space-separated keyword sequence** generated after the `preprocess_query` event.
    - **Log Evidence**:

```plain
INFO [2025-08-29 09:46:37.257] [request_id=Lkq0OGLYu2fV] knowledgebase.go:266[HybridSearch] | Hybrid search parameters, knowledge base ID: kb-00000001, query text: need rewrite user question check-in room type according provided information check-in person Liwx chose room type twin room therefore rewrite complete question as Liwx current stay room type
```

Finally, the system deduplicates and merges results from both searches (logs show 2 results found each time, 2 total after deduplication), obtaining a more reliable knowledge set for subsequent answer generation.



### Question 2: Reranker Model Analysis
Rerankers are very advanced technologies in the RAG field, with significant differences in working principles and applicable scenarios.

Simply put, they represent an evolution from "**dedicated discriminative models**" to "**using LLMs for discrimination**" to "**deeply mining LLM internal information for discrimination**".

Here are their detailed differences:



#### 1. Normal Reranker (Cross-Encoder)
This is the most classic and mainstream reranking method.

+ **Model Type**: **Sequence Classification Model**. Essentially a **Cross-Encoder**, typically based on bidirectional encoder architectures like BERT or RoBERTa. `BAAI/bge-reranker-base/large/v2-m3` all belong to this category.
+ **Working Principle**:
    1. It concatenates the **Query** and **Passage to be ranked** into a single input sequence, e.g.: `[CLS] what is panda? [SEP] The giant panda is a bear species endemic to China. [SEP]`.
    2. This concatenated sequence is completely fed into the model. The model's internal self-attention mechanism can simultaneously analyze every word in both query and document, calculating **fine-grained interaction relationships** between them.
    3. The model ultimately outputs a **single score (Logit)**, directly representing query-document relevance. Higher scores mean stronger relevance.
+ **Key Characteristics**:
    - **Advantages**: Since query and document undergo sufficient, deep interaction within the model, its **accuracy is typically very high**, the gold standard for measuring Reranker performance.
    - **Disadvantages**: **Relatively slow**. Because it must independently execute a complete, expensive computation for **each "query-document" pair**. If initial retrieval returns 100 documents, it needs to run 100 times.



#### 2. LLM-based Reranker
This method creatively leverages general large language model (LLM) capabilities for reranking.

+ **Model Type**: **Causal Language Model**, i.e., GPT, Llama, Gemma and similar text-generating LLMs. `BAAI/bge-reranker-v2-gemma` is a typical example.
+ **Working Principle**:
    1. It **doesn't directly output a score**, but **transforms the reranking task into a QA or text generation task**.
    2. It organizes input through a carefully designed **Prompt**, e.g.: `"Given a query A and a passage B, determine whether the passage contains an answer to the query by providing a prediction of either 'Yes' or 'No'. A: {query} B: {passage}"`.
    3. It feeds this complete Prompt to the LLM, then **observes the probability of the LLM generating "Yes" at the end**.
    4. This **probability of generating "Yes" (or its Logit value) is used as the relevance score**. If the model is very confident the answer is "Yes", it believes document B contains an answer to query A, i.e., high relevance.
+ **Key Characteristics**:
    - **Advantages**: Can leverage LLM's powerful **semantic understanding, reasoning, and world knowledge**. For complex queries requiring deep understanding and reasoning to judge relevance, the effect may be better.
    - **Disadvantages**: Computational overhead can be very large (depending on LLM size), and performance **heavily depends on Prompt design**.



#### 3. LLM-based Layerwise Reranker
This is the "enhanced version" of the second method, a more cutting-edge and complex exploratory technique.

+ **Model Type**: Also a **Causal Language Model**, e.g., `BAAI/bge-reranker-v2-minicpm-layerwise`.
+ **Working Principle**:
    1. The input part is exactly the same as the second method, also using "Yes/No" Prompts.
    2. The core difference lies in **how scores are extracted**. It no longer relies solely on the LLM's **final layer** output (i.e., the final prediction result).
    3. It believes that as the LLM processes information layer by layer, different depth network layers may capture different levels of semantic relevance information. Therefore, it extracts prediction Logits for "Yes" from **multiple intermediate layers** of the model.
    4. The `cutoff_layers=[28]` parameter in code tells the model: "Please give me the output from layer 28". Ultimately, you get one or more scores from different network layers, which can be averaged or otherwise combined to form a more robust final relevance judgment.
+ **Key Characteristics**:
    - **Advantages**: Theoretically can obtain **richer, more comprehensive relevance signals**, potentially achieving higher precision than only looking at the final layer, currently a method for exploring performance limits.
    - **Disadvantages**: **Highest complexity**, requires specific model modifications to extract intermediate layer information (the `trust_remote_code=True` in code is a signal), and computational overhead is also large.

#### Summary Comparison
| Feature | 1. Normal Reranker | 2. LLM-based Reranker | 3. LLM-based Layerwise Reranker |
| :--- | :--- | :--- | :--- |
| **Underlying Model** | Cross-Encoder (e.g., BERT) | Causal Language Model (e.g., Gemma) | Causal Language Model (e.g., MiniCPM) |
| **Working Principle** | Computes deep Query-Passage interaction, directly outputs relevance score | Transforms ranking task to "Yes/No" prediction, uses "Yes" probability as score | Similar to type 2, but extracts "Yes" probability from multiple LLM intermediate layers |
| **Output** | Single relevance score | Single relevance score (from last layer) | Multiple relevance scores (from different layers) |
| **Advantages** | **Best balance of speed and accuracy**, mature and stable | Leverages LLM reasoning capability, handles complex problems | Theoretically highest precision, richer signals |
| **Disadvantages** | Slower than vector retrieval | Large computational overhead, depends on Prompt design | **Highest complexity**, largest computational overhead |
| **Recommended Scenarios** | **First choice for most production environments**, good results, easy to deploy | Scenarios with extreme answer quality requirements and sufficient computing resources | Academic research or scenarios pursuing SOTA (State-of-the-art) performance |


#### Usage Recommendations
1. **Starting Phase**: Strongly recommend **starting with `Normal Reranker`**, e.g., `BAAI/bge-reranker-v2-m3`. It's currently one of the best overall performers, can significantly improve your RAG system performance, and is relatively easy to integrate and deploy.
2. **Advanced Exploration**: If you find the normal Reranker underperforms on some very subtle or complex reasoning queries, and you have sufficient GPU resources, try `LLM-based Reranker`.
3. **Cutting-edge Research**: `Layerwise Reranker` is more suitable for researchers or experts wanting to squeeze out the last bit of performance on specific tasks.


### Question 3: How is knowledge after coarse/fine filtering (with reranking) assembled and sent to the large model?
This mainly involves designing prompts, typical instruction details, with the core task of answering user questions based on context. When assembling context, you need to specify:
Key Constraints: Must strictly answer according to provided documents, prohibited from using your own knowledge to answer
Unknown Situation Handling: If the documents don't have enough information to answer the question, please indicate "Based on available materials, this question cannot be answered"
Citation Requirements: When answering, if citing a document's content, please add the document number at the end of the sentence

---

## Manual Knowledge Online Editing

The platform's knowledge base page adds dual entry points for "Upload Document / Online Edit", supporting direct writing and maintenance of Markdown knowledge in the browser:

- Draft mode is for temporarily storing content; drafts will not participate in retrieval.
- The publish operation automatically triggers vectorization and index construction.
- Published Markdown knowledge can be reopened for editing and republished.
- The conversation page provides an "Add to Knowledge Base" tool at the end of assistant answers, allowing one-click import of current Q&A to the editor for confirmation and saving.
