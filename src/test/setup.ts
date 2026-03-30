import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Capacitor plugins
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    exitApp: vi.fn()
  }
}));

vi.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    setStyle: vi.fn().mockResolvedValue({}),
    setOverlaysWebView: vi.fn().mockResolvedValue({}),
    setBackgroundColor: vi.fn().mockResolvedValue({})
  },
  Style: {
    Light: 'LIGHT',
    Dark: 'DARK',
    Default: 'DEFAULT'
  }
}));

// Mock window.matchMedia for responsive testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
