/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Content, SchemaUnion, Type } from '@google/genai';
import { DEFAULT_GEMINI_FLASH_LITE_MODEL } from '../config/models.js';
import { GeminiClient } from '../core/client.js';
import { GeminiChat } from '../core/geminiChat.js';
import { isFunctionResponse } from './messageInspectors.js';

const CHECK_PROMPT = `Analyze *only* the content and structure of your immediately preceding response (your last turn in the conversation history). Based *strictly* on that response, determine who should logically speak next: the 'user' or the 'model' (you).
**Decision Rules (apply in order):**
1.  **Model Continues:** If your last response explicitly states an immediate next action *you* intend to take (e.g., "Next, I will...", "Now I'll process...", "Moving on to analyze...", indicates an intended tool call that didn't execute), OR if the response seems clearly incomplete (cut off mid-thought without a natural conclusion), then the **'model'** should speak next.
2.  **Question to User:** If your last response ends with a direct question specifically addressed *to the user*, then the **'user'** should speak next.
3.  **Waiting for User:** If your last response completed a thought, statement, or task *and* does not meet the criteria for Rule 1 (Model Continues) or Rule 2 (Question to User), it implies a pause expecting user input or reaction. In this case, the **'user'** should speak next.`;

const RESPONSE_SCHEMA: SchemaUnion = {
  type: Type.OBJECT,
  properties: {
    reasoning: {
      type: Type.STRING,
      description:
        "Brief explanation justifying the 'next_speaker' choice based *strictly* on the applicable rule and the content/structure of the preceding turn.",
    },
    next_speaker: {
      type: Type.STRING,
      enum: ['user', 'model'],
      description:
        'Who should speak next based *only* on the preceding turn and the decision rules',
    },
  },
  required: ['reasoning', 'next_speaker'],
};

export interface NextSpeakerResponse {
  reasoning: string;
  next_speaker: 'user' | 'model';
}

export async function checkNextSpeaker(
  chat: GeminiChat,
  geminiClient: GeminiClient,
  abortSignal: AbortSignal,
): Promise<NextSpeakerResponse | null> {
  const history = chat.getHistory();
  if (history.length === 0) {
    return null;
  }

  // 根据 provider 选择合适的模型
  const config = geminiClient['config']; // 获取配置
  const provider = config.getProvider();
  
  // 根据 provider 选择不同的模型
  if (provider === 'openai') {
    // 使用 config.getModel() 而不是硬编码的模型名
  } else if (provider === 'deepseek') {
    // 使用 config.getModel() 而不是硬编码的模型名
  } else if (provider === 'ollama') {
    // 使用 config.getModel() 而不是硬编码的模型名
  }
  // 对于 gemini，使用默认的 DEFAULT_GEMINI_FLASH_LITE_MODEL

  const curatedHistory = history.filter((content) => {
    return (
      content.role === 'user' ||
      content.role === 'model' ||
      content.role === 'assistant'
    );
  });

  if (curatedHistory.length === 0) {
    return null;
  }

  const lastComprehensiveMessage =
    curatedHistory[curatedHistory.length - 1];

  // If the last message was a function response (tool call),
  // then the model should speak next.
  if (
    lastComprehensiveMessage &&
    isFunctionResponse(lastComprehensiveMessage)
  ) {
    return {
      reasoning:
        'The last message was a function response, so the model should speak next.',
      next_speaker: 'model',
    };
  }

  if (
    lastComprehensiveMessage &&
    lastComprehensiveMessage.role === 'model' &&
    lastComprehensiveMessage.parts &&
    lastComprehensiveMessage.parts.length === 0
  ) {
    lastComprehensiveMessage.parts.push({ text: '' });
    return {
      reasoning:
        'The last message was a filler model message with no content (nothing for user to act on), model should speak next.',
      next_speaker: 'model',
    };
  }

  // Things checked out. Let's proceed to potentially making an LLM request.

  const lastMessage = curatedHistory[curatedHistory.length - 1];
  if (!lastMessage || lastMessage.role !== 'model') {
    // Cannot determine next speaker if the last turn wasn't from the model
    // or if history is empty.
    return null;
  }

  const contents: Content[] = [
    ...curatedHistory,
    { role: 'user', parts: [{ text: CHECK_PROMPT }] },
  ];

  try {
    const modelToUse = (config as any).model || config.getModel();
    
    const parsedResponse = (await geminiClient.generateJson(
      contents,
      RESPONSE_SCHEMA,
      abortSignal,
      modelToUse,
    )) as unknown as NextSpeakerResponse;

    if (
      parsedResponse &&
      parsedResponse.next_speaker &&
      ['user', 'model'].includes(parsedResponse.next_speaker)
    ) {
      return parsedResponse;
    }
    return null;
  } catch (error) {
    console.warn(
      'Failed to talk to Gemini endpoint when seeing if conversation should continue.',
      error,
    );
    return null;
  }
}
