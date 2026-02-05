import { defineStore } from "pinia";
import { BUILTIN_QUICK_ANSWER_ID, BUILTIN_SMART_REASONING_ID } from "@/api/agent";

// Define settings interface
interface Settings {
  endpoint: string;
  apiKey: string;
  knowledgeBaseId: string;
  isAgentEnabled: boolean;
  agentConfig: AgentConfig;
  selectedKnowledgeBases: string[];  // Currently selected knowledge base ID list
  selectedFiles: string[]; // Currently selected file ID list
  modelConfig: ModelConfig;  // Model configuration
  ollamaConfig: OllamaConfig;  // Ollama configuration
  webSearchEnabled: boolean;  // Whether web search is enabled
  conversationModels: ConversationModels;
  selectedAgentId: string;  // Currently selected agent ID
}

// Agent configuration interface
interface AgentConfig {
  maxIterations: number;
  temperature: number;
  allowedTools: string[];
  system_prompt?: string;  // Unified system prompt (uses {{web_search_status}} placeholder)
}

interface ConversationModels {
  summaryModelId: string;
  rerankModelId: string;
  selectedChatModelId: string;  // User's currently selected conversation model ID
}

// Single model item interface
interface ModelItem {
  id: string;  // Unique ID
  name: string;  // Display name
  source: 'local' | 'remote';  // Model source
  modelName: string;  // Model identifier
  baseUrl?: string;  // Remote API URL
  apiKey?: string;  // Remote API Key
  dimension?: number;  // Embedding specific: vector dimension
  interfaceType?: 'ollama' | 'openai';  // VLLM specific: interface type
  isDefault?: boolean;  // Whether it is the default model
}

// Model configuration interface - supports multiple models
interface ModelConfig {
  chatModels: ModelItem[];
  embeddingModels: ModelItem[];
  rerankModels: ModelItem[];
  vllmModels: ModelItem[];  // VLLM vision models
}

// Ollama configuration interface
interface OllamaConfig {
  baseUrl: string;  // Ollama service address
  enabled: boolean;  // Whether enabled
}

