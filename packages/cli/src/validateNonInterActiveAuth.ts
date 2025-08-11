/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType, Config } from '@qwen-code/qwen-code-core';
import { USER_SETTINGS_PATH } from './config/settings.js';
import { validateAuthMethod } from './config/auth.js';

function getAuthTypeFromEnv(): AuthType | undefined {
  if (process.env.GOOGLE_GENAI_USE_GCA === 'true') {
    return AuthType.LOGIN_WITH_GOOGLE;
  }
  if (process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true') {
    return AuthType.USE_VERTEX_AI;
  }
  if (process.env.GEMINI_API_KEY) {
    return AuthType.USE_GEMINI;
  }
  if (process.env.OPENAI_API_KEY) {
    return AuthType.USE_OPENAI;
  }
  return undefined;
}

export async function validateNonInteractiveAuth(
  configuredAuthType: AuthType | undefined,
  useExternalAuth: boolean | undefined,
  nonInteractiveConfig: Config,
) {
  // 首先检查 Config 中的 provider 参数
  const provider = nonInteractiveConfig.getProvider();
  let effectiveAuthType = configuredAuthType;
  
  // 如果设置了 provider，根据 provider 来决定 AuthType
  if (provider && provider !== 'gemini') {
    if (provider === 'openai') {
      effectiveAuthType = AuthType.USE_OPENAI;
    } else if (provider === 'deepseek' || provider === 'ollama') {
      // 对于 deepseek 和 ollama，我们也使用 USE_OPENAI，因为它们是 OpenAI 兼容的
      effectiveAuthType = AuthType.USE_OPENAI;
    }
  } else {
    // 如果没有设置 provider 或 provider 是 gemini，则使用原来的逻辑
    effectiveAuthType = effectiveAuthType || getAuthTypeFromEnv();
  }

  if (!effectiveAuthType) {
    console.error(
      `Please set an Auth method in your ${USER_SETTINGS_PATH} or specify one of the following environment variables before running: GEMINI_API_KEY, OPENAI_API_KEY, GOOGLE_GENAI_USE_VERTEXAI, GOOGLE_GENAI_USE_GCA`,
    );
    process.exit(1);
  }

  if (!useExternalAuth) {
    const err = validateAuthMethod(effectiveAuthType);
    if (err != null) {
      console.error(err);
      process.exit(1);
    }
  }

  await nonInteractiveConfig.refreshAuth(effectiveAuthType);
  return nonInteractiveConfig;
}
