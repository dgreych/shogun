import {
  ATTRIBUTES,
  CIRCLE_MODES,
  MESSAGE_VIEW_MODEL_KINDS,
  ONBOARDING_STATES,
  OUTCOMES,
  STANCES,
  TONES
} from './enums.js';
import { requireEnum, validateContentVersion } from './validation.js';

export const validateCircleMode = value => requireEnum(value, 'circleMode', CIRCLE_MODES);
export const validateOnboardingState = value => requireEnum(value, 'onboardingState', ONBOARDING_STATES);
export const validateTone = value => requireEnum(value, 'tone', TONES);
export const validateAttribute = value => requireEnum(value, 'attribute', ATTRIBUTES);
export const validateStance = value => requireEnum(value, 'stance', STANCES);
export const validateOutcome = value => requireEnum(value, 'outcome', OUTCOMES);
export const validateMessageViewModelKind = value => requireEnum(value, 'messageViewModelKind', MESSAGE_VIEW_MODEL_KINDS);
export { validateContentVersion };
