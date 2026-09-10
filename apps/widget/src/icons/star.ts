import { svg, type SVGTemplateResult } from 'lit';

export const iconStar = (fill: string): SVGTemplateResult => svg`
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="m14.821 8.116 6.309.917-4.565 4.45 1.078 6.284L12 16.8l-5.643 2.967 1.078-6.284-4.565-4.45 6.309-.917L12 2.4z"
      fill="${fill}"
    />
  </svg>
`;
