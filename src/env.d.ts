/// <reference types="vite/client" />

declare module '*.svg';

interface ImportMetaEnv {
  readonly VITE_ADMIN_USERNAME?: string;
  readonly VITE_ADMIN_PASSWORD?: string;
}
