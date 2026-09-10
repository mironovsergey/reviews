/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Адрес API консоли, подставляемый в бандл при сборке.
   *
   * Консоль и ее API размещены на разных поддоменах, поэтому значение
   * обязательно: консоль обращается к API по абсолютному адресу.
   */
  readonly VITE_CONSOLE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
