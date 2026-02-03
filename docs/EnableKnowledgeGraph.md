# Guide to Enabling Knowledge Graph Feature

This document describes how to enable and verify the knowledge graph (Neo4j) feature in WeKnora, helping you complete the entire process from environment preparation to frontend configuration.

## Prerequisites

- Completed basic deployment of WeKnora backend and frontend.
- Available Docker/Docker Compose runtime environment.
- Local or remote accessible Neo4j service (recommended to use the project's built-in Docker Compose).

## Step 1: Configure Environment Variables

Add or modify the following variables in the `.env` file in the project root directory:

```
NEO4J_ENABLE=true
NEO4J_URI=bolt://neo4j:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_strong_password
# Optional: NEO4J_DATABASE=neo4j
```

Notes:

- `NEO4J_ENABLE` must be set to `true` to enable knowledge graph related logic.
- The `neo4j` in `NEO4J_URI` is the docker-compose service name. If using an external instance, replace with the actual address.
- If using secret management in production, ensure passwords are injected securely.

## Step 2: Start Neo4j Service

The project includes a Neo4j component, which can be started directly with the following command:

```bash
docker-compose --profile neo4j up -d
```

Common verification commands:

```bash
docker ps | grep neo4j
```

If you need to customize mounts or memory, you can edit the `neo4j` service configuration in `docker-compose.yml`.

## Step 3: Restart WeKnora Services

To apply the new environment variables, restart the backend and frontend (example for reference only):

```bash
make stop && make start
# or
docker compose up -d --build
```

Ensure the backend logs show successful `neo4j` initialization.

## Step 4: Enable Entity/Relationship Extraction in Frontend

1. Log in to the WeKnora frontend management page.
2. Open "Knowledge Base Settings" or create a new knowledge base.
3. Check the "Enable Entity Extraction" and "Enable Relationship Extraction" switches.
4. Complete any required LLM, callback, or model parameters according to the interface prompts (if any).

After saving, the system will automatically trigger entity and relationship extraction tasks during document ingestion.

## Step 5: Verify Knowledge Graph

### Method 1: Neo4j Console

1. Access `http://localhost:7474` (or the corresponding host/port).
2. Log in with the credentials from `.env`.
3. Execute `MATCH (n) RETURN n LIMIT 50;` to check if there are new nodes/relationships.

### Method 2: WeKnora Interface

After uploading documents on the knowledge base or conversation page, the frontend should display a graph visualization entry; during conversations, the system will automatically query the graph and return supplementary information based on intent.

## Common Troubleshooting

- **Cannot connect to Neo4j**: Confirm network accessibility, correct `NEO4J_URI`, username and password, and check Neo4j container logs.
- **No nodes generated**: Confirm the knowledge base has entity/relationship extraction enabled and uploaded documents have completed parsing; check backend logs for extraction task exceptions.
- **Query returns no results**: Try executing `CALL db.schema.visualization;` in the Neo4j console to check if the schema exists; re-import documents if necessary.

After completing the above steps, the knowledge graph feature is successfully enabled and can be combined with RAG and Agent workflows to improve Q&A quality.

