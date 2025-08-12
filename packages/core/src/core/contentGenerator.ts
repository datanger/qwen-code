/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  GoogleGenAI,
} from '@google/genai';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { DEFAULT_GEMINI_MODEL } from '../config/models.js';
import { Config } from '../config/config.js';
import { getEffectiveModel } from './modelCheck.js';
import { UserTierId } from '../code_assist/types.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  userTier?: UserTierId;
}

export enum AuthType {
  LOGIN_WITH_GOOGLE = 'oauth-personal',
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  CLOUD_SHELL = 'cloud-shell',
  USE_OPENAI = 'openai',
}

export type ContentGeneratorConfig = {
  model: string;
  apiKey?: string;
  vertexai?: boolean;
  authType?: AuthType | undefined;
  provider?: string;
  enableOpenAILogging?: boolean;
  // Timeout configuration in milliseconds
  timeout?: number;
  // Maximum retries for failed requests
  maxRetries?: number;
  // Stream configuration for providers that support it
  stream?: boolean;
  // Base URL for the API endpoint
  baseURL?: string;
  samplingParams?: {
    top_p?: number;
    top_k?: number;
    repetition_penalty?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    temperature?: number;
    max_tokens?: number;
  };
  proxy?: string | undefined;
};

export function createContentGeneratorConfig(
  config: Config,
  authType: AuthType | undefined,
): ContentGeneratorConfig {
  // Get API keys from environment variables
  const geminiApiKey = process.env.GEMINI_API_KEY || undefined;
  const openaiApiKey = process.env.OPENAI_API_KEY || undefined;
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY || undefined;
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || undefined;

  // Use runtime model from config if available; otherwise, fall back to parameter or default
  const effectiveModel = (config as any).model || config.getModel() || DEFAULT_GEMINI_MODEL;

  const contentGeneratorConfig: ContentGeneratorConfig = {
    model: effectiveModel,
    authType,
    provider: config.getProvider(),
    proxy: config?.getProxy(),
    enableOpenAILogging: config.getEnableOpenAILogging(),
    timeout: config.getContentGeneratorTimeout(),
    maxRetries: config.getContentGeneratorMaxRetries(),
    samplingParams: config.getSamplingParams(),
  };

  // Set API key based on provider
  const provider = config.getProvider() || 'gemini';
  
  if (provider === 'openai' && openaiApiKey) {
    contentGeneratorConfig.apiKey = openaiApiKey;
    contentGeneratorConfig.baseURL = process.env.OPENAI_BASE_URL;
  } else if (provider === 'deepseek' && deepseekApiKey) {
    contentGeneratorConfig.apiKey = deepseekApiKey;
    contentGeneratorConfig.baseURL = process.env.DEEPSEEK_API_BASE;
  } else if (provider === 'ollama') {
    contentGeneratorConfig.baseURL = ollamaBaseUrl || 'http://localhost:11434';
  } else if (provider === 'gemini' && geminiApiKey) {
    contentGeneratorConfig.apiKey = geminiApiKey;
    contentGeneratorConfig.vertexai = false;
  }

  return contentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  
  const version = process.env.CLI_VERSION || process.version;
  const httpOptions = {
    headers: {
      'User-Agent': `GeminiCLI/${version} (${process.platform}; ${process.arch})`,
    },
  };

  // 根据 provider 选择不同的适配器
  const provider = config.provider || process.env.GEMINI_PROVIDER || 'gemini';
  
  console.log('[DEBUG] Creating content generator with provider:', provider);
  console.log('[DEBUG] Config:', JSON.stringify(config, null, 2));

  if (provider === 'openai') {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    console.log('[DEBUG] Creating OpenAI content generator');
    // Import OpenAIContentGenerator dynamically to avoid circular dependencies
    const { OpenAIContentGenerator } = await import(
      './openaiContentGenerator.js'
    );
    
    return new OpenAIContentGenerator(
      config.apiKey,
      config.model || process.env.OPENAI_API_MODEL || 'gpt-3.5-turbo',
      gcConfig,
      'openai',
      config.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    );
  }
  
  if (provider === 'deepseek') {
    if (!config.apiKey) {
      throw new Error('DeepSeek API key is required');
    }
    
    console.log('[DEBUG] Creating DeepSeek content generator');
    // Import OpenAIContentGenerator dynamically to avoid circular dependencies
    const { OpenAIContentGenerator } = await import(
      './openaiContentGenerator.js'
    );
    
    return new OpenAIContentGenerator(
      config.apiKey,
      config.model || process.env.DEEPSEEK_API_MODEL || 'deepseek-chat',
      gcConfig,
      'deepseek',
      config.baseURL || process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com/v1'
    );
  }

  if (provider === 'ollama') {
    console.log('[DEBUG] Creating Ollama content generator');
    // Import OpenAIContentGenerator dynamically to avoid circular dependencies
    const { OpenAIContentGenerator } = await import(
      './openaiContentGenerator.js'
    );
    
    // For Ollama, we need to include the /v1 path in the baseURL
    const ollamaBaseURL = (config.baseURL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434') + '/v1';
    
    return new OpenAIContentGenerator(
      '', // Ollama doesn't require API key
      config.model || process.env.OLLAMA_MODEL || 'llama2',
      gcConfig,
      'ollama',
      ollamaBaseURL
    );
  }

  // Default to Gemini/Google
  if (provider === 'gemini') {
    console.log('[DEBUG] Creating Gemini content generator');
    if (config.apiKey) {
      const googleGenAI = new GoogleGenAI({
        apiKey: config.apiKey,
        vertexai: false,
        httpOptions,
      });
      return googleGenAI.models;
    } else {
      // Fallback to code assist if no API key
      console.log('[DEBUG] No Gemini API key, falling back to code assist');
      return createCodeAssistContentGenerator(
        httpOptions,
        AuthType.USE_GEMINI,
        gcConfig,
        sessionId,
      );
    }
  }

  throw new Error(
    `Error creating contentGenerator: Unsupported provider: ${provider}`,
  );
}
