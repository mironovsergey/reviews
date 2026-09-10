/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Адрес API, подставляемый в бандл при сборке.
   *
   * Значение читается из `.env` в корне рабочего пространства, в боевой
   * сборке передается параметром. Виджет всегда работает со стороннего
   * домена, поэтому относительный адрес недопустим.
   */
  readonly VITE_WIDGET_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
