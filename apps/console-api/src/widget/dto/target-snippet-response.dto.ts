/** Код вставки для страницы одной клиники или одного врача. */
export class TargetSnippetResponseDto {
  targetId: string;
  /** Готовый к вставке код виджета с атрибутом target-id. */
  snippet: string;
}
