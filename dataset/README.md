# QA Dataset Sampling Tool

A comprehensive QA dataset sampling tool that uses OpenAI's GPT models to generate answers. This tool helps you create high-quality question-answering datasets from large-scale datasets (like MS MARCO).

## Features

- **Smart Sampling**: Intelligently samples queries, documents, and relevance judgments from large datasets
- **Answer Generation**: Automatically generates high-quality answers using OpenAI's GPT models
- **Resume Support**: Supports resuming generation after interruption, continuing from where you left off
- **Progress Tracking**: Real-time progress updates and statistics
- **Result Visualization**: Easy-to-read QA pair display with full context

## Installation Guide

### System Requirements

- Python 3.7+
- OpenAI API key

### Install Dependencies

```bash
pip install pandas pyarrow openai
```

### Set Environment Variables

```bash
export OPENAI_API_KEY="your-openai-api-key"
# Optional: Use custom OpenAI endpoint
export OPENAI_BASE_URL="https://api.openai.com/v1"
```

### Prepare Dataset

You can use any QA dataset that meets the format requirements, or download pre-processed samples:

**Using HuggingFace/ModelScope Samples**
We provide pre-processed samples from popular QA datasets:
- MarkrAI/eli5_sample_autorag
- MarkrAI/msmarco_sample_autorag
- MarkrAI/triviaqa_sample_autorag
- gnekt/hotpotqa_small_sample_autorag

**Using Your Own Dataset**
Ensure your dataset contains the following files:
- `queries.parquet` (columns: id, text)
- `corpus.parquet` (columns: id, text)
- `qrels.parquet` (columns: qid, pid)

## Quick Start

### 1. Sample from Large Dataset

First, sample a subset of queries, documents, and relevance judgments from the full dataset:

```bash
python dataset/qa_dataset.py sample \
  --queries ~/dataset/mmarco-queries.parquet \
  --corpus ~/dataset/mmarco-corpus.parquet \
  --qrels ~/dataset/mmarco-qrels.parquet \
  --nq 100 \
  --output_dir ./dataset/samples
```

### 2. Generate Answers

Generate answers for the sampled QA using OpenAI's GPT models:

```bash
python dataset/qa_dataset.py generate \
  --input_dir ./dataset/samples \
  --output_dir ./dataset/samples
```

### 3. View Results

Display the generated QA pairs with their context:

```bash
python dataset/qa_dataset.py show \
  --input_dir ./dataset/samples \
  -n 5
```

## Detailed Usage

### Sample Command

Create a representative sample from the full dataset.

```bash
python dataset/qa_dataset.py sample [options]
```

**Required Arguments:**
- `--queries`: Path to queries parquet file (columns: `id`, `text`)
- `--corpus`: Path to corpus parquet file (columns: `id`, `text`)
- `--qrels`: Path to relevance judgments parquet file (columns: `qid`, `pid`)

**Optional Arguments:**
- `--nq`: Number of queries to sample (default: 1000)
- `--output_dir`: Output directory for sampled data (default: ./save)

**Example:**
```bash
python dataset/qa_dataset.py sample \
  --queries data/queries.parquet \
  --corpus data/corpus.parquet \
  --qrels data/qrels.parquet \
  --nq 500 \
  --output_dir ./my_sample
```

### Generate Command

Generate answers for sampled questions using OpenAI API.

```bash
python dataset/qa_dataset.py generate [options]
```

**Required Arguments:**
- `--input_dir`: Directory containing sampled data (queries.parquet, corpus.parquet, qrels.parquet)

**Optional Arguments:**
- `--output_dir`: Output directory for generated answers (default: ./save)

**Features:**
- **Resume Support**: Automatically continues from last position after interruption
- **Error Handling**: Automatic retry up to 3 times for failed API calls
- **Progress Saving**: Saves progress after each successful answer generation

**Example:**
```bash
python dataset/qa_dataset.py generate \
  --input_dir ./my_sample \
  --output_dir ./my_sample
```

### Show Command

Display generated QA pairs with full context.

```bash
python dataset/qa_dataset.py show [options]
```

**Required Arguments:**
- `--input_dir`: Directory containing QA data (queries.parquet, corpus.parquet, qrels.parquet, qas.parquet, answers.parquet)

**Optional Arguments:**
- `-n`: Number of results to show (default: 5)

**Example:**
```bash
python dataset/qa_dataset.py show \
  --input_dir ./my_sample \
  -n 3
```

## Input Data Format

### Queries File (queries.parquet)
| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique query identifier |
| text | string | Actual question text |

### Corpus File (corpus.parquet)
| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique passage/document identifier |
| text | string | Passage/document content |

### Relevance Judgments File (qrels.parquet)
| Column | Type | Description |
|--------|------|-------------|
| qid | string | Query ID (matches queries.id) |
| pid | string | Passage ID (matches corpus.id) |

## Output Files

After running all commands, the output directory will contain:

### Sampled Data
- `queries.parquet`: Sampled queries subset
- `corpus.parquet`: Sampled documents subset
- `qrels.parquet`: Sampled relevance judgments

### Generated Answers
- `answers.parquet`: Generated answers (with unique IDs)
- `qas.parquet`: Question-answer mapping (qid → aid)

## Advanced Usage

### Custom OpenAI Configuration

You can use different OpenAI models or endpoints:

```bash
# Use GPT-4 Turbo
export OPENAI_API_KEY="your-key"
python dataset/qa_dataset.py generate --input_dir ./samples

# Use Azure OpenAI
export OPENAI_API_KEY="azure-key"
export OPENAI_BASE_URL="https://your-resource.openai.azure.com/openai/deployments/gpt-4"
python dataset/qa_dataset.py generate --input_dir ./samples
```

### Large Dataset Sampling

For very large datasets, it's recommended to sample in batches:

```bash
# First batch
python dataset/qa_dataset.py sample --nq 1000 --output_dir ./batch1
python dataset/qa_dataset.py generate --input_dir ./batch1

# Second batch
python dataset/qa_dataset.py sample --nq 1000 --output_dir ./batch2
python dataset/qa_dataset.py generate --input_dir ./batch2
```

## Troubleshooting

### Common Issues

**1. OpenAI API Errors**
- Ensure API key is set correctly: `echo $OPENAI_API_KEY`
- Check API quota and billing status
- Verify network connection to OpenAI

**2. Memory Issues with Large Datasets**
- Reduce `--nq` parameter for smaller samples
- Ensure enough RAM for pandas operations
- Consider using smaller parquet files

**3. File Not Found Errors**
- Verify all input file paths are correct
- Ensure parquet files have correct column names
- Check file permissions

### Debug Mode

Enable verbose output by adding print statements or using Python debugger:

```bash
python -m pdb dataset/qa_dataset.py sample --queries ...
```

## Example Workflow

```bash
# 1. Set up environment
export OPENAI_API_KEY="sk-..."

# 2. Sample 200 queries from MS MARCO
python dataset/qa_dataset.py sample \
  --queries ~/mmarco/queries.parquet \
  --corpus ~/mmarco/corpus.parquet \
  --qrels ~/mmarco/qrels.parquet \
  --nq 200 \
  --output_dir ./marco_sample

# 3. Generate answers (may take some time depending on API rate limits)
python dataset/qa_dataset.py generate \
  --input_dir ./marco_sample \
  --output_dir ./marco_sample

# 4. View results
python dataset/qa_dataset.py show \
  --input_dir ./marco_sample \
  -n 10
```

## Contributing

Issues and feature enhancement requests are welcome!

## License

MIT License - Free to use for research and projects.
