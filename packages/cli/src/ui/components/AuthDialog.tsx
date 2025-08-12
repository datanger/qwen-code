/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import { AuthType } from '@qwen-code/qwen-code-core';

interface AuthDialogProps {
  onSelect: (authMethod: AuthType | undefined, scope: SettingScope) => void;
  settings: LoadedSettings;
  initialErrorMessage?: string | null;
}

export function AuthDialog({
  onSelect,
  settings,
  initialErrorMessage,
}: AuthDialogProps): React.JSX.Element {
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage || null,
  );
  
  const items = [
    { label: 'Gemini (Google)', value: AuthType.USE_GEMINI },
    { label: 'OpenAI', value: AuthType.USE_OPENAI },
    { label: 'DeepSeek', value: AuthType.USE_OPENAI },
    { label: 'Ollama', value: AuthType.USE_OPENAI },
  ];

  const initialAuthIndex = 0;

  const handleAuthSelect = (authMethod: AuthType) => {
    setErrorMessage(null);
    onSelect(authMethod, SettingScope.User);
  };

  const handleCancel = () => {
    onSelect(undefined, SettingScope.User);
  };

  useInput((input) => {
    if (input === 'q' || input === 'Q') {
      handleCancel();
    }
  });

  if (errorMessage) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={Colors.AccentRed}>{errorMessage}</Text>
        <Text>Press any key to continue...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={Colors.Foreground}>
        Select authentication method (or press Q to cancel):
      </Text>
      <RadioButtonSelect
        items={items}
        initialIndex={initialAuthIndex}
        onSelect={handleAuthSelect}
      />
      <Text color={Colors.Gray}>
        Press Q to cancel
      </Text>
    </Box>
  );
}
