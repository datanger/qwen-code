/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from '@qwen-code/qwen-code-core';

/**
 * Simplified non-interactive auth validation - no validation needed
 * Just return the config as-is since provider and API keys are handled elsewhere
 */
export async function validateNonInteractiveAuth(
  configuredAuthType: any,
  useExternalAuth: boolean | undefined,
  nonInteractiveConfig: Config,
) {
  // No validation needed - provider and API keys are handled in contentGenerator
  // Just return the config as-is
  return nonInteractiveConfig;
}
