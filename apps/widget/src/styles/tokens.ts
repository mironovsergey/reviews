import { css } from 'lit';

/**
 * Оформление виджета.
 *
 * Имена описывают назначение, а не место в шкале: виджет встраивается в
 * чужие страницы, и переменные должны читаться без обращения к макету.
 * Префикс `--reviews-` исключает столкновение с переменными сайта
 * размещения. Значения наследуются вложенными компонентами через теневой
 * DOM, поэтому объявляются один раз на корне.
 */
export const tokens = css`
  :host {
    --reviews-color-surface: #fff;
    --reviews-color-text: #22211e;
    --reviews-color-text-muted: #62615e;
    --reviews-color-text-subtle: #767571;
    --reviews-color-border: #e1e0dc;
    --reviews-color-inactive: #e1e0dc;

    --reviews-color-accent: #199b9b;
    --reviews-color-accent-surface: #dff0f1;
    --reviews-color-action: #008a88;
    --reviews-color-action-hover: #006e6a;
    --reviews-color-link: #2e94ad;
    --reviews-color-link-hover: #195b67;
    --reviews-color-rating: #f4d044;

    --reviews-space-xs: 4px;
    --reviews-space-sm: 8px;
    --reviews-space-md: 12px;
    --reviews-space-lg: 16px;
    --reviews-space-xl: 20px;
    --reviews-space-2xl: 32px;

    --reviews-radius-control: 12px;
    --reviews-radius-card: 24px;

    --reviews-font-family:
      'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --reviews-font-size-button: 18px;
    --reviews-font-size-body: 16px;
    --reviews-font-size-caption: 14px;
    --reviews-font-size-legal: 12px;
    --reviews-line-height-button: 1.33333333;
    --reviews-line-height-body: 1.5;
    --reviews-line-height-caption: 1.428571;
    --reviews-line-height-legal: 1.33333333;
  }
`;
