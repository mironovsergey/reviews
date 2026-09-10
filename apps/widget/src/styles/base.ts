import { css } from 'lit';

/** Общие правила, подключаемые каждым компонентом. */
export const baseStyles = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  :host {
    font-family: var(--reviews-font-family);
    font-size: var(--reviews-font-size-body);
    line-height: var(--reviews-line-height-body);
    color: var(--reviews-color-text);
  }

  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  p {
    margin: 0;
  }

  img,
  svg {
    display: block;
  }
`;