// Default settings
const defaultSettings: Settings = {
  endpoint: import.meta.env.VITE_IS_DOCKER ? "" : "http://localhost:8080",
  apiKey: "",
  knowledgeBaseId: "",
  isAgentEnabled: false,
  agentConfig: {
    maxIterations: 5,
    temperature: 0.7,
    allowedTools: [],  // Default empty, needs to be loaded from backend via API
    system_prompt: "",
  },
  selectedKnowledgeBases: [],  // Default empty array
  selectedFiles: [], // Default empty array
  modelConfig: {
    chatModels: [],
    embeddingModels: [],
    rerankModels: [],
    vllmModels: []
  },
  ollamaConfig: {
    baseUrl: "http://localhost:11434",
    enabled: true
  },
  webSearchEnabled: false,  // Default web search disabled
  conversationModels: {
    summaryModelId: "",
    rerankModelId: "",
    selectedChatModelId: "",  // User's currently selected conversation model ID
  },
  selectedAgentId: BUILTIN_QUICK_ANSWER_ID,  // Default select quick answer mode
};

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    // Load settings from local storage, use default settings if not available
    settings: JSON.parse(localStorage.getItem("WeKnora_settings") || JSON.stringify(defaultSettings)),
  }),

  getters: {
    // Whether Agent is enabled
    isAgentEnabled: (state) => state.settings.isAgentEnabled || false,
    
    // Whether Agent is ready (configuration complete)
    // Need to satisfy: 1) Configured allowed tools 2) Set conversation model 3) Set rerank model
    isAgentReady: (state) => {
      const config = state.settings.agentConfig || defaultSettings.agentConfig
      const models = state.settings.conversationModels || defaultSettings.conversationModels
      return Boolean(
        config.allowedTools && config.allowedTools.length > 0 &&
        models.summaryModelId && models.summaryModelId.trim() !== '' &&
        models.rerankModelId && models.rerankModelId.trim() !== ''
      )
    },
    
    // Whether normal mode (quick answer) is ready
    // Need to satisfy: 1) Set conversation model 2) Set rerank model
    isNormalModeReady: (state) => {
      const models = state.settings.conversationModels || defaultSettings.conversationModels
      return Boolean(
        models.summaryModelId && models.summaryModelId.trim() !== '' &&
        models.rerankModelId && models.rerankModelId.trim() !== ''
      )
    },
    
    // Get Agent configuration
    agentConfig: (state) => state.settings.agentConfig || defaultSettings.agentConfig,

    conversationModels: (state) => state.settings.conversationModels || defaultSettings.conversationModels,
    
    // Get model configuration
    modelConfig: (state) => state.settings.modelConfig || defaultSettings.modelConfig,
    
    // Whether web search is enabled
    isWebSearchEnabled: (state) => state.settings.webSearchEnabled || false,
    
    // Currently selected agent ID
    selectedAgentId: (state) => state.settings.selectedAgentId || BUILTIN_QUICK_ANSWER_ID,
  },

  actions: {
    // Save settings
    saveSettings(settings: Settings) {
      this.settings = { ...settings };
      // Save to localStorage
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },

    // Get settings
    getSettings(): Settings {
      return this.settings;
    },

    // Get API endpoint
    getEndpoint(): string {
      return this.settings.endpoint || defaultSettings.endpoint;
    },

    // Get API Key
    getApiKey(): string {
      return this.settings.apiKey;
    },

    // Get knowledge base ID
    getKnowledgeBaseId(): string {
      return this.settings.knowledgeBaseId;
    },
    
    // Enable/disable Agent
    toggleAgent(enabled: boolean) {
      this.settings.isAgentEnabled = enabled;
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },
    
    // Update Agent configuration
    updateAgentConfig(config: Partial<AgentConfig>) {
      this.settings.agentConfig = { ...this.settings.agentConfig, ...config };
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },

    updateConversationModels(models: Partial<ConversationModels>) {
      const current = this.settings.conversationModels || defaultSettings.conversationModels;
      this.settings.conversationModels = { ...current, ...models };
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },
    
    // Update model configuration
    updateModelConfig(config: Partial<ModelConfig>) {
      this.settings.modelConfig = { ...this.settings.modelConfig, ...config };
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },
    
    // Add model
    addModel(type: 'chat' | 'embedding' | 'rerank' | 'vllm', model: ModelItem) {
      const key = `${type}Models` as keyof ModelConfig;
      const models = [...this.settings.modelConfig[key]] as ModelItem[];
      // If set as default, cancel default status of other models
      if (model.isDefault) {
        models.forEach(m => m.isDefault = false);
      }
      // If it's the first model, automatically set as default
      if (models.length === 0) {
        model.isDefault = true;
      }
      models.push(model);
      this.settings.modelConfig[key] = models as any;
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },
    
    // Update model
    updateModel(type: 'chat' | 'embedding' | 'rerank' | 'vllm', modelId: string, updates: Partial<ModelItem>) {
      const key = `${type}Models` as keyof ModelConfig;
      const models = [...this.settings.modelConfig[key]] as ModelItem[];
      const index = models.findIndex(m => m.id === modelId);
      if (index !== -1) {
        // If setting as default, cancel default status of other models
        if (updates.isDefault) {
          models.forEach(m => m.isDefault = false);
        }
        models[index] = { ...models[index], ...updates };
        this.settings.modelConfig[key] = models as any;
        localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
      }
    },
    
    // Delete model
    deleteModel(type: 'chat' | 'embedding' | 'rerank' | 'vllm', modelId: string) {
      const key = `${type}Models` as keyof ModelConfig;
      let models = [...this.settings.modelConfig[key]] as ModelItem[];
      const deletedModel = models.find(m => m.id === modelId);
      models = models.filter(m => m.id !== modelId);
      // If deleted model is default, set first one as default
      if (deletedModel?.isDefault && models.length > 0) {
        models[0].isDefault = true;
      }
      this.settings.modelConfig[key] = models as any;
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },
    
    // Set default model
    setDefaultModel(type: 'chat' | 'embedding' | 'rerank' | 'vllm', modelId: string) {
      const key = `${type}Models` as keyof ModelConfig;
      const models = [...this.settings.modelConfig[key]] as ModelItem[];
      models.forEach(m => m.isDefault = (m.id === modelId));
      this.settings.modelConfig[key] = models as any;
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },
    
    // Update Ollama configuration
    updateOllamaConfig(config: Partial<OllamaConfig>) {
      this.settings.ollamaConfig = { ...this.settings.ollamaConfig, ...config };
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },
    
    // Select knowledge bases (replace entire list)
    selectKnowledgeBases(kbIds: string[]) {
      this.settings.selectedKnowledgeBases = kbIds;
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },
    
    // Add single knowledge base
    addKnowledgeBase(kbId: string) {
      if (!this.settings.selectedKnowledgeBases.includes(kbId)) {
        this.settings.selectedKnowledgeBases.push(kbId);
        localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
      }
    },
    
    // Remove single knowledge base
    removeKnowledgeBase(kbId: string) {
      this.settings.selectedKnowledgeBases = 
        this.settings.selectedKnowledgeBases.filter((id: string) => id !== kbId);
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },
    
    // Clear knowledge base selection
    clearKnowledgeBases() {
      this.settings.selectedKnowledgeBases = [];
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },
    
    // Get selected knowledge base list
    getSelectedKnowledgeBases(): string[] {
      return this.settings.selectedKnowledgeBases || [];
    },
    
    // Enable/disable web search
    toggleWebSearch(enabled: boolean) {
      this.settings.webSearchEnabled = enabled;
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },

    // File selection actions
    addFile(fileId: string) {
      if (!this.settings.selectedFiles) this.settings.selectedFiles = [];
      if (!this.settings.selectedFiles.includes(fileId)) {
        this.settings.selectedFiles.push(fileId);
        localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
      }
    },

    removeFile(fileId: string) {
      if (!this.settings.selectedFiles) return;
      this.settings.selectedFiles = this.settings.selectedFiles.filter((id: string) => id !== fileId);
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },

    clearFiles() {
      this.settings.selectedFiles = [];
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },
    
    getSelectedFiles(): string[] {
      return this.settings.selectedFiles || [];
    },
    
    // Select agent
    selectAgent(agentId: string) {
      this.settings.selectedAgentId = agentId;
      // Automatically switch Agent mode based on agent type
      if (agentId === BUILTIN_QUICK_ANSWER_ID) {
        this.settings.isAgentEnabled = false;
      } else if (agentId === BUILTIN_SMART_REASONING_ID) {
        this.settings.isAgentEnabled = true;
      }
      // Custom agents need to be determined based on their configuration
      
      // Reset knowledge base and file selection state when switching agents
      // Because different agents are associated with different knowledge bases, need to clear user's previous selection
      this.settings.selectedKnowledgeBases = [];
      this.settings.selectedFiles = [];
      
      localStorage.setItem("WeKnora_settings", JSON.stringify(this.settings));
    },
    
    // Get selected agent ID
    getSelectedAgentId(): string {
      return this.settings.selectedAgentId || BUILTIN_QUICK_ANSWER_ID;
    },
  },
});
 