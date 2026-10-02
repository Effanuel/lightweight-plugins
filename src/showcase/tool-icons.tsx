interface Props {
  className?: string;
}

export function MeasureIcon({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" className={className}>
      <path
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={0.75}
        d="M2 9.75a1.5 1.5 0 0 0-1.5 1.5v5.5a1.5 1.5 0 0 0 1.5 1.5h24a1.5 1.5 0 0 0 1.5-1.5v-5.5a1.5 1.5 0 0 0-1.5-1.5zm0 1h3v2.5h1v-2.5h3.25v3.9h1v-3.9h3.25v2.5h1v-2.5h3.25v3.9h1v-3.9H22v2.5h1v-2.5h3a.5.5 0 0 1 .5.5v5.5a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5v-5.5a.5.5 0 0 1 .5-.5z"
        transform="rotate(-45 14 14)"
      />
    </svg>
  );
}

export function HRayIcon({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" className={className}>
      <g fill="currentColor" stroke="currentColor" strokeWidth={0.75} fillRule="nonzero">
        <path d="M8.5 15h16.5v-1h-16.5z" />
        <path d="M6.5 16c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5z" />
      </g>
    </svg>
  );
}

export function PathIcon({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" className={className}>
      <path
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={0.75}
        d="M11 10.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm4 7a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm11-8.8V13h1V7h-6v1h4.3l-7.42 7.41a2.49 2.49 0 0 0-2.76 0l-3.53-3.53a2.5 2.5 0 1 0-4.17 0L1 18.29l.7.71 6.42-6.41a2.49 2.49 0 0 0 2.76 0l3.53 3.53a2.5 2.5 0 1 0 4.17 0z"
      />
    </svg>
  );
}

export function BoxIcon({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" className={className}>
      <g fill="currentColor" stroke="currentColor" strokeWidth={0.75} fillRule="nonzero">
        <path d="M7.5 6h13v-1h-13z" />
        <path d="M7.5 23h13v-1h-13z" />
        <path d="M5 7.5v13h1v-13z" />
        <path d="M22 7.5v13h1v-13z" />
        <path d="M5.5 7c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5zM22.5 7c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5zM22.5 24c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5zM5.5 24c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5z" />
      </g>
    </svg>
  );
}

export function FibIcon({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" className={className}>
      <g fill="currentColor" stroke="currentColor" strokeWidth={0.75} fillRule="nonzero">
        <path d="M3 5h22v-1h-22z" />
        <path d="M3 17h22v-1h-22z" />
        <path d="M3 11h19.5v-1h-19.5z" />
        <path d="M5.5 23h19.5v-1h-19.5z" />
        <path d="M3.5 24c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5zM24.5 12c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm0 1c-1.381 0-2.5-1.119-2.5-2.5s1.119-2.5 2.5-2.5 2.5 1.119 2.5 2.5-1.119 2.5-2.5 2.5z" />
      </g>
    </svg>
  );
}

export function BinIcon({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" className={className}>
      <path
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={0.75}
        d="M18 7h5v1h-2.01l-1.33 14.64a1.5 1.5 0 0 1-1.5 1.36H9.84a1.5 1.5 0 0 1-1.49-1.36L7.01 8H5V7h5V6c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2v1Zm-6-2a1 1 0 0 0-1 1v1h6V6a1 1 0 0 0-1-1h-4ZM8.02 8l1.32 14.54a.5.5 0 0 0 .5.46h8.33a.5.5 0 0 0 .5-.46L19.99 8H8.02Z"
      />
    </svg>
  );
}

export function TrendIcon({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" className={className}>
      <g fill="currentColor" stroke="currentColor" strokeWidth={0.75} fillRule="nonzero">
        <path d="M7.8 21.2l13.4-13.4.7.7L8.5 21.9z" />
        <path d="M6.5 23c.828 0 1.5-.672 1.5-1.5S7.328 20 6.5 20 5 20.672 5 21.5 5.672 23 6.5 23zm0 1C5.119 24 4 22.881 4 21.5S5.119 19 6.5 19 9 20.119 9 21.5 7.881 24 6.5 24zM21.5 9c.828 0 1.5-.672 1.5-1.5S22.328 6 21.5 6 20 6.672 20 7.5 20.672 9 21.5 9zm0 1C20.119 10 19 8.881 19 7.5S20.119 5 21.5 5 24 6.119 24 7.5 22.881 10 21.5 10z" />
      </g>
    </svg>
  );
}

export function HLineIcon({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" className={className}>
      <path fill="currentColor" stroke="currentColor" strokeWidth={0.75} d="M3 14.5h22v-1H3z" />
    </svg>
  );
}

export function VLineIcon({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" className={className}>
      <path fill="currentColor" stroke="currentColor" strokeWidth={0.75} d="M13.5 3h1v22h-1z" />
    </svg>
  );
}

export function MagnetIcon({ className }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" className={className}>
      <g fill="currentColor" fillRule="evenodd">
        <path
          fillRule="nonzero"
          d="M14 10a2 2 0 0 0-2 2v11H6V12c0-4.416 3.584-8 8-8s8 3.584 8 8v11h-6V12a2 2 0 0 0-2-2zm-3 2a3 3 0 0 1 6 0v10h4V12c0-3.864-3.136-7-7-7s-7 3.136-7 7v10h4V12z"
        />
        <path d="M6.5 18h5v1h-5zm10 0h5v1h-5z" />
      </g>
    </svg>
  );
}
